import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../../../',import.meta.url);
const file=new URL('source-requirements/worker-remediation.json',root);
const registry=JSON.parse(readFileSync(file,'utf8'));
function resolve(schema,node){return node?.$ref?.startsWith('#/')?resolve(schema,node.$ref.slice(2).split('/').reduce((v,k)=>v?.[k],schema)):node;}
function collect(value,key='',found=[]){
  if(Array.isArray(value)&&/^(required_|must_check|helpful_context|supporting_sources)/u.test(key))found.push(...value.filter(v=>typeof v==='string'&&/^[a-z][a-z0-9_]+$/u.test(v)));
  else if(value&&typeof value==='object')for(const [k,v] of Object.entries(value))collect(v,k,found);
  return found;
}
for(const row of Object.values(registry.profiles)){
  const schema=row.request_schema?JSON.parse(readFileSync(new URL('schemas/v1/'+row.request_schema,root),'utf8')):null;
  const item=resolve(schema,resolve(schema,schema?.properties?.[row.source_field])?.items);
  const types=resolve(schema,item?.properties?.source_type)?.enum??[];
  const taxonomy=row.taxonomy?JSON.parse(readFileSync(new URL('source-requirements/'+row.taxonomy,root),'utf8')):null;
  row.source_fields=Object.keys(item?.properties||{});
  row.source_types=[...new Set([...(types.length?types:collect(taxonomy))])].sort();
  if(row.tool==='critical_minerals_due_diligence')row.source_types.push('csddd_human_rights_and_esg_audit');
}
const output=JSON.stringify(registry,null,2)+'\n';
for(const target of [file,new URL('src/agenda_intelligence/data/source-requirements/worker-remediation.json',root)]){
  if(process.argv.includes('--check')){if(readFileSync(target,'utf8')!==output)throw Error('Remediation keys are stale; run node scripts/generate-remediation-data.js');}
  else writeFileSync(target,output);
}
