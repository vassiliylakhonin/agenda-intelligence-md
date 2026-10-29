import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

test('actual production workflow selects a single requested Worker and rejects ambiguous selectors',()=>{
  const workflow=readFileSync(new URL('../../../.github/workflows/deploy-existing-fleet.yml',import.meta.url),'utf8');
  const script=/node --input-type=module <<'JS'\n([\s\S]*?)\n          JS/.exec(workflow)?.[1];
  assert.ok(script,'Workflow selection script must be present');
  const folder=mkdtempSync(join(tmpdir(),'agenda-deploy-selection-'));
  try {
    for(const [target,signing,count] of [['agenda-root','false',1],['interaction-trust','false',1],['all','false',12],['all','true',2],['agenda-root','true',null],['interaction-trust','true',null],['unknown','false',null]]) {
      const output=join(folder,target+'-'+signing);
      const run=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:new URL('../',import.meta.url),encoding:'utf8',env:{...process.env,DEPLOY_TARGET:target,INITIALIZE_AGENT_CARD_SIGNING:signing,GITHUB_OUTPUT:output}});
      if(count===null){assert.notEqual(run.status,0);continue;}
      assert.equal(run.status,0,run.stderr);
      const matrix=JSON.parse(readFileSync(output,'utf8').trim().replace(/^matrix=/,''));
      assert.equal(matrix.include.length,count);
      if(target==='agenda-root')assert.deepEqual(matrix.include,[{env:'',workerName:'agenda-intelligence-a2a'}]);
      if(target==='interaction-trust')assert.deepEqual(matrix.include,[{env:'agentic-interaction-trust',workerName:'agentic-interaction-trust-a2a'}]);
      assert.ok(matrix.include.every(x=>x.workerName!=='agenda-corridor-research'));
    }
  }finally{rmSync(folder,{recursive:true,force:true});}
});
