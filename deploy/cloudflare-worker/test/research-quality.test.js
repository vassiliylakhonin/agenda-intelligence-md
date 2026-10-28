import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessResearchQuality,researchQuestionParts,evidenceNumber,percentageChange} from '../src/research-quality.js';
import {normaliseResearchEvidence,validateResearchAnalysis,researchPrompt,modelAnalysisSchema} from '../src/corridor-research.js';

// Compact, synthetic excerpts model the documented operator cases. They are not
// presented as literal quotations from the live sites or new model-run results.
const routeQuote='A unified train schedule coordinates rail and sea services; the release provides no measured waiting-time reduction.';
const projectQuote='Phase 1 trial operation began on December 25, 2025; capacity is 140k TEU.';
const cargoQuote='Total cargo in 2022: 3,818 thousand tonnes; in 2023: 4,483 thousand tonnes.';
const source=quote=>({id:'S1',title:'Operator acceptance fixture',url:'https://example.invalid/operator',text:quote,provider:'Fixture',provider_id:'fixture',published_at:null,retrieved_at:'2026-10-28T00:00:00Z',freshness:'background',data_integrity_notes:[],content_sha256:'a'.repeat(64),text_sha256:'b'.repeat(64),observation_period:null,effective_date:null,attribution:'Synthetic acceptance fixture'});
const record=(value_raw,period,scope='Total cargo',unit='thousand tonnes')=>({value_raw,unit,period,scope,kind:'observed'});
function run({quote,claim='Численный вывод модели будет собран из записей.',measurements=[],question='Что подтверждает источник?',coverage,interpretations=[]}) {
  const input={question,language:'ru',lookback_days:30},sources=[source(quote)];
  const payload={sources:[{id:'S1',evidence_candidates:[{evidence_id:'S1-Q1',quote}]}]};
  const proposal={findings:{S1:{claim,evidence_id:'S1-Q1',measurements}},interpretations,open_questions:[],coverage:coverage??Object.fromEntries(researchQuestionParts(question).map(p=>[p.id,{status:'answered',source_ids:['S1'],explanation:'Источник позволяет связать этот пункт с конкретным выводом.'}]))};
  const analysis=validateResearchAnalysis(normaliseResearchEvidence(proposal,payload),sources,'ru');
  return assessResearchQuality({analysis,proposal,payload,input});
}
const reasons=result=>result.quality.finding_checks.flatMap(f=>f.reason_codes);

test('route: retain coordination mechanism, report missing measured impact as a specific gap',()=>{
  const result=run({quote:routeQuote,claim:'Единое расписание координирует железнодорожные и морские перевозки.',question:'Как устроена координация? Измерено ли сокращение ожидания?',coverage:{
    Q1:{status:'answered',source_ids:['S1'],explanation:'Источник сообщает о едином расписании перевозок.'},
    Q2:{status:'gap',source_ids:['S1'],explanation:'В публикации нет исходных замеров ожидания и периода наблюдений.'}
  }});
  assert.equal(result.analysis.findings.length,1);assert.equal(result.quality.coverage[1].status,'gap');assert.equal(result.quality.status,'incomplete');
  const overclaim=run({quote:routeQuote,claim:'Расписание сократило ожидание на 2 дня.'});
  assert.equal(overclaim.analysis.findings.length,0);assert.ok(reasons(overclaim).includes('numeric_value_not_in_quote'));assert.equal(overclaim.quality.status,'blocked');
});
test('project: retain explicit trial dates; withhold full operation and capacity-as-throughput claims',()=>{
  const result=run({quote:projectQuote,claim:'Пробная эксплуатация фазы 1 началась 25 декабря 2025 года.'});
  assert.equal(result.quality.status,'checks_passed');assert.equal(result.analysis.findings.length,1);
  const operational=run({quote:projectQuote,claim:'Хаб полностью введён в эксплуатацию в 2025 году.'});
  assert.ok(reasons(operational).includes('project_stage_overstatement'));assert.equal(operational.quality.status,'blocked');
  const throughput=run({quote:projectQuote,measurements:[record('140','2025','capacity','TEU')]});
  assert.ok(reasons(throughput).includes('capacity_or_plan_as_observation'));assert.ok(reasons(throughput).includes('measurement_value_scale_ambiguous'));
});
test('indicators: construct unambiguous cargo observations and calculate the year comparison in code',()=>{
  const result=run({quote:cargoQuote,measurements:[record('3,818','2022'),record('4,483','2023')],question:'Сравни грузооборот в тоннах за 2022 и 2023 годы'});
  assert.equal(result.quality.status,'checks_passed');assert.equal(result.quality.calculations[0].value_percent,17.4);
  assert.match(result.analysis.findings[0].claim,/3818 thousand tonnes \(2022, observed\)/);
  assert.match(result.analysis.findings[0].claim,/4483 thousand tonnes \(2023, observed\)/);
  assert.equal(result.quality.coverage[0].status,'answered');assert.deepEqual(result.quality.coverage[0].calculation_ids,['C1']);
});
test('indicators: container and route subsets have separate units/scopes and their own denominators',()=>{
  for(const [quote,scope,before,after,expected] of [
    ['All containers in 2022: 30,708 TEU; in 2023: 22,780 TEU.','All containers','30,708','22,780',-25.8],
    ['Middle Corridor containers in 2022: 27,094 TEU; in 2023: 16,387 TEU.','Middle Corridor containers','27,094','16,387',-39.5]
  ]) {
    const result=run({quote,measurements:[record(before,'2022',scope,'TEU'),record(after,'2023',scope,'TEU')],question:'Сравни TEU за 2022 и 2023 годы'});
    assert.equal(result.quality.status,'checks_passed');assert.equal(result.quality.calculations[0].value_percent,expected);
  }
});
test('wrong scope, unit, scale and year binding are withheld even when every number exists somewhere',()=>{
  const cases=[
    [[record('3,818','2022','Middle Corridor'),record('4,483','2023','Middle Corridor')],'measurement_scope_not_in_quote'],
    [[record('3,818','2022','Total cargo','TEU'),record('4,483','2023','Total cargo','TEU')],'measurement_unit_not_in_quote'],
    [[record('3,818','2022','Total cargo','tonnes'),record('4,483','2023','Total cargo','tonnes')],'measurement_unit_binding_or_scale_mismatch'],
    [[record('3,818','2023'),record('4,483','2022')],'measurement_period_binding_ambiguous']
  ];
  for(const [measurements,code] of cases){const result=run({quote:cargoQuote,measurements});assert.equal(result.quality.status,'blocked');assert.ok(reasons(result).includes(code),code);}
});
test('flattened headers do not establish which value belongs to which observation year',()=>{
  const result=run({quote:'2023 2022 Total cargo thousand tonnes 4,483 3,818.',measurements:[record('3,818','2022'),record('4,483','2023')]});
  assert.equal(result.quality.status,'blocked');assert.ok(reasons(result).includes('measurement_period_binding_ambiguous'));
});
test('ratios in percent are not relabelled as growth and model arithmetic cannot bypass the calculation ledger',()=>{
  const result=run({quote:'Total cargo in 2023 reached 117 percent of the 2022 level.',measurements:[record('117','2023','Total cargo','percent')],claim:'Грузооборот вырос на 117 процентов.',question:'Сравни показатели в процентах за 2022 и 2023 годы',interpretations:[{text:'Рост составил 117 процентов.',source_ids:['S1']}]});
  assert.equal(result.quality.calculations.length,0);assert.equal(result.analysis.interpretations.length,0);
  assert.ok(!result.analysis.findings[0].claim.includes('вырос'));assert.equal(result.quality.coverage[0].status,'unresolved');
});
test('coverage cannot declare a comparison complete after omitting a baseline or a requested unit',()=>{
  const result=run({quote:cargoQuote,measurements:[record('4,483','2023')],question:'Сравни тонны за 2022 и 2023 годы? Укажи контейнеры в TEU'});
  assert.equal(result.quality.status,'incomplete');assert.equal(result.quality.coverage[0].status,'unresolved');assert.equal(result.quality.coverage[1].status,'unresolved');
  assert.ok(result.quality.coverage[0].reason_codes.includes('requested_comparison_not_calculated'));
  assert.ok(result.quality.coverage[1].reason_codes.includes('requested_unit_not_addressed'));
});
test('empty generic gaps and missing checklist parts do not produce a passing quality status',()=>{
  const result=run({quote:routeQuote,claim:'Источник описывает координацию.',question:'Какие изменения? Какие ограничения?',coverage:{Q1:{status:'gap',source_ids:[],explanation:'Нет данных.'}}});
  assert.equal(result.quality.status,'incomplete');assert.ok(result.quality.coverage.every(q=>q.status==='unresolved'));
});
test('replay of the actual failed numeric acceptance draft is withheld without another model call',()=>{
  const replay=JSON.parse(readFileSync(new URL('../../../tests/fixtures/corridor_research/live_numeric_replay.json',import.meta.url),'utf8'));
  const input={question:replay.question,language:'ru'},payload={sources:[{id:'S1',evidence_candidates:[]}]};
  const result=assessResearchQuality({analysis:replay.analysis,proposal:replay.analysis,payload,input});
  assert.equal(result.analysis.findings.length,0);assert.equal(result.quality.status,'blocked');assert.ok(reasons(result).includes('numeric_value_not_in_quote'));
});
test('annual arithmetic preserves grouping, sign, zero denominator and deterministic one-decimal rounding',()=>{
  for(const [raw,value] of [['4 483','4483'],['3,818','3818'],['17.40','17.4'],['-0.5','-0.5'],['+10','10']])assert.equal(evidenceNumber(raw),value);
  assert.equal(evidenceNumber('177,447,635'),'177447635'); // syntax only, not a truth verdict
  assert.equal(percentageChange('3818','4483'),17.4);assert.equal(percentageChange('30708','22780'),-25.8);
  assert.equal(percentageChange('0','100'),null);assert.equal(percentageChange('-1','100'),null);assert.equal(percentageChange('100','100'),0);
});
test('model contract owns the checklist IDs and bounded measurement shape',()=>{
  const input={question:'Что изменилось? Какие пробелы?',language:'ru',decision_context:'',lookback_days:30};
  const prompt=researchPrompt(input,[source(routeQuote)],Date.UTC(2026,9,28));
  const schema=modelAnalysisSchema(prompt.payload);
  assert.deepEqual(schema.properties.coverage.required,['Q1','Q2']);
  assert.equal(schema.properties.findings.properties.S1.properties.measurements.maxItems,0);
  assert.ok(schema.required.includes('coverage'));
  assert.equal(researchQuestionParts(Array(9).fill('Часть вопроса').join(';')).length,6);
});

test('spelled-out quantities cannot bypass the numeric ledger through a claim or interpretation',()=>{
  const result=run({quote:routeQuote,claim:'Ожидание сократилось вдвое.',interpretations:[{text:'Срок сократился вдвое.',source_ids:['S1']}]});
  assert.equal(result.quality.status,'blocked');assert.ok(reasons(result).includes('unbound_numeric_claim'));assert.equal(result.analysis.interpretations.length,0);
});

test('a percentage-change request is covered by the calculation, not a fabricated percent measurement',()=>{
  const result=run({quote:cargoQuote,measurements:[record('3,818','2022'),record('4,483','2023')],question:'Сравни тонны за 2022 и 2023 годы и рассчитай процент изменения'});
  assert.equal(result.quality.status,'checks_passed');assert.equal(result.quality.calculations[0].value_percent,17.4);
});

test('numeric model choices are restricted to source-owned value, unit, year and scope lexemes',()=>{
  const input={question:'Сравни тонны за 2022 и 2023 годы',language:'ru',decision_context:'',lookback_days:30};
  const prompt=researchPrompt(input,[source(cargoQuote)],Date.UTC(2026,9,28));
  const choices=modelAnalysisSchema(prompt.payload).properties.findings.properties.S1.properties.measurements;
  assert.equal(choices.maxItems,2);assert.ok(choices.items.properties.value_raw.enum.includes('3,818'));
  assert.ok(choices.items.properties.unit.enum.includes('thousand tonnes'));
  assert.deepEqual(choices.items.properties.period.enum,['2022','2023']);
  assert.ok(choices.items.properties.scope.enum.includes('Total cargo'));
});
