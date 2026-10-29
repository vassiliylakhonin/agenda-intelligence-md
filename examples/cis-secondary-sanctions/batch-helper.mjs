// Local CLI only: no network, paid request or screening.
import {readFileSync,statSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {parseCounterpartyCsv,prepareBatch,summarizeBatch} from '../../deploy/cloudflare-worker/src/cis-batch.js';
export {parseCounterpartyCsv,prepareBatch,summarizeBatch};

function main(){
  const [command,path,facet,decisionStage,...question]=process.argv.slice(2);
  if(!path || !['prepare','summarize'].includes(command)) throw Error('Use prepare input.csv|input.json facet stage "review question" or summarize batch-response.json.');
  const file=statSync(path);if(!file.isFile()||file.size>(command==='prepare'?65536:1048576))throw Error('Input file exceeds the allowed size.');
  const content=readFileSync(path,'utf8');
  if(command==='summarize') {
    if(facet!==undefined)throw Error('Summarize accepts exactly one response file.');
    let result;try{result=JSON.parse(content);}catch{throw Error('Response file is not valid JSON.');}
    process.stdout.write(JSON.stringify(summarizeBatch(result),null,2)+'\n');return;
  }
  if(!facet||!decisionStage||!question.length)throw Error('Use prepare input.csv facet stage "review question".');
  let counterparties;
  if(path.toLowerCase().endsWith('.json')) {try{counterparties=JSON.parse(content);}catch{throw Error('Counterparty file is not valid JSON.');}}
  else counterparties=parseCounterpartyCsv(content);
  const batch=prepareBatch(counterparties,{facets:[facet],decisionStage,riskQuestion:question.join(' ')});
  process.stdout.write(JSON.stringify(batch,null,2)+'\n');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {main();} catch(error) {process.stderr.write('Batch not prepared: '+error.message+'\n');process.exitCode=1;}
}
