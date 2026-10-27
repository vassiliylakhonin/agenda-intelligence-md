// Offline integration check: the deployed entry, real Workflow engine and local
// D1, with fixture outbound pages and an RPC fixture model. No paid AI calls.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {pathToFileURL}=require('node:url');
const {webcrypto}=require('node:crypto');
const {build}=require('esbuild');

async function main() {
  const base=path.resolve(__dirname,'..');
  const executable=process.env.PATH.split(path.delimiter).map(dir=>path.join(dir,'wrangler')).find(file=>fs.existsSync(file));
  const root=process.argv[2]??(executable&&path.dirname(path.dirname(fs.realpathSync(executable))));
  assert.ok(root,'Run through npm exec --package=wrangler@4.153.0, or pass its package directory');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,'4.153.0');
  const toolRequire=createRequire(path.join(root,'package.json'));
  const {Miniflare,convertV4MiniflareOptions}=toolRequire('miniflare');
  const built=await build({entryPoints:[path.join(base,'src/research-entry.js')],bundle:true,format:'esm',platform:'browser',external:['cloudflare:workers'],write:false});
  const quote='The source describes port and rail coordination.';
  const ai=`import {WorkerEntrypoint} from 'cloudflare:workers';
    let calls=0;export default class extends WorkerEntrypoint {
      async run(model,params){calls++;
        if(model!=='@cf/meta/llama-3.3-70b-instruct-fp8-fast'||params.max_tokens!==2048)throw new Error('Unexpected inference configuration');
        return {response:{findings:[{claim:'The source discusses coordination.',source_id:'S1',quote:${JSON.stringify(quote)}}],interpretations:[],open_questions:[]},usage:{prompt_tokens:200,completion_tokens:20}};}
      async fetch(){return Response.json({calls});}
    }`;
  const pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const privateJwk=await webcrypto.subtle.exportKey('jwk',pair.privateKey);privateJwk.kid='runtime-fixture-only';
  const mf=new Miniflare(convertV4MiniflareOptions({cf:false,workers:[{
    name:'research-runtime',modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-05-22',
    bindings:{AGENT_PROFILE:'agenda',RESEARCH_ENABLED:'1',RESEARCH_DAILY_JOB_LIMIT:'5',AGENT_CARD_SIGNING_KEY:JSON.stringify(privateJwk)},
    d1Databases:{RESEARCH_DB:'local-research'},
    workflows:{RESEARCH_WORKFLOW:{name:'local-research',className:'CorridorResearchWorkflow'}},
    serviceBindings:{RESEARCH_AI:'fixture-ai'},
    outboundService:async request=>{
      assert.ok(['middlecorridor.com','www.worldbank.org','www.carecinstitute.org','www.eabr.org'].includes(new URL(request.url).hostname));
      return new Response('<h1>Coordination</h1><p>'+quote+' This official fixture describes the route and coordination of transport between ports and railways.</p>',{headers:{'content-type':'text/html'}});
    }
  },{name:'fixture-ai',modules:true,script:ai,compatibilityDate:'2026-05-22'}]}));
  try {
    const db=await mf.getD1Database('RESEARCH_DB','research-runtime');
    await db.exec(fs.readFileSync(path.join(base,'research-migrations/0001_research.sql'),'utf8').replace(/\n/g,' '));
    const token='private-local-research-capability-1234567890';
    const call=async(route,body,cap=token)=>{
      const response=await mf.dispatchFetch('https://agendamcp.dpdns.org'+route,{headers:{authorization:'Bearer '+cap,'content-type':'application/json','x-client-id':'agenda-owner-local-research-runtime'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});
      return {status:response.status,body:await response.json()};
    };
    const input={question:'What changed in Aktau transport?',request_id:'local-workflow-1'};
    let {body:job,status}=await call('/v1/research',input);assert.equal(status,202);
    for(let attempt=0;attempt<150;attempt++){
      await new Promise(resolve=>setTimeout(resolve,100));
      ({body:job}=await call('/v1/research/'+job.research_id));
      if(['completed','failed'].includes(job.status))break;
    }
    assert.equal(job.status,'completed',job.error_code);
    const Ajv=require('ajv/dist/2020'),addFormats=require('ajv-formats');
    const schema=JSON.parse(fs.readFileSync(path.join(base,'../../schemas/v1/corridor-research-response.schema.json'),'utf8'));
    const valid=addFormats(new Ajv({strict:false})).compile(schema);assert.ok(valid(job),JSON.stringify(valid.errors));
    const retry=await call('/v1/research',input);assert.equal(retry.body.research_id,job.research_id);
    const mcp=await call('/v1/research/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'get_research',arguments:{research_id:job.research_id}}});
    assert.equal(mcp.status,200);assert.deepEqual(mcp.body.result.structuredContent,job);
    assert.equal((await call('/v1/research/'+job.research_id,undefined,'another-private-capability-1234567890')).status,404);
    const {body:card}=await call('/.well-known/agent-card.json');
    const {validateAgentCard}=await import(pathToFileURL(path.join(base,'scripts/verify-agent-card.js')).href);
    assert.deepEqual(validateAgentCard(card,'https://agendamcp.dpdns.org/.well-known/agent-card.json'),[]);
    assert.equal(card.x_agenda_research,undefined);
    const extension=card.capabilities.extensions.find(x=>x.uri==='https://agendamcp.dpdns.org/capabilities/corridor-research');
    assert.equal(extension.params.mcp_endpoint,'/v1/research/mcp');
    const {jcs}=await import(pathToFileURL(path.join(base,'src/jws.js')).href);
    const unsigned={...card};delete unsigned.signatures;
    const signature=card.signatures[0];
    const bytes=Buffer.from(signature.protected+'.'+Buffer.from(jcs(unsigned)).toString('base64url'));
    assert.ok(await webcrypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},pair.publicKey,Buffer.from(signature.signature,'base64url'),bytes));
    const {body:alias}=await call('/.well-known/agent.json');
    assert.deepEqual(alias.capabilities.extensions.find(x=>x.uri===extension.uri),extension);
    const aiWorker=await mf.getWorker('fixture-ai');
    assert.equal((await (await aiWorker.fetch('https://fixture.test/')).json()).calls,1);
    const row=await db.prepare('SELECT sources_json,model_output_json FROM research_jobs').first();assert.equal(row.sources_json,null);assert.equal(row.model_output_json,null);
    console.log('PASS: deployed entry + real Workflow/D1, one fixture inference, private REST/MCP, signed A2A extension and source cleanup');
  }finally{await mf.dispose();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
