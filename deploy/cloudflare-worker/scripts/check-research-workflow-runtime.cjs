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
  const {PDFDocument,StandardFonts}=require('pdf-lib');
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
  for(let n=1;n<=37;n++){const page=pdf.addPage();if(n===1||n===37)page.drawText('Aktau cargo report 2023: container throughput decreased. '+('This operator document preserves units and periods for reviewer checks. '),{x:30,y:700,font,size:11});}
  const pdfBytes=process.env.RESEARCH_FIXTURE_PDF?fs.readFileSync(process.env.RESEARCH_FIXTURE_PDF):await pdf.save();
  const {zipSync,strToU8}=require('fflate');
  const docxBytes=zipSync({'word/document.xml':strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Port Kuryk tariff body text. This official fixture preserves the original tariff conditions for reviewer checks. No current price or availability is guaranteed by this test.</w:t></w:r></w:p></w:body></w:document>')});
  const blank=await PDFDocument.create();blank.addPage();const blankPdf=await blank.save();
  let pdfRequests=0,docxRequests=0,pdfFailure=null;
  const quote='The source describes port and rail coordination.';
  const ai=`import {WorkerEntrypoint} from 'cloudflare:workers';
    let calls=0;export default class extends WorkerEntrypoint {
      async run(model,params){calls++;
        if(model!=='@cf/meta/llama-3.3-70b-instruct-fp8-fast'||params.max_tokens!==2048)throw new Error('Unexpected inference configuration');
        const payload=JSON.parse(params.messages.find(m=>m.role==='user').content),ru=payload.output_language==='ru',source=payload.sources.find(s=>s.extraction?.kind==='pdf'||s.extraction?.kind==='docx')??payload.sources[0];
        const evidence=source.evidence_candidates[0];
        if(!params.response_format.json_schema.properties.findings.properties[source.id].properties.evidence_id.enum.includes(evidence.evidence_id))throw new Error('Evidence selection schema missing');
        return {response:{findings:{[source.id]:{claim:ru?'Источник описывает координацию перевозок.':'The source discusses coordination.',evidence_id:payload.decision_context==='fixture-invalid-evidence'?'unknown-evidence':evidence.evidence_id}},interpretations:[],open_questions:[]},usage:{prompt_tokens:200,completion_tokens:20}};}
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
      assert.ok(['middlecorridor.com','www.worldbank.org','www.carecinstitute.org','www.eabr.org','www.ktze.kz','portaktau.kz','portkuryk.kz'].includes(new URL(request.url).hostname));
      if(pdfFailure&& !request.url.endsWith('.pdf'))return new Response('fixture access failure',{status:403});
      if(request.url.endsWith('.pdf')){pdfRequests++;return new Response(pdfFailure==='empty'?blankPdf:pdfFailure==='invalid'?Buffer.from('%PDF-not-readable'):pdfBytes,{headers:{'content-type':'application/pdf'}});}
      if(request.url.endsWith('.docx')){docxRequests++;return new Response(docxBytes,{headers:{'content-type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}});}
      if(new URL(request.url).hostname==='portkuryk.kz')return new Response('<h1>Kuryk tariffs</h1><a href="/storage/tariff.docx">Kuryk tariff document</a>',{headers:{'content-type':'text/html'}});
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
    const input={question:'Aktau annual report cargo throughput 2023',request_id:'local-workflow-1'};
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
    assert.ok(pdfRequests>0,'PDF was not actually fetched');
    assert.ok(job.result.sources.some(s=>s.url.endsWith('.pdf')&&!s.extraction));
    assert.ok(job.result.limitations.some(s=>s.includes('Read PDF pages 1, 37 of')));
    assert.ok(job.result.markdown.includes('Table')||job.result.markdown.includes('table'));
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
    let russian=(await call('/v1/research',{question:'Курык тарифы',language:'ru',request_id:'local-workflow-ru'})).body;
    for(let attempt=0;attempt<150;attempt++){
      await new Promise(resolve=>setTimeout(resolve,100));
      russian=(await call('/v1/research/'+russian.research_id)).body;
      if(['completed','failed'].includes(russian.status))break;
    }
    assert.equal(russian.status,'completed',russian.error_code);assert.ok(valid(russian),JSON.stringify(valid.errors));
    assert.ok(docxRequests>0,'DOCX was not actually fetched');
    assert.ok(russian.result.sources.some(s=>s.url.endsWith('.docx')));
    assert.equal(russian.result.language,'ru');assert.match(russian.result.findings[0].claim,/[\u0400-\u04ff]/u);
    assert.ok(russian.result.markdown.includes('## Открытые вопросы'));
    const otherCapability='separate-local-qa-capability-1234567890';
    let rejected=(await call('/v1/research',{...input,decision_context:'fixture-invalid-evidence',request_id:'local-workflow-bad-reference'},otherCapability)).body;
    for(let attempt=0;attempt<150;attempt++){
      await new Promise(resolve=>setTimeout(resolve,100));
      rejected=(await call('/v1/research/'+rejected.research_id,undefined,otherCapability)).body;
      if(['completed','failed'].includes(rejected.status))break;
    }
    assert.equal(rejected.status,'failed');assert.equal(rejected.error_code,'model_evidence_validation_failed');assert.equal(rejected.result,null);
    for(const [mode,expected] of [['empty','document_needs_ocr'],['invalid','document_parse_failed']]) {
      pdfFailure=mode;
      let failed=(await call('/v1/research',{...input,request_id:'local-pdf-'+mode},otherCapability+'-'+mode)).body;
      for(let attempt=0;attempt<150;attempt++){
        await new Promise(resolve=>setTimeout(resolve,100));
        failed=(await call('/v1/research/'+failed.research_id,undefined,otherCapability+'-'+mode)).body;
        if(['completed','failed'].includes(failed.status))break;
      }
      assert.equal(failed.status,'failed');assert.equal(failed.error_code,'no_readable_primary_sources');
      assert.ok(failed.retrieval_failures.some(f=>f.code===expected),JSON.stringify(failed.retrieval_failures));
    }
    const aiWorker=await mf.getWorker('fixture-ai');
    assert.equal((await (await aiWorker.fetch('https://fixture.test/')).json()).calls,3);
    const row=await db.prepare('SELECT COUNT(*) AS count FROM research_jobs WHERE sources_json IS NOT NULL OR model_output_json IS NOT NULL').first();assert.equal(row.count,0);
    console.log('PASS: deployed entry + real Workflow/D1, PDF/DOCX extraction, English/Russian evidence selection, serialized refusal, one fixture inference per job, private REST/MCP, signed A2A extension, scanned/corrupt PDF refusal before inference and source cleanup');
  }finally{await mf.dispose();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
