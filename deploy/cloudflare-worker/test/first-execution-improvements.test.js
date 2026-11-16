import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/index.js';
import {memoryD1} from './helpers/d1.js';
import {handleOutputTrial,trialClientKey} from '../src/output-trial.js';
import {refundTechnicalTrial} from '../src/trial-recovery.js';
import {WORKED_EXAMPLES} from '../src/worked-examples.js';
const origin='https://example.test';
const envFor=()=>({AGENT_PROFILE:'agent_output_verification',BILLING_MODE:'pay_per_call',WORKER_FREE_TRIAL:'1',VIZIER_DISABLED:'1',PAYMENT_LEDGER:memoryD1()});
const headers={'content-type':'application/json','cf-connecting-ip':'192.0.2.88','x-client-id':'instinct-owner-regression'};
const rpc=async(env,name,args,key)=>handleRequest(new Request(origin+'/mcp/agent',{method:'POST',headers:{...headers,...(key?{'idempotency-key':key}:{})},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})}),env);
const count=async(env,table)=>(await env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS n FROM '+table).first()).n;
const key='a'.repeat(48);
const quiet=async f=>{const old=console.log;console.log=()=>{};try{return await f();}finally{console.log=old;}};

test('OV ordinary name shares atomic campaign; no paid fallback and output contract retained',()=>quiet(async()=>{
 const env=envFor(),input=WORKED_EXAMPLES.agent_output_verification.request;
 const first=await (await rpc(env,'agent_output_verification',input)).json();
 assert.equal(first.result.isError,false);
 const data=first.result.structuredContent;
 assert.equal(data.trial.admission,'free_trial');assert.equal(data.trial.payment_required,false);
 assert.ok(data.verdict);assert.equal(data.evaluation,undefined);
 const rest=await Promise.all(Array.from({length:10},(_,i)=>rpc(env,i%2?'free_trial':'agent_output_verification',input)));
 assert.equal((await Promise.all(rest.map(r=>r.json()))).filter(b=>!b.result.isError).length,4);
 assert.equal(await count(env,'output_verification_trials'),5);
 const refused=await (await rpc(env,'agent_output_verification',input)).json();
 assert.equal(JSON.parse(refused.result.content[0].text).code,'trial_exhausted');
 assert.equal((await (await rpc(env,'pre_action_check',input)).json()).result.isError,true);
 assert.equal(await count(env,'output_verification_trials'),5);
}));

test('free router returns blank Minerals templates, never audit or invented facts',()=>quiet(async()=>{
 const env={...envFor(),AGENT_PROFILE:'agenda'};
 const result=await (await rpc(env,'strategic_risk_triage',{text:'Lithium offtake, partial context only'})).json();
 const text=JSON.stringify(result);assert.match(text,/blank_source_template/);assert.match(text,/preparation_only/);
 assert.match(text,/"evaluation_performed":false/);assert.match(text,/"project_name":""/);
 assert.equal(await count(env,'output_verification_trials'),0);
}));

test('same-key race runs once, encrypted result recovery, changed input conflict, expiry tombstone',()=>quiet(async()=>{
 const env=envFor(),input=WORKED_EXAMPLES.agent_output_verification.request;
 const responses=await Promise.all(Array.from({length:12},()=>rpc(env,'agent_output_verification',input,key)));
 const bodies=await Promise.all(responses.map(r=>r.json()));
 assert.equal(bodies.filter(b=>!b.result.isError).length,1);
 assert.equal(await count(env,'output_verification_trials'),1);
 const replay=await (await rpc(env,'agent_output_verification',input,key)).json();
 assert.deepEqual(replay.result.structuredContent,bodies.find(b=>!b.result.isError).result.structuredContent);
 assert.equal(await count(env,'output_verification_trials'),1);
 const saved=await env.PAYMENT_LEDGER.prepare('SELECT * FROM trial_result_recovery').first();
 assert.ok(saved.response_ciphertext);assert.ok(!saved.response_ciphertext.includes('verdict'));
 assert.ok(!JSON.stringify(saved).includes(key));
 const changed=await direct(env,{key,value:{changed:true},ip:'192.0.2.88'});assert.equal(changed.status,409);
 await env.PAYMENT_LEDGER.prepare("UPDATE trial_result_recovery SET created_at='2000-01-01T00:00:00.000Z'").run();
 const expired=await (await rpc(env,'agent_output_verification',input,key)).json();
 assert.equal(JSON.parse(expired.result.content[0].text).code,'trial_recovery_expired');
 assert.equal(await count(env,'output_verification_trials'),1);
 assert.equal((await env.PAYMENT_LEDGER.prepare('SELECT response_ciphertext FROM trial_result_recovery').first()).response_ciphertext,null);
}));

const direct=async(env,{fail=false,key=null,ip='192.0.2.99',value={claims:[]}}={})=>handleOutputTrial(new Request(origin,{headers:{...headers,'cf-connecting-ip':ip,...(key?{'idempotency-key':key}:{})}}),env,
 {validate:()=>({value,errors:[]}),readInput:()=>value,evaluate:async()=>{if(fail)throw Error('synthetic technical failure');return {verdict:'insufficient_information'};},emit:()=>{},respond:(body,status=200,headers={})=>Response.json(body,{status,headers})});

test('technical refunds capped at 2 per campaign; evidence gaps and adverse findings consume',async()=>{
 const env=envFor();
 for(let i=0;i<2;i++){const r=await direct(env,{fail:true,key});assert.equal(r.status,503);assert.equal((await r.json()).technical_refund,true);}
 assert.equal(await count(env,'output_verification_trials'),0);
 const third=await direct(env,{fail:true,key});assert.equal((await third.json()).attempt_consumed,true);
 assert.equal(await count(env,'trial_technical_refunds'),2);assert.equal(await count(env,'output_verification_trials'),1);
 const good=await direct(env);assert.equal((await good.json()).trial.attempt_consumed,true);
 const row=await env.PAYMENT_LEDGER.prepare('SELECT attempt_id FROM trial_completion_receipts').first();
 const client=await trialClientKey(new Request(origin,{headers:{...headers,'cf-connecting-ip':'192.0.2.99'}}),env,'agent_output_verification');
 assert.equal(await refundTechnicalTrial(env,client,row.attempt_id,null),false);
});

test('technical failure races preserve campaign/fleet caps with bounded refunds',async()=>{
 const env=envFor();
 const result=await Promise.all(Array.from({length:30},()=>direct(env,{fail:true})));
 assert.equal(await count(env,'trial_technical_refunds'),2);assert.ok(await count(env,'output_verification_trials')<=5);
 assert.ok(result.every(r=>[429,503].includes(r.status)));
 const day=new Date().toISOString().slice(0,10),now=new Date().toISOString();
 for(let i=2;i<100;i++)await env.PAYMENT_LEDGER.prepare('INSERT INTO trial_technical_refunds (attempt_id,client_hash,refunded_day,refunded_at,reserved_day) VALUES (?1,?2,?3,?4,?3)').bind('seed-'+i,'seed-'+i,day,now).run();
 const r=await direct(env,{fail:true,ip:'192.0.2.100'});assert.equal((await r.json()).technical_refund,false);
 assert.equal(await count(env,'trial_technical_refunds'),100);
});

test('completion-storage failure refunds, same key retries and then recovers without charge',()=>quiet(async()=>{
 const env=envFor(),db=env.PAYMENT_LEDGER,prepare=db.prepare;let outage=true;
 db.prepare=sql=>{if(outage && sql.includes('INSERT INTO trial_completion_receipts'))throw Error('outage');return prepare(sql);};
 const input=WORKED_EXAMPLES.agent_output_verification.request;
 const failed=await (await rpc(env,'agent_output_verification',input,key)).json();
 assert.equal(JSON.parse(failed.result.content[0].text).technical_refund,true);
 assert.equal(await count(env,'output_verification_trials'),0);outage=false;
 const success=await (await rpc(env,'agent_output_verification',input,key)).json();assert.equal(success.result.isError,false);
 assert.deepEqual((await (await rpc(env,'agent_output_verification',input,key)).json()).result.structuredContent,success.result.structuredContent);
 assert.equal(await count(env,'output_verification_trials'),1);
}));

test('technical refunds restore product allowance but never expand hard fleet daily work cap',async()=>{
 const env=envFor(),day=new Date().toISOString().slice(0,10),now=new Date().toISOString();
 await env.PAYMENT_LEDGER.prepare(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i<999)
   INSERT INTO output_verification_trials SELECT 'seed-'||i,'seed-'||i,?1,?2 FROM n`).bind(day,now).run();
 const failed=await direct(env,{fail:true});assert.equal((await failed.json()).technical_refund,true);
 const next=await direct(env);assert.equal(next.status,429);
 assert.equal((await next.json()).trial.limit_reason,'daily_capacity_exhausted');
 assert.equal(await count(env,'output_verification_trials'),999);
});
