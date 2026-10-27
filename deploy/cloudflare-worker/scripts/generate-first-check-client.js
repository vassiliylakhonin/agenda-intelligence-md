import {readFileSync,writeFileSync} from 'node:fs';
const source=readFileSync(new URL('../../../examples/hosted-mcp/first-check.mjs',import.meta.url),'utf8');
const target=new URL('../src/first-check-client.js',import.meta.url);
const output='// Generated from the standalone first-check client. Do not edit.\nexport const FIRST_CHECK_CLIENT_SOURCE = '+JSON.stringify(source)+';\n';
if(process.argv.includes('--check')) {
  if(readFileSync(target,'utf8')!==output) {
    console.error('First-check download differs from its canonical client; run node scripts/generate-first-check-client.js.');
    process.exitCode=1;
  } else console.log('First-check download matches canonical client');
} else writeFileSync(target,output);
