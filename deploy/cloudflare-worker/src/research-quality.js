// Generic evidence assembly, not a regional reasoning method or a truth verdict.
const norm=value=>String(value??'').normalize('NFKC').replace(/\s+/gu,' ').trim();
const same=(a,b)=>norm(a).toLowerCase()===norm(b).toLowerCase();
const keys=(value,names)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===names.length&&names.every(k=>Object.hasOwn(value,k));
const numberPattern=()=>/[-+−]?\d+(?:[ \u00a0\u202f]\d{3}(?!\d))*(?:[.,]\d+)*/gu;
const numbers=text=>[...norm(text).matchAll(numberPattern())];
const years=text=>[...new Set((norm(text).match(/\b(?:19|20)\d{2}\b/gu)??[]))];
const verbalQuantity=text=>/\b(?:hundred|thousand|million|billion|doubled|tripled|twofold|threefold)\b|тысяч|миллион|миллиард|вдвое|втрое|двукрат|трехкрат|трёхкрат|сто процент/iu.test(text);
const isYear=value=>/^(?:19|20)\d{2}$/u.test(value);

export function researchQuestionParts(question) {
  const parts=question.split(/[?？;\n]+/u).map(norm).filter(Boolean);
  if(parts.length>6)parts.splice(5,parts.length-5,parts.slice(5).join('; '));
  return parts.map((text,index)=>({id:'Q'+(index+1),text}));
}

// Explicit space/comma grouping and dot/comma decimals; no scale conversion.
// Canonical values are decimal strings so the output has no locale ambiguity.
export function evidenceNumber(value) {
  const raw=norm(value).replace('−','-');
  if(!/^[-+]?\d+(?: \d{3})*(?:[.,]\d+)*$/u.test(raw))return null;
  let text=raw.replaceAll(' ','');
  if(/^[-+]?\d{1,3}(?:,\d{3})+$/u.test(text))text=text.replaceAll(',','');
  else if(/^[-+]?\d+[,\.]\d{1,6}$/u.test(text))text=text.replace(',','.');
  else if(!/^[-+]?\d+$/u.test(text))return null;
  const [whole,fraction='']=text.replace(/^\+/u,'').split('.');
  if(whole.replace('-','').length>15)return null;
  const digits=fraction.replace(/0+$/u,'');
  const integer=BigInt(whole).toString();
  return (whole.startsWith('-')&&integer==='0'&&digits?'-':'')+integer+(digits?'.'+digits:'');
}
function fixed(value) {
  const negative=value.startsWith('-'),[whole,fraction='']=value.replace('-','').split('.');
  return (negative?-1n:1n)*BigInt(whole+fraction.padEnd(6,'0'));
}
export function percentageChange(baseline,current) {
  const from=fixed(baseline),to=fixed(current);
  if(from<=0n)return null;
  const delta=(to-from)*1000n,abs=delta<0n?-delta:delta;
  const rounded=(abs+from/2n)/from*(delta<0n?-1n:1n);
  if(rounded>10000000000n||rounded< -10000000000n)return null;
  return Number(rounded)/10;
}
function units(text) {
  const found=[];
  for(const [name,pattern] of [['teu',/\bteus?\b/iu],['tonnes',/\b(?:tons?|tonnes?)\b|тонн|тонны/iu],['currency',/\busd\b|\busdc\b|доллар/iu],['percent',/%|percent|процент/iu],['power',/\b[mgk]?wh?\b|квт|мвт/iu]])if(pattern.test(text))found.push(name);
  return found;
}
function unitMentions(text) {
  const pattern=/(?<![\p{L}\p{N}])(?:(?:ths\.|thousand|million|billion|тыс\.?|млн|млрд)\s*)?(?:teus?|tons?|tonnes?|тонн[а-я]*|usdc?|доллар[а-я]*|percent|процент[а-я]*|[mgk]?wh?|квт|мвт|%)(?![\p{L}\p{N}])/giu;
  return [...text.matchAll(pattern)].map(m=>({text:norm(m[0]),start:m.index,end:m.index+m[0].length,kind:units(m[0])[0],scale:/ths\.|thousand|тыс/iu.test(m[0])?1000:/million|млн/iu.test(m[0])?1000000:/billion|млрд/iu.test(m[0])?1000000000:1}));
}
export function measurementOptions(candidates) {
  const values=new Set(),labels=new Set(),periods=new Set(),scopes=new Set();
  for(const item of candidates) {
    for(const m of numbers(item.quote))if(!isYear(m[0]))values.add(norm(m[0]));
    for(const unit of unitMentions(item.quote))labels.add(unit.text);
    for(const year of years(item.quote))periods.add(year);
    const prefix=norm(item.quote.split(/\b(?:19|20)\d{2}\b/u)[0]).replace(/\s+(?:in|for|за|в)$/iu,'').replace(/[:;,-]$/u,'').trim();
    if(prefix.length>=3&&prefix.length<=140&&!numbers(prefix).length)scopes.add(prefix);
  }
  return {values:[...values],units:[...labels],periods:[...periods],scopes:[...scopes]};
}
// Acquisition uses this same bounded syntax signal to prefer a usable annual
// observation over a title or a dense table row. It grants no support verdict.
export function numericContextScore(quote) {
  const text=norm(quote),mentions=unitMentions(text),boundYears=new Set();
  for(const value of numbers(text)) {
    if(isYear(value[0]))continue;
    const year=(text.slice(0,value.index).match(/\b(?:19|20)\d{2}\b/gu)??[]).at(-1);
    if(year&&mentions.some(u=>Math.max(u.start-(value.index+value[0].length),value.index-u.end,0)<=10))boundYears.add(year);
  }
  return boundYears.size>=2?4:boundYears.size?1:0;
}
function numericIssues(claim,quote) {
  const expected=new Set(numbers(quote).map(m=>evidenceNumber(m[0]))),actual=numbers(claim);
  const reasons=[];
  if(actual.some(m=>!expected.has(evidenceNumber(m[0]))))reasons.push('numeric_value_not_in_quote');
  if(actual.length&&units(claim).some(unit=>!units(quote).includes(unit)))reasons.push('unit_not_in_quote');
  return reasons;
}
function stageIssues(claim,quote) {
  return /fully operational|full operation|полностью введ|полностью работа/iu.test(claim)&&/\btrial\b|\bphase\b|\bplanned\b|пробн|фаз|планир/iu.test(quote)?['project_stage_overstatement']:[];
}
function dateOrStageOnly(claim) {
  if(units(claim).length)return false;
  return numbers(claim).every(m=>isYear(m[0])||/phase\s*$|фаз[аы]\s*$|этап[а]?\s*$/iu.test(claim.slice(Math.max(0,m.index-15),m.index))
    ||/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|январ|феврал|март|апрел|мая|июн|июл|август|сентябр|октябр|ноябр|декабр/iu.test(claim.slice(Math.max(0,m.index-12),m.index+15)));
}
function parseMeasurements(items,finding,id) {
  if(!Array.isArray(items)||items.length>2)return {records:[],reasons:['invalid_measurement_records']};
  const records=[],reasons=[];
  for(const [index,item] of items.entries()) {
    if(!keys(item,['value_raw','unit','period','scope','kind'])||!['value_raw','unit','period','scope'].every(k=>typeof item[k]==='string'&&norm(item[k]).length>0&&item[k].length<=140)||!['observed','capacity','planned'].includes(item.kind)) {
      reasons.push('invalid_measurement_records');continue;
    }
    const value=evidenceNumber(item.value_raw),quote=norm(finding.quote),scope=norm(item.scope),unit=norm(item.unit),period=norm(item.period);
    if(/^[-+]?\d{1,3}\.\d{3}$/u.test(norm(item.value_raw))||/^[-+]?\d{1,3},\d{3}$/u.test(norm(item.value_raw))&&/[А-Яа-яЁё]/u.test(unit+scope))reasons.push('measurement_number_format_ambiguous');
    if(value===null||!numbers(quote).some(m=>norm(m[0])===norm(item.value_raw)))reasons.push('measurement_value_not_in_quote');
    if(!units(unit).length)reasons.push('unsupported_measurement_unit');
    if(!quote.toLowerCase().includes(unit.toLowerCase()))reasons.push('measurement_unit_not_in_quote');
    if(scope.length<3||numbers(scope).length||!quote.toLowerCase().includes(scope.toLowerCase()))reasons.push('measurement_scope_not_in_quote');
    if(!isYear(period)||!years(quote).includes(period))reasons.push('measurement_period_not_in_quote');
    // A flat table with both year headers before its values is insufficient.
    // Require the nearest preceding explicit year for each selected occurrence.
    const positions=numbers(quote).filter(m=>norm(m[0])===norm(item.value_raw));
    const yearBound=positions.filter(m=>(quote.slice(0,m.index).match(/\b(?:19|20)\d{2}\b/gu)??[]).at(-1)===period);
    if(!yearBound.length)reasons.push('measurement_period_binding_ambiguous');
    if(!yearBound.some(m=>quote.toLowerCase().indexOf(scope.toLowerCase())>=0&&quote.toLowerCase().indexOf(scope.toLowerCase())<m.index))reasons.push('measurement_scope_binding_ambiguous');
    if(positions.some(m=>/^[kmb](?:\s|$)/iu.test(quote.slice(m.index+m[0].length))))reasons.push('measurement_value_scale_ambiguous');
    const expectedUnit=unitMentions(unit)[0],mentions=unitMentions(quote);
    if(!yearBound.some(m=>{
      const ranked=mentions.map(u=>({...u,distance:Math.max(u.start-(m.index+m[0].length),m.index-u.end,0)})).sort((a,b)=>a.distance-b.distance);
      const nearest=ranked[0];return expectedUnit&&nearest&&nearest.distance<=20&&nearest.kind===expectedUnit.kind&&nearest.scale===expectedUnit.scale;
    }))reasons.push('measurement_unit_binding_or_scale_mismatch');
    if(item.kind==='observed'&&/\bcapacity\b|\bplanned\b|мощност|планир/iu.test(quote))reasons.push('capacity_or_plan_as_observation');
    if(item.kind==='capacity'&&!/\bcapacity\b|мощност/iu.test(quote))reasons.push('measurement_kind_not_in_quote');
    if(item.kind==='planned'&&!/\bplanned\b|\bplan\b|планир/iu.test(quote))reasons.push('measurement_kind_not_in_quote');
    records.push({id:id+'-M'+(index+1),finding_id:id,source_id:finding.source_id,value_raw:norm(item.value_raw),value,unit,period,scope,kind:item.kind});
  }
  if(records.length===2&&(!same(records[0].unit,records[1].unit)||!same(records[0].scope,records[1].scope)||records[0].kind!==records[1].kind))reasons.push('mixed_measurement_scope_or_unit');
  if(records.length===2&&records[0].period===records[1].period)reasons.push('duplicate_measurement_period');
  return {records,reasons:[...new Set(reasons)]};
}
function measurementClaim(records,ru) {
  return (ru?'Показатель «':'Measure “')+records[0].scope+(ru?'»: ':'”: ')+records.map(m=>m.value+' '+m.unit+' ('+m.period+', '+m.kind+')').join('; ')+'.';
}
function comparison(records,id) {
  if(records.length!==2||records.some(m=>m.kind!=='observed')||units(records[0].unit).includes('percent'))return null;
  const [baseline,current]=[...records].sort((a,b)=>a.period.localeCompare(b.period));
  const value=percentageChange(baseline.value,current.value);
  return value===null?null:{id:'C'+id.slice(1),operation:'percentage_change',baseline_measurement_id:baseline.id,current_measurement_id:current.id,value_percent:value,unit:current.unit,scope:current.scope,formula:'(current / baseline - 1) * 100; rounded to 1 decimal'};
}

/** One seam: untrusted model proposals + exact source ledger -> retained facts,
 * reproducible calculations and bounded question coverage. No model retry. */
export function assessResearchQuality({analysis,proposal,payload,input}) {
  const findings=[],reviews=[],measurements=[],calculations=[],retainedIds=[];
  for(const [index,finding] of analysis.findings.entries()) {
    const id='F'+(index+1),item=Array.isArray(proposal.findings)?null:proposal.findings?.[finding.source_id];
    let reasons=stageIssues(finding.claim,finding.quote),records=[];
    if(item?.measurements!==undefined&&!Array.isArray(item.measurements))reasons.push('invalid_measurement_records');
    if(item?.measurements?.length) {
      const parsed=parseMeasurements(item.measurements,finding,id);records=parsed.records;reasons.push(...parsed.reasons);
    }else {
      reasons.push(...numericIssues(finding.claim,finding.quote));
      if(units(finding.claim).length||verbalQuantity(finding.claim)||numbers(finding.claim).length&&!dateOrStageOnly(finding.claim))reasons.push('unbound_numeric_claim');
    }
    const status=reasons.length?'withheld':'retained';
    reviews.push({id,source_id:finding.source_id,status,reason_codes:[...new Set(reasons)]});
    if(status==='withheld')continue;
    findings.push({...finding,claim:records.length?measurementClaim(records,input.language==='ru'):finding.claim});retainedIds.push(id);measurements.push(...records);
    const calculated=comparison(records,id);if(calculated)calculations.push(calculated);
  }
  const interpretations=[],withheldInterpretations=[];
  for(const [index,item] of analysis.interpretations.entries()) {
    if(numbers(item.text).length||verbalQuantity(item.text)){withheldInterpretations.push({index,reason_code:'numeric_interpretation_requires_structured_calculation'});continue;}
    if(item.source_ids.some(source=>!reviews.some(r=>r.source_id===source&&r.status==='retained'))){withheldInterpretations.push({index,reason_code:'interpretation_references_withheld_finding'});continue;}
    interpretations.push(item);
  }
  const ru=input.language==='ru',coverage=researchQuestionParts(input.question).map(part=>{
    const supplied=proposal.coverage?.[part.id],valid=keys(supplied,['status','source_ids','explanation'])&&['answered','gap'].includes(supplied.status)&&Array.isArray(supplied.source_ids)&&supplied.source_ids.length<=4&&new Set(supplied.source_ids).size===supplied.source_ids.length&&supplied.source_ids.every(id=>payload.sources.some(s=>s.id===id))&&typeof supplied.explanation==='string'&&supplied.explanation.trim().length>=12&&supplied.explanation.length<=800&&(!ru||/[\u0400-\u04ff]/u.test(supplied.explanation));
    const reason_codes=[];
    if(!valid)reason_codes.push('missing_or_invalid_coverage');
    const ids=valid?reviews.filter(r=>r.status==='retained'&&supplied.source_ids.includes(r.source_id)).map(r=>r.id):[];
    let status=valid?supplied.status:'unresolved';
    if(status==='answered'&&!ids.length){reason_codes.push('coverage_has_no_retained_finding');status='unresolved';}
    const askedYears=years(part.text),needsComparison=askedYears.length>=2&&/compar|versus|\bvs\b|сравн|измен|change/iu.test(part.text)&&units(input.question).length>0;
    const associated=calculations.filter(c=>ids.some(id=>c.id==='C'+id.slice(1)));
    if(status==='answered'&&needsComparison&&!associated.some(c=>askedYears.every(year=>measurements.some(m=>[c.baseline_measurement_id,c.current_measurement_id].includes(m.id)&&m.period===year)))){reason_codes.push('requested_comparison_not_calculated');status='unresolved';}
    if(status==='answered'&&units(part.text).some(unit=>!(unit==='percent'&&associated.length)&&!measurements.some(m=>ids.includes(m.finding_id)&&units(m.unit).includes(unit)))){reason_codes.push('requested_unit_not_addressed');status='unresolved';}
    if(status==='gap'&&(supplied.explanation.trim().split(/\s+/u).length<4||!supplied.source_ids.length||!/missing|not |cannot|unavailable|insufficient|нет|не |недостат|отсут/iu.test(supplied.explanation))){reason_codes.push('gap_needs_specific_source_and_reason');status='unresolved';}
    if(status==='gap'&&numbers(supplied.explanation).some(m=>!years(input.question).includes(m[0]))){reason_codes.push('gap_contains_unchecked_numbers');status='unresolved';}
    const explanation=reason_codes.length?(ru?'Автоматическая проверка не подтвердила покрытие этого пункта: ':'Automatic checks did not establish coverage: ')+reason_codes.map(code=>qualityReasonText(code,input.language)).join(' '):status==='answered'?(ru?'Пункт связан с проверенными записями: ':'Part references retained records: ')+ids.join(', '):supplied.explanation;
    return {...part,status,finding_ids:ids,calculation_ids:associated.map(c=>c.id),explanation,reason_codes};
  });
  const quality={policy_version:'1.0',status:!findings.length?'blocked':reviews.some(r=>r.status==='withheld')||coverage.some(c=>c.status!=='answered')||withheldInterpretations.length?'incomplete':'checks_passed',
    check_scope:'Exact numeric references, explicit annual measurement context, arithmetic and punctuation-delimited question coverage; not semantic entailment or factual truth.',
    finding_checks:reviews,retained_finding_ids:retainedIds,measurement_records:measurements,calculations,coverage,withheld_interpretations:withheldInterpretations,human_review_required:true};
  return {analysis:{findings,interpretations,open_questions:analysis.open_questions},quality};
}

const reasonLabels={
  numeric_value_not_in_quote:['Число отсутствует в выбранной цитате.','A number is absent from the selected quote.'],
  unit_not_in_quote:['Единица отсутствует в цитате.','The unit is absent from the quote.'],
  unbound_numeric_claim:['Нет проверяемой записи значения, единицы, периода и объекта.','No checked value/unit/period/scope record.'],
  invalid_measurement_records:['Запись измерения неполна или имеет неверную форму.','The measurement record is incomplete or malformed.'],
  unsupported_measurement_unit:['Единица пока не поддерживается этой проверкой.','The unit is not supported by this bounded check.'],
  measurement_number_format_ambiguous:['Десятичный знак или разделитель тысяч неоднозначен.','The decimal or thousands separator is ambiguous.'],
  measurement_value_not_in_quote:['Исходное значение не найдено в цитате.','The original value is absent from the quote.'],
  measurement_unit_not_in_quote:['Обозначение единицы не найдено в цитате.','The unit label is absent from the quote.'],
  measurement_scope_not_in_quote:['Объект измерения не найден в цитате.','The measurement scope is absent from the quote.'],
  measurement_period_not_in_quote:['Год наблюдения не указан в цитате.','The observation year is absent from the quote.'],
  measurement_period_binding_ambiguous:['Фрагмент не позволяет однозначно связать число с годом.','The passage does not bind the value to an explicit preceding year.'],
  measurement_scope_binding_ambiguous:['Объект измерения не указан перед выбранным значением.','The measurement scope does not precede the selected value.'],
  measurement_value_scale_ambiguous:['Сокращение масштаба числа требует ручной проверки.','The numeric scale suffix requires manual review.'],
  measurement_unit_binding_or_scale_mismatch:['Не совпадает ближайшая единица или масштаб числа.','The nearest unit or numeric scale does not match.'],
  capacity_or_plan_as_observation:['Проектная мощность или план представлены как наблюдаемый поток.','Capacity or a plan is presented as an observation.'],
  measurement_kind_not_in_quote:['Цитата не подтверждает указанный тип показателя.','The quote does not identify the declared measurement kind.'],
  mixed_measurement_scope_or_unit:['Смешаны разные объекты, единицы или типы показателей.','Different scopes, units or measurement kinds were mixed.'],
  duplicate_measurement_period:['Для сравнения указан один и тот же год.','The comparison repeats one observation year.'],
  project_stage_overstatement:['Пробная или планируемая стадия представлена как полный ввод.','A trial or planned phase is overstated as full operation.'],
  missing_or_invalid_coverage:['Нет корректного ответа или объяснения пробела по этому пункту.','This part has no valid answer or evidence-gap explanation.'],
  coverage_has_no_retained_finding:['По этому пункту нет сохранённого проверками вывода.','This part has no retained finding.'],
  requested_comparison_not_calculated:['Не собрана сопоставимая пара лет для расчёта.','No supported year pair was assembled for the requested comparison.'],
  requested_unit_not_addressed:['Для запрошенной единицы нет проверенной записи.','A requested unit has no checked measurement record.'],
  gap_needs_specific_source_and_reason:['Нужны конкретный источник и описание недостающих доказательств.','A concrete source and missing-evidence explanation are required.'],
  gap_contains_unchecked_numbers:['Описание пробела содержит непроверенные числа.','The gap explanation contains unchecked numbers.']
};
export function qualityReasonText(code,language='en') {return reasonLabels[code]?.[language==='ru'?0:1]??code;}
