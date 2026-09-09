"""Deterministic lexical and quote-grounding primitives.

This module owns text normalization, multilingual stopwords, conservative
numeric fact canonicalization, quote diagnostics, and passage selection. The
public service contract remains in :mod:`agenda_intelligence.services`.
"""

from __future__ import annotations

import difflib
import math
import re
import unicodedata
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Iterable, Mapping, Optional

_GROUNDED_CHECK_STOPWORDS = frozenset(
    "a about after all also an and any are as at be been but by can could did do does for from had has "
    "have how if in into is it its may more most no not of on or other our over per should so some such "
    "than that the their them then there these they this to under was were what when where which while "
    "who will with would".split()
)

_GROUNDED_CHECK_STOPWORDS |= frozenset(
    "а без более бы был была были было быть в вам вас весь во вот все всего всех вы где да даже для до "
    "его ее если есть ещё же за здесь и из или им их к как когда кто ли либо мне может мы на над надо "
    "наш не него нее нет ни но ну о об один она они оно от по под при про раз с со так такой там те тем "
    "то того тоже той только том ты у уже хотя чем что чтобы эта эти это этот я".split()
)

_GROUNDED_CHECK_STOPWORDS |= frozenset(
    "أجل إذا إذن إلى أم أما أن أنا أنت أنتم أو أي أين بل به بها بين ثم جداً حتى حيث ذلك دون عن على "
    "عليه عليها عند غير في كان كانت كانوا كل كما كيف لا لم لن له لها ليس ما ماذا مع من منذ هذا هذه هم "
    "هن هو هي هناك الذي والتي والذي التي الذين تم قد ولا وما وهو وهي".split()
)

_MONTH_NUMBERS = {
    "january": 1,
    "jan": 1,
    "января": 1,
    "يناير": 1,
    "february": 2,
    "feb": 2,
    "февраля": 2,
    "فبراير": 2,
    "march": 3,
    "mar": 3,
    "марта": 3,
    "مارس": 3,
    "april": 4,
    "apr": 4,
    "апреля": 4,
    "أبريل": 4,
    "may": 5,
    "мая": 5,
    "مايو": 5,
    "june": 6,
    "jun": 6,
    "июня": 6,
    "يونيو": 6,
    "july": 7,
    "jul": 7,
    "июля": 7,
    "يوليو": 7,
    "august": 8,
    "aug": 8,
    "августа": 8,
    "أغسطس": 8,
    "september": 9,
    "sep": 9,
    "sept": 9,
    "сентября": 9,
    "سبتمبر": 9,
    "october": 10,
    "oct": 10,
    "октября": 10,
    "أكتوبر": 10,
    "november": 11,
    "nov": 11,
    "ноября": 11,
    "نوفمبر": 11,
    "december": 12,
    "dec": 12,
    "декабря": 12,
    "ديسمبر": 12,
}

_MONTH_PATTERN = "|".join(sorted((re.escape(month) for month in _MONTH_NUMBERS), key=len, reverse=True))
_DATE_PATTERNS = (
    re.compile(r"(?<!\d)(?P<year>\d{4})-(?P<month>\d{1,2})-(?P<day>\d{1,2})(?!\d)"),
    re.compile(r"(?<!\d)(?P<day>\d{1,2})\.(?P<month>\d{1,2})\.(?P<year>\d{4})(?!\d)"),
    re.compile(
        rf"(?<![\w])(?P<day>\d{{1,2}})\s+(?P<month_name>{_MONTH_PATTERN})\s*,?\s*(?P<year>\d{{4}})(?!\d)",
        re.IGNORECASE,
    ),
    re.compile(
        rf"(?<![\w])(?P<month_name>{_MONTH_PATTERN})\s+(?P<day>\d{{1,2}})\s*,?\s*(?P<year>\d{{4}})(?!\d)",
        re.IGNORECASE,
    ),
)

_NUMBER_PATTERN = r"(?:\d{1,3}(?:[ \u00a0\u202f,_]\d{3})+|\d+(?:[.,]\d+)?)"
_SCALE_PATTERN = (
    r"(?:thousand|million|billion|тыс(?:яч[аиу]?)?|млн|миллион(?:а|ов)?|млрд|миллиард(?:а|ов)?|"
    r"ألف|مليون|مليار|k|m|b|mn|bn)"
)
_UNIT_PATTERN = (
    r"(?:%|percent|per\s+cent|процент(?:а|ов)?|بالمائة|في\s+المائة|usd|us\s+dollars?|dollars?|доллар(?:а|ов|ы)?|"
    r"eur|euros?|евро|gbp|pounds?|фунт(?:а|ов|ы)?|rub|руб(?:\.|ля|лей)?|kzt|₸|тенге)"
)
_NUMERIC_EXPRESSION_PATTERN = re.compile(
    rf"(?<![\w])(?P<prefix>[$€£₽₸])?\s*(?P<number>{_NUMBER_PATTERN})"
    rf"(?:\s*(?P<scale>{_SCALE_PATTERN}))?(?:\s*(?P<unit>{_UNIT_PATTERN}))?(?![\w])",
    re.IGNORECASE,
)

_SCALE_MULTIPLIERS = {
    "k": Decimal("1000"),
    "thousand": Decimal("1000"),
    "тыс": Decimal("1000"),
    "ألف": Decimal("1000"),
    "m": Decimal("1000000"),
    "mn": Decimal("1000000"),
    "million": Decimal("1000000"),
    "млн": Decimal("1000000"),
    "миллион": Decimal("1000000"),
    "مليون": Decimal("1000000"),
    "b": Decimal("1000000000"),
    "bn": Decimal("1000000000"),
    "billion": Decimal("1000000000"),
    "млрд": Decimal("1000000000"),
    "миллиард": Decimal("1000000000"),
    "مليار": Decimal("1000000000"),
}

_CURRENCY_SYMBOLS = {"$": "usd", "€": "eur", "£": "gbp", "₽": "rub", "₸": "kzt"}


def _grounded_normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).replace("\u00ad", "")
    return re.sub(r"\s+", " ", text).strip().casefold()


def _decimal_value(raw: str) -> Decimal | None:
    compact = re.sub(r"[ \u00a0\u202f_]", "", raw)
    if "," in compact and "." in compact:
        if compact.rfind(".") > compact.rfind(","):
            compact = compact.replace(",", "")
        else:
            compact = compact.replace(".", "").replace(",", ".")
    elif "," in compact:
        groups = compact.split(",")
        if len(groups) > 2 or (len(groups) == 2 and len(groups[1]) == 3):
            compact = "".join(groups)
        else:
            compact = compact.replace(",", ".")
    try:
        return Decimal(compact)
    except InvalidOperation:
        return None


def _canonical_decimal(value: Decimal) -> str:
    rendered = format(value, "f")
    if "." in rendered:
        rendered = rendered.rstrip("0").rstrip(".")
    return rendered or "0"


def _scale_multiplier(scale: str | None) -> Decimal:
    if not scale:
        return Decimal(1)
    normalized = scale.casefold().rstrip(".")
    for prefix, multiplier in _SCALE_MULTIPLIERS.items():
        if normalized == prefix or normalized.startswith(prefix):
            return multiplier
    return Decimal(1)


def _currency_code(prefix: str | None, unit: str | None) -> str | None:
    prefix_code = _CURRENCY_SYMBOLS.get(prefix or "")
    normalized = (unit or "").casefold().replace(" ", "").rstrip(".")
    unit_code = None
    if normalized.startswith(("usd", "dollar", "доллар")):
        unit_code = "usd"
    elif normalized.startswith(("eur", "euro", "евро")):
        unit_code = "eur"
    elif normalized.startswith(("gbp", "pound", "фунт")):
        unit_code = "gbp"
    elif normalized.startswith(("rub", "руб")):
        unit_code = "rub"
    elif normalized.startswith(("kzt", "₸", "тенге")):
        unit_code = "kzt"
    if prefix_code and unit_code and prefix_code != unit_code:
        return f"conflict-{prefix_code}-{unit_code}"
    return prefix_code or unit_code


def _is_percent_unit(unit: str | None) -> bool:
    normalized = (unit or "").casefold().replace(" ", "")
    return normalized == "%" or normalized.startswith(("percent", "процент", "بالمائة", "فيالمائة"))


def _date_mention(match: re.Match[str]) -> dict | None:
    try:
        month_group = match.groupdict().get("month")
        month_name = match.groupdict().get("month_name")
        month = int(month_group) if month_group else _MONTH_NUMBERS[(month_name or "").casefold()]
        parsed = date(int(match.group("year")), month, int(match.group("day")))
    except (KeyError, TypeError, ValueError):
        return None
    return {
        "start": match.start(),
        "end": match.end(),
        "display": match.group(0).strip(),
        "literal": match.group(0).strip(),
        "key": f"numdate-{parsed.isoformat()}",
    }


def _numeric_mentions(text: str) -> list[dict]:
    """Return conservative, canonical numeric facts with spans in normalized text."""
    normalized = _grounded_normalize(text)
    mentions: list[dict] = []

    for pattern in _DATE_PATTERNS:
        for match in pattern.finditer(normalized):
            if any(match.start() < item["end"] and match.end() > item["start"] for item in mentions):
                continue
            mention = _date_mention(match)
            if mention:
                mentions.append(mention)

    for match in _NUMERIC_EXPRESSION_PATTERN.finditer(normalized):
        if any(match.start() < item["end"] and match.end() > item["start"] for item in mentions):
            continue
        value = _decimal_value(match.group("number"))
        if value is None:
            continue
        scale = match.group("scale")
        unit = match.group("unit")
        currency = _currency_code(match.group("prefix"), unit)
        scale_is_attached = bool(scale and match.start("scale") == match.end("number"))
        if scale and (scale.casefold() not in {"k", "m", "b"} or scale_is_attached or currency):
            value *= _scale_multiplier(scale)
        rendered = _canonical_decimal(value)
        if currency:
            key = f"numcurrency-{currency}-{rendered}"
        elif _is_percent_unit(unit):
            key = f"numpercent-{rendered}"
        else:
            key = f"numnumber-{rendered}"
        display = match.group("number")
        if unit == "%":
            display += "%"
        elif match.group("scale") and match.start("scale") == match.end("number"):
            display += match.group("scale")
        mentions.append(
            {
                "start": match.start(),
                "end": match.end(),
                "display": display,
                "literal": match.group(0).strip(),
                "key": key,
            }
        )

    return sorted(mentions, key=lambda item: (item["start"], item["end"]))


def _numeric_fact_keys(text: str) -> set[str]:
    return {mention["key"] for mention in _numeric_mentions(text)}


def _normalize_quote_chars(text: str) -> str:
    """Normalize quote characters, dashes, and whitespace for resilient matching."""
    text = unicodedata.normalize("NFKC", text).replace("\u00ad", "")
    text = re.sub(r"[\u201c\u201d\u00ab\u00bb\u201e\u201f\u300c\u300d]", '"', text)
    text = re.sub(r"[\u2018\u2019\u201a\u201b]", "'", text)
    text = re.sub(r"[\u2013\u2014]", "-", text)
    return re.sub(r"\s+", " ", text).strip().casefold()


def _quote_normalization_variants(text: str) -> tuple[str, ...]:
    """Normalize PDF/DOCX line-break hyphenation without erasing semantic hyphens."""
    text = unicodedata.normalize("NFKC", text).replace("\u00ad", "")
    line_hyphen = r"(?<=[^\W\d_])-\s*(?:\r\n?|\n)\s*(?=[^\W\d_])"
    raw_variants = {text, re.sub(line_hyphen, "", text), re.sub(line_hyphen, "-", text)}
    return tuple(sorted({_normalize_quote_chars(variant) for variant in raw_variants}))


def _quote_matches_source(quote_text: str, source_text: str) -> bool:
    """Check whether a quoted fragment appears in source text.

    Supports:
    1. Verbatim exact normalized substring.
    2. Typographical quote and dash normalization.
    3. Ellipsis-separated fragments (e.g. 'part 1 ... part 2' or 'part 1 … part 2').
       Each non-empty segment must appear in chronological order in the source text.
    """
    if not quote_text or not source_text:
        return False

    for norm_quote in _quote_normalization_variants(quote_text):
        for norm_source in _quote_normalization_variants(source_text):
            if norm_quote in norm_source:
                return True

            ellipsis_parts = [p.strip() for p in re.split(r"\s*(?:\.{3,}|…)\s*", norm_quote) if p.strip()]
            if len(ellipsis_parts) > 1:
                current_idx = 0
                matched_all = True
                for part in ellipsis_parts:
                    found_idx = norm_source.find(part, current_idx)
                    if found_idx == -1:
                        matched_all = False
                        break
                    current_idx = found_idx + len(part)
                if matched_all:
                    return True

    return False


def _grounded_content_terms(text: str) -> list[str]:
    """Unique content-bearing terms of a normalized text, in first-seen order.

    Keeps numeric tokens of any length; drops stopwords and alphabetic tokens
    shorter than 3 characters.
    """
    # ``[^\W_]`` is the Unicode-aware equivalent of an alphanumeric token
    # character without underscore. The previous ASCII-only expression silently
    # discarded Cyrillic and Arabic text, making even a verbatim claim/source
    # pair score 0.0. Keep punctuation only when it joins token characters so
    # values such as ``9.9`` and ``62%`` retain the existing numeric behavior.
    normalized = _grounded_normalize(text)
    numeric_mentions = _numeric_mentions(normalized)
    placeholders: dict[str, str] = {}
    chunks: list[str] = []
    cursor = 0
    for index, mention in enumerate(numeric_mentions):
        placeholder = f"zznumeric{index}zz"
        placeholders[placeholder] = mention["key"]
        chunks.extend((normalized[cursor : mention["start"]], f" {placeholder} "))
        cursor = mention["end"]
    chunks.append(normalized[cursor:])
    lexical_text = "".join(chunks)
    tokens = re.findall(r"[^\W_]+(?:[.\-][^\W_]+)*(?:%)?", lexical_text, flags=re.UNICODE)
    terms: list[str] = []
    seen: set[str] = set()
    for token in tokens:
        token = token.strip(".-")
        token = placeholders.get(token, token)
        if not token or token in seen or token in _GROUNDED_CHECK_STOPWORDS:
            continue
        if not any(ch.isdigit() for ch in token) and len(token) < 3:
            continue
        seen.add(token)
        terms.append(token)
    return terms


_RUSSIAN_INFLECTION_SUFFIXES = tuple(
    sorted(
        {
            "иями",
            "ями",
            "ами",
            "ией",
            "ого",
            "ему",
            "ому",
            "ими",
            "ыми",
            "иях",
            "ах",
            "ях",
            "ов",
            "ев",
            "ей",
            "ой",
            "ий",
            "ый",
            "ая",
            "яя",
            "ое",
            "ее",
            "ие",
            "ые",
            "ью",
            "ия",
            "ии",
            "ию",
            "ием",
            "ам",
            "ям",
            "ом",
            "ем",
            "у",
            "ю",
            "а",
            "я",
            "ы",
            "и",
            "е",
            "о",
        },
        key=len,
        reverse=True,
    )
)


def _matching_term(term: str) -> str:
    """Return a conservative deterministic key for lexical comparison.

    Numeric facts and non-Latin/Cyrillic tokens remain exact. English folding
    covers common plural and verbal suffixes; Russian folding removes a bounded
    set of inflectional endings only when at least four characters remain. The
    original term is still retained for reviewer-facing diagnostics.
    """
    if term.startswith(("numnumber-", "numdate-", "numpercent-", "numcurrency-")):
        return term

    if re.fullmatch(r"[a-z]+", term):
        if len(term) > 5 and term.endswith("ies"):
            return term[:-3] + "y"
        if len(term) > 6 and term.endswith("ing"):
            return term[:-3]
        if len(term) > 5 and term.endswith("ed"):
            if term.endswith(("ated", "ved", "ized")):
                return term[:-1]
            return term[:-2]
        if len(term) > 5 and term.endswith("es") and not term.endswith(("ses", "xes")):
            return term[:-2]
        if len(term) > 4 and term.endswith("s") and not term.endswith(("ss", "us", "is")):
            return term[:-1]
        return term

    if re.fullmatch(r"[а-яё]+", term):
        for suffix in _RUSSIAN_INFLECTION_SUFFIXES:
            if term.endswith(suffix) and len(term) - len(suffix) >= 4:
                return term[: -len(suffix)]
    return term


def _matching_terms(text: str) -> tuple[list[str], dict[str, str]]:
    """Return ordered matching keys and their first reviewer-facing terms."""
    keys: list[str] = []
    displays: dict[str, str] = {}
    numeric_displays = {mention["key"]: mention["display"] for mention in _numeric_mentions(text)}
    for term in _grounded_content_terms(text):
        key = _matching_term(term)
        if key not in displays:
            keys.append(key)
            displays[key] = numeric_displays.get(term, term)
    return keys, displays


@dataclass(frozen=True)
class GroundingMatch:
    """Observable result of matching one claim through a :class:`GroundingIndex`."""

    document_id: Optional[str]
    coverage: float
    missing_terms: tuple[str, ...]
    unmatched_numbers: tuple[str, ...]
    best_sentence: str
    best_passage: str


@dataclass(frozen=True)
class _IndexedDocument:
    text: str
    terms: frozenset[str]
    numeric_facts: frozenset[str]
    sentences: tuple[str, ...]
    sentence_terms: tuple[frozenset[str], ...]


class GroundingIndex:
    """Pre-tokenized deterministic corpus with one claim-matching interface.

    Document normalization, morphology, numeric facts, sentence tokenization,
    document frequency, and passage selection are computed once per check run.
    Callers provide a claim and an optional subset of document IDs and receive
    the complete lexical diagnostic needed by the public service contracts.
    """

    def __init__(self, documents: Mapping[str, str]) -> None:
        indexed: dict[str, _IndexedDocument] = {}
        frequencies: dict[str, int] = {}
        for document_id, text in documents.items():
            terms, _ = _matching_terms(text)
            term_set = frozenset(terms)
            sentences = tuple(_grounded_sentences(text))
            sentence_terms = tuple(frozenset(_matching_terms(sentence)[0]) for sentence in sentences)
            indexed[document_id] = _IndexedDocument(
                text=text,
                terms=term_set,
                numeric_facts=frozenset(_numeric_fact_keys(text)),
                sentences=sentences,
                sentence_terms=sentence_terms,
            )
            for term in term_set:
                frequencies[term] = frequencies.get(term, 0) + 1

        document_count = len(indexed)
        self._documents = indexed
        self._weights = {
            term: 1.0 + math.log((document_count + 1) / (frequency + 1)) for term, frequency in frequencies.items()
        }

    def _weight(self, term: str) -> float:
        # A claim term absent from the corpus is maximally rare. This prevents a
        # missing critical entity from being diluted by generic shared terms.
        if len(self._documents) <= 1:
            return 1.0
        return self._weights.get(term, 1.0 + math.log(len(self._documents) + 1))

    def _weighted_overlap(self, claim_terms: set[str], document_terms: frozenset[str]) -> float:
        denominator = sum(self._weight(term) for term in claim_terms)
        if not denominator:
            return 0.0
        numerator = sum(self._weight(term) for term in claim_terms & document_terms)
        return numerator / denominator

    def _best_sentence(self, document: _IndexedDocument, claim_terms: set[str]) -> str:
        best_sentence = ""
        best_score = 0.0
        for sentence, sentence_terms in zip(document.sentences, document.sentence_terms):
            score = sum(self._weight(term) for term in claim_terms & sentence_terms)
            if score > best_score:
                best_score = score
                best_sentence = sentence
        return best_sentence

    def _best_passage(self, document: _IndexedDocument, claim_terms: set[str], window: int = 3) -> str:
        best_excerpt = ""
        best_score = 0.0
        for start in range(len(document.sentences)):
            end = min(len(document.sentences), start + window)
            passage_terms = frozenset().union(*document.sentence_terms[start:end])
            score = sum(self._weight(term) for term in claim_terms & passage_terms)
            if score > best_score:
                best_score = score
                best_excerpt = " ".join(document.sentences[start:end])
        if len(best_excerpt) > 300:
            best_excerpt = best_excerpt[:297].rstrip() + "..."
        return best_excerpt

    def match(self, claim_text: str, document_ids: Optional[Iterable[str]] = None) -> GroundingMatch:
        """Match a claim against all documents or a caller-selected subset."""
        candidate_ids = list(self._documents) if document_ids is None else list(document_ids)
        candidate_ids = [document_id for document_id in candidate_ids if document_id in self._documents]
        ordered_terms, displays = _matching_terms(claim_text)
        claim_terms = set(ordered_terms)

        best_document_id: Optional[str] = None
        best_coverage = 0.0
        for document_id in candidate_ids:
            coverage = self._weighted_overlap(claim_terms, self._documents[document_id].terms)
            if coverage > best_coverage or best_document_id is None:
                best_document_id = document_id
                best_coverage = coverage

        best_terms = self._documents[best_document_id].terms if best_document_id is not None else frozenset()
        missing_terms = tuple(displays[term] for term in ordered_terms if term not in best_terms)

        candidate_numeric_facts: set[str] = set()
        for document_id in candidate_ids:
            candidate_numeric_facts.update(self._documents[document_id].numeric_facts)
        unmatched_numbers = tuple(
            sorted(
                {
                    mention["display"]
                    for mention in _numeric_mentions(claim_text)
                    if mention["key"] not in candidate_numeric_facts
                }
            )
        )

        best_sentence = ""
        best_passage = ""
        if best_document_id is not None and best_coverage > 0:
            document = self._documents[best_document_id]
            best_sentence = self._best_sentence(document, claim_terms)
            best_passage = self._best_passage(document, claim_terms)

        return GroundingMatch(
            document_id=best_document_id,
            coverage=best_coverage,
            missing_terms=missing_terms,
            unmatched_numbers=unmatched_numbers,
            best_sentence=best_sentence,
            best_passage=best_passage,
        )


_POLARITY_CUE_PATTERN = re.compile(
    r"\b(?:not|no|never|none|neither|nor|without|cannot|can't|won't|doesn't|don't|didn't"
    r"|isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't|shouldn't|wouldn't|couldn't"
    r"|denied|rejected|refused|declined|lacks|lacked|absent|ceased|suspended|terminated"
    r"|failed to|unable to|no longer"
    r"|не|нет|никогда|без|нельзя|невозможно|отклонил|отклонила|отклонили|отклонено"
    r"|отказал|отказала|отказали|приостановил|приостановила|приостановили|прекратил|прекратили"
    r"|لا|لم|لن|ليس|ليست|بدون|رفض|رفضت|رفضوا)\b"
)


def _grounded_best_sentence(sentences: list[str], claim_terms: set[str]) -> str:
    """The single sentence with the highest claim-term overlap.

    Polarity is compared at sentence scope, not over the multi-sentence excerpt
    window: a neighbouring sentence that negates something else in the same
    document must not be read as negating this claim.
    """
    best_sentence = ""
    best_hits = 0
    for sentence in sentences:
        hits = len(claim_terms & set(_grounded_content_terms(sentence)))
        if hits > best_hits:
            best_hits = hits
            best_sentence = sentence
    return best_sentence


def _polarity_cues(text: str) -> set[str]:
    """Negation and denial cues in a text.

    Read on the normalized text rather than on content terms: the tokenizer
    treats ``not`` and ``no`` as stopwords and drops them, so a claim and its
    source can share every content term while asserting opposite things.
    """
    return set(_POLARITY_CUE_PATTERN.findall(_grounded_normalize(text)))


def _bounded_quote_difference(expected: str, actual: str, *, limit: int = 240) -> str:
    changes = [part for part in difflib.ndiff(expected.split(), actual.split()) if part.startswith(("- ", "+ "))]
    rendered = " ".join(changes) or "character-level difference"
    if len(rendered) > limit:
        return rendered[: limit - 3].rstrip() + "..."
    return rendered


def _quote_near_miss(quote_text: str, source_text: str, *, threshold: float = 0.95) -> dict | None:
    """Find a conservative typo-level candidate while preserving an absent verdict.

    Numeric facts and polarity cues must be identical. This prevents a highly
    similar quote with a changed amount, date, percentage, currency, or negation
    from being presented as a harmless transcription near miss.
    """
    quote = _normalize_quote_chars(quote_text)
    if len(quote) < 20 or len(quote) > 2000:
        return None

    quote_numbers = _numeric_fact_keys(quote)
    quote_polarity = _polarity_cues(quote)
    anchors = sorted(
        ((match.group(0), match.start()) for match in re.finditer(r"[^\W_]{3,}", quote, flags=re.UNICODE)),
        key=lambda item: len(item[0]),
        reverse=True,
    )[:8]
    if not anchors:
        return None

    max_delta = min(24, max(2, int(len(quote) * (1.0 - threshold)) + 2))
    best_ratio = 0.0
    best_candidate = ""

    for source in _quote_normalization_variants(source_text):
        checked: set[tuple[int, int]] = set()
        for anchor, anchor_offset in anchors:
            search_from = 0
            occurrences = 0
            while occurrences < 24:
                occurrence = source.find(anchor, search_from)
                if occurrence < 0:
                    break
                occurrences += 1
                search_from = occurrence + max(1, len(anchor))
                expected_start = occurrence - anchor_offset
                for start_delta in range(-max_delta, max_delta + 1):
                    start = max(0, expected_start + start_delta)
                    for length_delta in range(-max_delta, max_delta + 1):
                        length = len(quote) + length_delta
                        if length <= 0 or start + length > len(source):
                            continue
                        bounds = (start, start + length)
                        if bounds in checked:
                            continue
                        checked.add(bounds)
                        candidate = source[start : start + length].strip()
                        if _numeric_fact_keys(candidate) != quote_numbers:
                            continue
                        if _polarity_cues(candidate) != quote_polarity:
                            continue
                        ratio = difflib.SequenceMatcher(None, quote, candidate).ratio()
                        if ratio > best_ratio:
                            best_ratio = ratio
                            best_candidate = candidate

    if best_ratio < threshold:
        return None
    return {
        "similarity": round(best_ratio, 3),
        "difference": _bounded_quote_difference(quote, best_candidate),
    }


def _quote_check(quote_text: str, source_text: str) -> dict:
    if _quote_matches_source(quote_text, source_text):
        return {"status": "present"}
    near_miss = _quote_near_miss(quote_text, source_text)
    if near_miss:
        return {"status": "absent", "near_miss": near_miss}
    return {"status": "absent"}


def _grounded_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?؟])\s+|\n+", text)
    return [p.strip() for p in parts if p.strip()]


def _grounded_best_passage(sentences: list[str], claim_terms: set[str], window: int = 3) -> str:
    """Window of consecutive sentences with the highest claim-term overlap."""
    best_excerpt = ""
    best_hits = 0
    for start in range(len(sentences)):
        chunk = " ".join(sentences[start : start + window])
        chunk_terms = set(_grounded_content_terms(chunk))
        hits = len(claim_terms & chunk_terms)
        if hits > best_hits:
            best_hits = hits
            best_excerpt = chunk
    if len(best_excerpt) > 300:
        best_excerpt = best_excerpt[:297].rstrip() + "..."
    return best_excerpt
