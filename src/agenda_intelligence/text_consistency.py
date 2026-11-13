"""Narrow review diagnostics for altered bounds and confusable spellings.

These rules never normalize a suspicious identifier into accepted support, and
never label a source or claim false. They compare caller-supplied text only.
"""

from __future__ import annotations

import re
import unicodedata

from agenda_intelligence.grounding import _matching_terms, _numeric_mentions

_BOUND = re.compile(
    r"\b(?P<phrase>no\s+more\s+than|no\s+less\s+than|at\s+most|at\s+least|"
    r"не\s+более|не\s+менее|не\s+больше|не\s+меньше)\s+"
    r"(?P<amount>[+\-−]?\d[\d.,]*(?:\s*(?:%|USD|EUR|kg|кг))?)",
    re.IGNORECASE,
)
_UPPER = {"no more than", "at most", "не более", "не больше"}
_BOUND_WORDS = {"no", "more", "less", "than", "at", "most", "least", "не", "более", "менее", "больше", "меньше"}
# Deliberately small visual-confusable set, not transliteration or Unicode's
# complete confusables table. Scope and unsupported scripts stay documented.
_CONFUSABLES = str.maketrans("аеорсухіјкмтнв", "aeopcyxijkmthb")
_WORD = re.compile(r"[^\W\d_]+", re.UNICODE)


def _skeleton(token: str) -> str:
    return unicodedata.normalize("NFC", token).casefold().translate(_CONFUSABLES)


def _mixed(token: str) -> bool:
    names = {unicodedata.name(character, "").split(" ", 1)[0] for character in token if character.isalpha()}
    return "LATIN" in names and "CYRILLIC" in names


def _bounds(text: str) -> list[tuple[str, str]]:
    result = []
    for match in _BOUND.finditer(text):
        numbers = _numeric_mentions(match["amount"])
        if len(numbers) == 1:
            phrase = " ".join(match["phrase"].casefold().split())
            result.append(("upper" if phrase in _UPPER else "lower", numbers[0]["key"]))
    return result


def _context(text: str) -> set[str]:
    without_bounds = _BOUND.sub(" ", text)
    return {
        term for term in _matching_terms(without_bounds)[0] if term not in _BOUND_WORDS and not term.startswith("num")
    }


def consistency_issues(claim: str, source_texts: list[str]) -> list[str]:
    """Flag narrow direction/spelling conflicts in closest local text contexts.

    An exact supporting sentence or matching bound direction is enough to avoid
    a direction flag; unrelated entities must not supply or override a bound.
    Homoglyphs require a distinct confusable spelling in a supplied source. An
    identical mixed-script spelling alone is not suspicious evidence mismatch.
    """
    issues = []
    source_words = {word.casefold() for text in source_texts for word in _WORD.findall(text)}
    by_skeleton: dict[str, set[str]] = {}
    for word in source_words:
        by_skeleton.setdefault(_skeleton(word), set()).add(word)
    for word in _WORD.findall(claim):
        folded = word.casefold()
        if len(word) < 3 or folded in source_words:
            continue
        candidates = by_skeleton.get(_skeleton(word), set())
        if any(_mixed(word) or _mixed(candidate) for candidate in candidates):
            issues.append("lexical_support_confusable_identifier")
            break

    sentences = [
        sentence.strip()
        for text in source_texts
        for sentence in re.split(r"[;\n]|(?<=[.!?])\s+", text)
        if sentence.strip()
    ]
    for clause in re.split(r"[;\n]|(?<=[.!?])\s+", claim):
        bounds = _bounds(clause)
        terms = _context(clause)
        if not bounds or not terms:
            continue
        scored = []
        for sentence in sentences:
            context = _context(sentence)
            score = len(terms & context) / len(terms)
            # Require every capitalized entity anchor if one is explicitly
            # introduced by 'The'. Never borrow Coral's bound from Amber.
            names = set(re.findall(r"\b[Tt]he\s+([A-Z][a-z]{2,})\b", clause))
            if names and not all(re.search(r"\b" + re.escape(name) + r"\b", sentence) for name in names):
                continue
            if score >= 0.6:
                scored.append((score, _bounds(sentence)))
        best = max((score for score, _ in scored), default=0)
        closest = {bound for score, candidates in scored if score == best for bound in candidates}
        if any(
            (direction, number) not in closest and ("lower" if direction == "upper" else "upper", number) in closest
            for direction, number in bounds
        ):
            issues.append("lexical_support_bound_direction_mismatch")
            break
    return issues
