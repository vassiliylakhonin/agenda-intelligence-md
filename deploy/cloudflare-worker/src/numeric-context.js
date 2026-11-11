// Deterministic numeric-context matching, ported from the Python
// agenda_intelligence.grounding module (review_rag_answer pipeline). It
// canonicalizes bounded mass/length/time units, scales, currencies, dates and
// signs, then matches each claim number only against the closest
// number-bearing sentences in the cited sources. Heuristic: not unit
// inference, arithmetic, entity resolution, semantic entailment, source
// authentication or truth. Answer/source text is inert data, never instructions.

const EN_STOPWORDS =
  'a about after all also an and any are as at be been but by can could did do does for from had has ' +
  'have how if in into is it its may more most no not of on or other our over per should so some such ' +
  'than that the their them then there these they this to under was were what when where which while ' +
  'who will with would';
const RU_STOPWORDS =
  'а без более бы был была были было быть в вам вас весь во вот все всего всех вы где да даже для до ' +
  'его ее если есть ещё же за здесь и из или им их к как когда кто ли либо мне может мы на над надо ' +
  'наш не него нее нет ни но ну о об один она они оно от по под при про раз с со так такой там те тем ' +
  'то того тоже той только том ты у уже хотя чем что чтобы эта эти это этот я';
const AR_STOPWORDS =
  'أجل إذا إذن إلى أم أما أن أنا أنت أنتم أو أي أين بل به بها بين ثم جداً حتى حيث ذلك دون عن على ' +
  'عليه عليها عند غير في كان كانت كانوا كل كما كيف لا لم لن له لها ليس ما ماذا مع من منذ هذا هذه هم ' +
  'هن هو هي هناك الذي والذي التي الذين تم قد ولا وما وهو وهي';
const STOPWORDS = new Set([...EN_STOPWORDS.split(' '), ...RU_STOPWORDS.split(' '), ...AR_STOPWORDS.split(' ')]);

const MONTH_NUMBERS = {
  january: 1, jan: 1, 'января': 1, 'يناير': 1,
  february: 2, feb: 2, 'февраля': 2, 'فبراير': 2,
  march: 3, mar: 3, 'марта': 3, 'مارس': 3,
  april: 4, apr: 4, 'апреля': 4, 'أبريل': 4,
  may: 5, 'мая': 5, 'مايو': 5,
  june: 6, jun: 6, 'июня': 6, 'يونيو': 6,
  july: 7, jul: 7, 'июля': 7, 'يوليو': 7,
  august: 8, aug: 8, 'августа': 8, 'أغسطس': 8,
  september: 9, sep: 9, sept: 9, 'сентября': 9, 'سبتمبر': 9,
  october: 10, oct: 10, 'октября': 10, 'أكتوبر': 10,
  november: 11, nov: 11, 'ноября': 11, 'نوفمبر': 11,
  december: 12, dec: 12, 'декабря': 12, 'ديسمبر': 12,
};
const MONTH_PATTERN = Object.keys(MONTH_NUMBERS)
  .sort((a, b) => b.length - a.length)
  .map(month => month.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');
const WORD_BOUNDARY_BEHIND = '(?<![\\p{L}\\p{N}_])';
const WORD_BOUNDARY_AHEAD = '(?![\\p{L}\\p{N}_])';
const DATE_PATTERNS = [
  new RegExp(String.raw`(?<!\d)(?<year>\d{4})-(?<month>\d{1,2})-(?<day>\d{1,2})(?!\d)`, 'gu'),
  new RegExp(String.raw`(?<!\d)(?<day>\d{1,2})\.(?<month>\d{1,2})\.(?<year>\d{4})(?!\d)`, 'gu'),
  new RegExp(String.raw`${WORD_BOUNDARY_BEHIND}(?<day>\d{1,2})\s+(?<monthName>${MONTH_PATTERN})\s*,?\s*(?<year>\d{4})(?!\d)`, 'giu'),
  new RegExp(String.raw`${WORD_BOUNDARY_BEHIND}(?<monthName>${MONTH_PATTERN})\s+(?<day>\d{1,2})\s*,?\s*(?<year>\d{4})(?!\d)`, 'giu'),
];

const NUMBER_PATTERN = String.raw`(?:\d{1,3}(?:[ \u00a0\u202f,_]\d{3})+|\d+(?:[.,]\d+)?)`;
const SCALE_PATTERN =
  String.raw`(?:thousand|million|billion|тыс(?:яч[аиу]?)?|млн|миллион(?:а|ов)?|млрд|миллиард(?:а|ов)?|` +
  String.raw`ألف|مليون|مليار|k|m|b|mn|bn)`;
const UNIT_PATTERN =
  String.raw`(?:%|percent|per\s+cent|процент(?:а|ов)?|بالمائة|في\s+المائة|usd|us\s+dollars?|dollars?|доллар(?:а|ов|ы)?|` +
  String.raw`eur|euros?|евро|gbp|pounds?|фунт(?:а|ов|ы)?|rub|руб(?:\.|ля|лей)?|kzt|₸|тенге)`;
const NUMERIC_EXPRESSION_PATTERN = new RegExp(
  String.raw`${WORD_BOUNDARY_BEHIND}(?<sign>[+\-−])?\s*(?<prefix>[$€£₽₸])?\s*(?<number>[+\-−]?${NUMBER_PATTERN})` +
    String.raw`(?:\s*(?<scale>${SCALE_PATTERN}))?(?:\s*(?<unit>${UNIT_PATTERN}))?${WORD_BOUNDARY_AHEAD}`,
  'giud',
);

// Ordered: the first prefix match wins, mirroring the Python dict order.
const SCALE_MULTIPLIERS = [
  ['k', '1000'], ['thousand', '1000'], ['тыс', '1000'], ['ألف', '1000'],
  ['m', '1000000'], ['mn', '1000000'], ['million', '1000000'], ['млн', '1000000'],
  ['миллион', '1000000'], ['مليون', '1000000'],
  ['b', '1000000000'], ['bn', '1000000000'], ['billion', '1000000000'],
  ['млрд', '1000000000'], ['миллиард', '1000000000'], ['مليار', '1000000000'],
];

// Bounded dimensional normalization, not arbitrary arithmetic or unit inference.
// Unknown units deliberately keep the plain-number behavior.
const MEASURE_UNITS = {
  kg: ['mass', '1000'], kilogram: ['mass', '1000'], kilograms: ['mass', '1000'],
  g: ['mass', '1'], gram: ['mass', '1'], grams: ['mass', '1'],
  mg: ['mass', '0.001'], milligram: ['mass', '0.001'], milligrams: ['mass', '0.001'],
  km: ['length', '1000'], kilometer: ['length', '1000'], kilometers: ['length', '1000'],
  kilometre: ['length', '1000'], kilometres: ['length', '1000'],
  m: ['length', '1'], meter: ['length', '1'], meters: ['length', '1'],
  metre: ['length', '1'], metres: ['length', '1'],
  cm: ['length', '0.01'], centimeter: ['length', '0.01'], centimeters: ['length', '0.01'],
  hour: ['time', '3600'], hours: ['time', '3600'], hr: ['time', '3600'],
  minute: ['time', '60'], minutes: ['time', '60'], min: ['time', '60'],
  second: ['time', '1'], seconds: ['time', '1'], sec: ['time', '1'],
  millisecond: ['time', '0.001'], milliseconds: ['time', '0.001'], ms: ['time', '0.001'],
};
for (const [unit, dimension, factor] of [
  ['килограмм', 'mass', '1000'], ['грамм', 'mass', '1'], ['миллиграмм', 'mass', '0.001'],
  ['километр', 'length', '1000'], ['метр', 'length', '1'],
]) {
  for (const ending of ['', 'а', 'ов', 'ы']) MEASURE_UNITS[unit + ending] = [dimension, factor];
}
const MEASURE_PATTERN = new RegExp(
  String.raw`${WORD_BOUNDARY_BEHIND}(?<number>[+\-−]?${NUMBER_PATTERN})\s*(?<unit>` +
    Object.keys(MEASURE_UNITS).sort((a, b) => b.length - a.length)
      .map(unit => unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') +
    String.raw`)${WORD_BOUNDARY_AHEAD}`,
  'giud',
);

const CURRENCY_SYMBOLS = {'$': 'usd', '€': 'eur', '£': 'gbp', '₽': 'rub', '₸': 'kzt'};

const normalize = text => text.normalize('NFKC').replace(/\u00ad/g, '').replace(/\s+/gu, ' ').trim().toLowerCase();

// Exact decimal as {mantissa: BigInt, exp: number}: value = mantissa * 10^exp.
function parseDecimal(raw) {
  let compact = raw.replace(/[ \u00a0\u202f_]/g, '').replace(/−/g, '-');
  if (compact.includes(',') && compact.includes('.')) {
    if (compact.lastIndexOf('.') > compact.lastIndexOf(',')) compact = compact.replace(/,/g, '');
    else compact = compact.replace(/\./g, '').replace(/,/g, '.');
  } else if (compact.includes(',')) {
    const groups = compact.split(',');
    if (groups.length > 2 || (groups.length === 2 && groups[1].length === 3)) compact = groups.join('');
    else compact = compact.replace(/,/g, '.');
  }
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(compact);
  if (!match) return null;
  const mantissa = BigInt((match[1] === '-' ? '-' : '') + match[2] + (match[3] || ''));
  return {mantissa, exp: -(match[3] || '').length};
}
const multiplyDecimal = (value, factor) =>
  ({mantissa: value.mantissa * factor.mantissa, exp: value.exp + factor.exp});
const decimalFromString = raw => parseDecimal(raw);
function canonicalDecimal(value) {
  if (value.mantissa === 0n) return '0';
  const negative = value.mantissa < 0n;
  let digits = (negative ? -value.mantissa : value.mantissa).toString();
  let rendered;
  if (value.exp >= 0) {
    rendered = digits + '0'.repeat(value.exp);
  } else {
    const point = digits.length + value.exp;
    rendered = point > 0 ? `${digits.slice(0, point)}.${digits.slice(point)}` : `0.${'0'.repeat(-point)}${digits}`;
  }
  if (rendered.includes('.')) rendered = rendered.replace(/0+$/, '').replace(/\.$/, '');
  return (negative ? '-' : '') + (rendered || '0');
}

function scaleMultiplier(scale) {
  if (!scale) return decimalFromString('1');
  const normalized = scale.toLowerCase().replace(/\.+$/, '');
  for (const [prefix, multiplier] of SCALE_MULTIPLIERS) {
    if (normalized === prefix || normalized.startsWith(prefix)) return decimalFromString(multiplier);
  }
  return decimalFromString('1');
}

function currencyCode(prefix, unit) {
  const prefixCode = CURRENCY_SYMBOLS[prefix || ''];
  const normalized = (unit || '').toLowerCase().replace(/ /g, '').replace(/\.+$/, '');
  let unitCode = null;
  if (/^(usd|dollar|доллар)/u.test(normalized)) unitCode = 'usd';
  else if (/^(eur|euro|евро)/u.test(normalized)) unitCode = 'eur';
  else if (/^(gbp|pound|фунт)/u.test(normalized)) unitCode = 'gbp';
  else if (/^(rub|руб)/u.test(normalized)) unitCode = 'rub';
  else if (/^(kzt|₸|тенге)/u.test(normalized)) unitCode = 'kzt';
  if (prefixCode && unitCode && prefixCode !== unitCode) return `conflict-${prefixCode}-${unitCode}`;
  return prefixCode || unitCode || null;
}

const isPercentUnit = unit => {
  const normalized = (unit || '').toLowerCase().replace(/ /g, '');
  return normalized === '%' || /^(percent|процент|بالمائة|فيالمائة)/u.test(normalized);
};

function dateMention(match) {
  const groups = match.groups;
  let month;
  if (groups.month) month = parseInt(groups.month, 10);
  else month = MONTH_NUMBERS[(groups.monthName || '').toLowerCase()];
  const year = parseInt(groups.year, 10);
  const day = parseInt(groups.day, 10);
  if (!month || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  const iso = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  return {start: match.index, end: match.index + match[0].length, display: match[0].trim(), literal: match[0].trim(), key: `numdate-${iso}`};
}

export function numericMentions(text) {
  const normalized = normalize(text);
  const mentions = [];
  const overlaps = (start, end) => mentions.some(item => start < item.end && end > item.start);

  for (const match of normalized.matchAll(MEASURE_PATTERN)) {
    const start = match.index;
    const end = start + match[0].length;
    if (start > 0 && '$€£₽₸'.includes(normalized[start - 1])) continue;
    // "5m USD" remains a currency scale, not a length.
    if (/^\s*(?:usd|eur|gbp|rub|kzt|dollars?|euros?)\b/iu.test(normalized.slice(end))) continue;
    const value = parseDecimal(match.groups.number);
    if (!value) continue;
    const [dimension, factor] = MEASURE_UNITS[match.groups.unit.toLowerCase()];
    mentions.push({start, end, display: match[0].trim(), literal: match[0].trim(),
      key: `nummeasure-${dimension}-${canonicalDecimal(multiplyDecimal(value, decimalFromString(factor)))}`});
  }

  for (const pattern of DATE_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of normalized.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      if (overlaps(start, end)) continue;
      const mention = dateMention(match);
      if (mention) mentions.push(mention);
    }
  }

  for (const match of normalized.matchAll(NUMERIC_EXPRESSION_PATTERN)) {
    const start = match.index;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    const groups = match.groups;
    const indices = match.indices.groups;
    const signedNumber = (groups.sign || '') + groups.number;
    let value = parseDecimal(signedNumber);
    if (!value) continue;
    const scale = groups.scale;
    const unit = groups.unit;
    const currency = currencyCode(groups.prefix, unit);
    const scaleIsAttached = Boolean(scale && indices.scale[0] === indices.number[1]);
    if (scale && (!['k', 'm', 'b'].includes(scale.toLowerCase()) || scaleIsAttached || currency)) {
      value = multiplyDecimal(value, scaleMultiplier(scale));
    }
    const preceding = normalized.slice(Math.max(0, start - 12), start);
    if (/(?:negative|minus|отрицательн[\p{L}\p{N}_]*)\s*$/u.test(preceding)) {
      value = {mantissa: value.mantissa < 0n ? value.mantissa : -value.mantissa, exp: value.exp};
    }
    const rendered = canonicalDecimal(value);
    let key;
    if (currency) key = `numcurrency-${currency}-${rendered}`;
    else if (isPercentUnit(unit)) key = `numpercent-${rendered}`;
    else key = `numnumber-${rendered}`;
    let display = signedNumber;
    if (unit === '%') display += '%';
    else if (scale && indices.scale[0] === indices.number[1]) display += scale;
    mentions.push({start, end, display, literal: match[0].trim(), key});
  }

  return mentions.sort((a, b) => a.start - b.start || a.end - b.end);
}

export const numericFactKeys = text => new Set(numericMentions(text).map(mention => mention.key));

const NUMERIC_KEY_PREFIXES = ['numnumber-', 'numdate-', 'numpercent-', 'numcurrency-', 'nummeasure-'];
const isNumericKey = term => NUMERIC_KEY_PREFIXES.some(prefix => term.startsWith(prefix));

function contentTerms(text) {
  const normalized = normalize(text);
  const mentions = numericMentions(normalized);
  const placeholders = {};
  const chunks = [];
  let cursor = 0;
  mentions.forEach((mention, index) => {
    const placeholder = `zznumeric${index}zz`;
    placeholders[placeholder] = mention.key;
    chunks.push(normalized.slice(cursor, mention.start), ` ${placeholder} `);
    cursor = mention.end;
  });
  chunks.push(normalized.slice(cursor));
  const lexicalText = chunks.join('');
  const terms = [];
  const seen = new Set();
  for (const match of lexicalText.matchAll(/[\p{L}\p{N}]+(?:[.\-][\p{L}\p{N}]+)*%?/gu)) {
    let token = match[0].replace(/^[.\-]+|[.\-]+$/g, '');
    token = placeholders[token] || token;
    if (!token || seen.has(token) || STOPWORDS.has(token)) continue;
    if (!/\d/u.test(token) && token.length < 3) continue;
    seen.add(token);
    terms.push(token);
  }
  return terms;
}

const RUSSIAN_INFLECTION_SUFFIXES = [
  'иями', 'ями', 'ами', 'ией', 'ого', 'ему', 'ому', 'ими', 'ыми', 'иях', 'ах', 'ях',
  'ов', 'ев', 'ей', 'ой', 'ий', 'ый', 'ая', 'яя', 'ое', 'ее', 'ие', 'ые', 'ью',
  'ия', 'ии', 'ию', 'ием', 'ам', 'ям', 'ом', 'ем', 'у', 'ю', 'а', 'я', 'ы', 'и', 'е', 'о',
];

function matchingTerm(term) {
  // Numeric facts and non-Latin/Cyrillic tokens remain exact. English folding
  // covers common plural and verbal suffixes; Russian folding removes a bounded
  // set of inflectional endings only when at least four characters remain.
  if (isNumericKey(term)) return term;
  if (/^[a-z]+$/u.test(term)) {
    if (term.length > 5 && term.endsWith('ies')) return `${term.slice(0, -3)}y`;
    if (term.length > 6 && term.endsWith('ing')) return term.slice(0, -3);
    if (term.length > 5 && term.endsWith('ed')) {
      if (term.endsWith('ated') || term.endsWith('ved') || term.endsWith('ized')) return term.slice(0, -1);
      return term.slice(0, -2);
    }
    if (term.length > 5 && term.endsWith('es') && !term.endsWith('ses') && !term.endsWith('xes')) return term.slice(0, -2);
    if (term.length > 4 && term.endsWith('s') && !term.endsWith('ss') && !term.endsWith('us') && !term.endsWith('is')) {
      return term.slice(0, -1);
    }
    return term;
  }
  if (/^[а-яё]+$/u.test(term)) {
    for (const suffix of RUSSIAN_INFLECTION_SUFFIXES) {
      if (term.endsWith(suffix) && term.length - suffix.length >= 4) return term.slice(0, -suffix.length);
    }
  }
  return term;
}

function matchingTerms(text) {
  const keys = [];
  const displays = {};
  const numericDisplays = {};
  for (const mention of numericMentions(text)) numericDisplays[mention.key] = mention.display;
  for (const term of contentTerms(text)) {
    const key = matchingTerm(term);
    if (!(key in displays)) {
      keys.push(key);
      displays[key] = numericDisplays[term] || term;
    }
  }
  return [keys, displays];
}

// Separate explicit numeric coordinations, retaining nonnumeric context. Only
// split when both sides already carry numbers; no missing subject is inferred.
function numericClauses(text) {
  const parts = text.split(/;|(?<![\p{L}\p{N}_])(?:and|but|и|но)(?![\p{L}\p{N}_])/u);
  if (parts.length > 1 && parts.every(part => numericMentions(part).length)) return parts;
  return [text];
}

// Keep wrapped prose and table headers with their local evidence context.
// Blank paragraphs, bullets, headings and fenced code separate contexts.
// Table rows receive only their own column labels, never another row's facts.
function groundedContexts(text) {
  const lines = text.split(/\r\n|\r|\n/u);
  const blocks = [];
  let paragraph = [];

  const flush = () => {
    if (paragraph.length) {
      const markdown = paragraph.some(line => line.includes('**') || /\]\([^)]*\)/u.test(line));
      if (markdown) blocks.push([paragraph.join(' '), []]);
      else for (const line of paragraph) blocks.push([line, []]);
      paragraph = [];
    }
  };
  const cells = line => line.trim().replace(/^\|+|\|+$/g, '').split('|').map(cell => cell.trim());

  let index = 0;
  let fenced = false;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (line.startsWith('```') || line.startsWith('~~~')) {
      flush();
      fenced = !fenced;
      index += 1;
      continue;
    }
    if (fenced) {
      flush();
      if (line) blocks.push([line, []]);
      index += 1;
      continue;
    }
    if (index + 1 < lines.length && line.includes('|')) {
      const headers = cells(line);
      const divider = cells(lines[index + 1]);
      if (
        headers.length > 1 &&
        headers.length === divider.length &&
        divider.every(value => /^:?-{3,}:?$/u.test(value))
      ) {
        flush();
        index += 2;
        while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
          const row = cells(lines[index]);
          if (row.length !== headers.length) break;
          const rowText = headers.map((header, cellIndex) => `${header}: ${row[cellIndex]}`).join('; ');
          blocks.push([rowText, matchingTerms(row[0])[0]]);
          index += 1;
        }
        continue;
      }
    }
    if (!line) {
      flush();
    } else if (/^(?:#{1,6}\s|[-*+]\s|\d+[.)]\s)/u.test(line)) {
      flush();
      paragraph.push(line);
    } else if (line.includes('|')) {
      flush();
      blocks.push([line, []]);
    } else {
      if (paragraph.length && /^[A-ZА-ЯЁ0-9]/u.test(line)) flush();
      paragraph.push(line);
    }
    index += 1;
  }
  flush();
  const contexts = [];
  for (const [block, anchors] of blocks) {
    for (const part of block.split(/(?<=[.!?؟])\s+/u)) {
      if (part.trim()) contexts.push([part.trim(), anchors]);
    }
  }
  return contexts;
}

const isSubset = (subset, superset) => [...subset].every(item => superset.has(item));
const difference = (left, right) => new Set([...left].filter(item => !right.has(item)));

export class NumericCorpus {
  // Pre-tokenized deterministic corpus. Documents are caller-supplied source
  // excerpts; matching compares a claim's numbers with the closest
  // number-bearing contexts of the cited subset only.
  constructor(documents) {
    this.documents = {};
    const frequencies = {};
    for (const [documentId, text] of Object.entries(documents)) {
      const [terms] = matchingTerms(text);
      const termSet = new Set(terms);
      const contexts = groundedContexts(text);
      const numericContexts = [];
      const tableAnchors = new Set();
      for (const [sentence, anchor] of contexts) {
        for (const term of anchor) tableAnchors.add(term);
        for (const clause of numericClauses(sentence)) {
          numericContexts.push([new Set(matchingTerms(clause)[0]), numericFactKeys(clause), new Set(anchor)]);
        }
      }
      this.documents[documentId] = {terms: termSet, numericContexts, tableAnchors};
      for (const term of termSet) frequencies[term] = (frequencies[term] || 0) + 1;
    }
    const documentCount = Object.keys(this.documents).length;
    this.documentCount = documentCount;
    this.weights = {};
    for (const [term, frequency] of Object.entries(frequencies)) {
      this.weights[term] = 1.0 + Math.log((documentCount + 1) / (frequency + 1));
    }
  }

  weight(term) {
    // A claim term absent from the corpus is maximally rare.
    if (this.documentCount <= 1) return 1.0;
    return this.weights[term] ?? (1.0 + Math.log(this.documentCount + 1));
  }

  weightedOverlap(claimTerms, documentTerms) {
    let denominator = 0;
    for (const term of claimTerms) denominator += this.weight(term);
    if (!denominator) return 0.0;
    let numerator = 0;
    for (const term of claimTerms) if (documentTerms.has(term)) numerator += this.weight(term);
    return numerator / denominator;
  }

  // Numbers a claim asserts that no relevant number-bearing sentence in its
  // cited sources supports. A number elsewhere in the corpus is not support.
  numericSupport(claimText, candidateIds) {
    const candidates = candidateIds.filter(id => id in this.documents);
    const [orderedTerms] = matchingTerms(claimText);
    const claimTerms = new Set(orderedTerms);
    const contextTerms = new Set([...claimTerms].filter(term => !isNumericKey(term)));
    const unmatched = new Set();
    let mentionCount = 0;
    const clauses = claimText.split(/;|(?<=[.!?])\s+|(?<![\p{L}\p{N}_])(?:and|but|и|но)(?![\p{L}\p{N}_])/u);
    for (const clause of clauses) {
      const mentions = numericMentions(clause);
      if (!mentions.length) continue;
      mentionCount += mentions.length;
      const clauseTerms = new Set(matchingTerms(clause)[0]);
      const clauseContext = new Set([...clauseTerms].filter(term => !isNumericKey(term)));
      // Bounded proper-name anchor: "the Coral branch" cannot borrow the value
      // of "the Amber branch". This is not entity resolution.
      const names = new Set(
        [...clause.matchAll(/\b[Tt]he\s+([A-Z][a-z]{2,})\b/gu)].map(match => matchingTerm(match[1].toLowerCase())),
      );
      const scored = [];
      for (const documentId of candidates) {
        const document = this.documents[documentId];
        for (const [terms, numericFacts, anchors] of document.numericContexts) {
          if (anchors.size && !isSubset(anchors, contextTerms)) continue;
          if (names.size && !isSubset(names, terms)) continue;
          const rowContext = anchors.size ? difference(clauseContext, difference(document.tableAnchors, anchors)) : clauseContext;
          const score = rowContext.size ? this.weightedOverlap(rowContext, terms) : 1.0;
          scored.push([score, numericFacts]);
        }
      }
      const bestScore = scored.length ? Math.max(...scored.map(([score]) => score)) : 0.0;
      const facts = new Set();
      for (const [score, numericFacts] of scored) {
        if (score === bestScore && score >= 0.4) for (const fact of numericFacts) facts.add(fact);
      }
      for (const mention of mentions) if (!facts.has(mention.key)) unmatched.add(mention.display);
    }
    return {mentionCount, unmatched: [...unmatched].sort()};
  }
}
