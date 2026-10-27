import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root = new URL('../../../', import.meta.url);
const sources = [
  ['agenda-intelligence','skills/agenda-intelligence/SKILL.md'],
  ['central-asia-caspian','skills/agenda-intelligence/references/regional/central-asia-caspian.md']
];
const methods = sources.map(([id,path])=>{
  const text=readFileSync(new URL(path,root),'utf8');
  return {id,path,sha256:createHash('sha256').update(text).digest('hex'),text};
});
const output = '// Generated from canonical vendored methods; do not edit.\nexport const RESEARCH_METHODS = '+JSON.stringify(methods)+';\n';
const target = new URL('../src/research-methods.js',import.meta.url);
if(process.argv.includes('--check')) {
  if(readFileSync(target,'utf8')!==output)throw new Error('Stale research method bundle; run node scripts/generate-research-methods.js');
} else writeFileSync(target,output);
