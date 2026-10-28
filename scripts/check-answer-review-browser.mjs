import assert from 'node:assert/strict';
// Optional local browser QA; Playwright is not a production dependency.
const {chromium}=await import(process.env.AGENDA_PLAYWRIGHT_MODULE || 'playwright');
import {ANSWER_REVIEW_HTML} from '../deploy/cloudflare-worker/src/answer-review-html.js';
import {handleRequest} from '../deploy/cloudflare-worker/src/index.js';
import {memoryD1} from '../deploy/cloudflare-worker/test/helpers/d1.js';
const env={AGENT_PROFILE:'agent_output_verification',WORKER_FREE_TRIAL:'1',BILLING_MODE:'pay_per_call',PAYMENT_LEDGER:memoryD1()};
const count=async()=>(await env.PAYMENT_LEDGER.prepare('SELECT COUNT(*) AS count FROM output_verification_trials').first()).count;
console.log=()=>{}; // Worker fixture logs contain no user data; keep QA output compact.
const browser=await chromium.launch({headless:true});let page;
try{
 page=await browser.newPage({viewport:{width:900,height:1050}});const errors=[];
 page.on('console',message=>{if(['error','warning'].includes(message.type()))console.info(message.type(),message.text());});
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>route.abort());
 await page.exposeFunction('callWorker',async params=>{
  const response=await handleRequest(new Request('https://example.test/mcp/output-verification',{
   method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':'192.0.2.10','x-client-id':'agenda-owner-browser-regression'},
   body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params})}),env);
  const value=await response.json();assert.equal(response.status,200);assert.ok(value.result);return value.result;
 });
 await page.setContent('<!doctype html><html><body style="margin:0"></body></html>');
 await page.evaluate(html=>{
  window.toolCalls=[];
  window.addEventListener('message',async event=>{
   const value=event.data;if(value?.jsonrpc!=='2.0')return;
   let result;
   if(value.method==='ui/initialize')result={protocolVersion:'2026-01-26',hostCapabilities:{serverTools:{}},hostInfo:{name:'local-browser-fixture',version:'1'},hostContext:{theme:'light',displayMode:'inline'}};
   else if(value.method==='tools/call'){window.toolCalls.push(value.params.name);result=await window.callWorker(value.params);}
   else return;
   event.source.postMessage({jsonrpc:'2.0',id:value.id,result},'*');
  });
  const iframe=document.createElement('iframe');iframe.style='width:850px;height:1000px;border:0';iframe.setAttribute('sandbox','allow-scripts');
  iframe.srcdoc=html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; connect-src \'none\'; img-src data:; object-src \'none\'; base-uri \'none\'">');document.body.append(iframe);
 },ANSWER_REVIEW_HTML);
 const view=page.frameLocator('iframe');await view.getByRole('status').filter({hasText:'Ready.'}).waitFor();
 assert.equal(await count(),0);assert.deepEqual(await page.evaluate(()=>window.toolCalls),[]);
 await view.getByRole('button',{name:'Check remaining attempts'}).click();await view.getByRole('status').filter({hasText:'5 shared campaign attempts'}).waitFor();assert.equal(await count(),0);
 await view.getByLabel('AI answer',{exact:true}).fill('The report says "five warehouses" [s1]');
 await view.getByLabel('Source ID (for example s1)').fill('s1');await view.getByLabel('Actual source text').fill('The report lists three warehouses. <img src=x onerror=alert(1)>');
 await view.getByRole('button',{name:'Review · uses 1 attempt',exact:true}).click();await view.getByRole('status').filter({hasText:'1 citation/quote issues.'}).waitFor();assert.equal(await count(),1);
 await view.getByLabel('AI answer',{exact:true}).fill('The report says "three warehouses" [s1]');
 await view.getByRole('button',{name:'Review · uses 1 attempt',exact:true}).click();await view.getByRole('status').filter({hasText:'0 citation/quote issues.'}).waitFor();
 assert.equal(await count(),2);assert.match(await view.locator('#result').textContent(),/Previous review: 1 issues; current: 0/);
 await view.getByRole('button',{name:'Review · uses 1 attempt',exact:true}).click();await view.getByRole('status').filter({hasText:'unchanged from the completed review'}).waitFor();
 assert.equal(await count(),2,'unchanged input must not reserve another attempt');
 const revisions=['The excerpt lists "three warehouses" [s1]','The supplied source mentions "three warehouses" [s1]','The source contains the quotation "three warehouses" [s1]'];
 for(let i=0;i<revisions.length;i++){
  await view.getByLabel('AI answer',{exact:true}).fill(revisions[i]);
  await view.getByRole('button',{name:'Review · uses 1 attempt',exact:true}).click();await view.getByRole('status').filter({hasText:'0 citation/quote issues.'}).waitFor();
  assert.equal(await count(),i+3);
 }
 const previous=await view.locator('#result').textContent();
 await view.getByLabel('AI answer',{exact:true}).fill('This is a changed sixth review request: "three warehouses" [s1]');
 await view.getByRole('button',{name:'Review · uses 1 attempt',exact:true}).click();await view.getByRole('status').filter({hasText:'Review did not complete'}).waitFor();
 assert.equal(await view.locator('#result').textContent(),previous);assert.equal(await count(),5);
 assert.deepEqual(errors,[]);assert.equal(await view.locator('img').count(),0);
 if(process.env.AGENDA_BROWSER_SCREENSHOT)await page.screenshot({path:process.env.AGENDA_BROWSER_SCREENSHOT,fullPage:true});
 console.info(JSON.stringify({passed:true,officialSDK:true,realBrowser:true,host:'local fixture',reservations:await count(),unchangedRequestSuppressed:true,preservesPrevious:true,scriptErrors:errors}));
}catch(error){console.info('FAILURE STATE',await page.frameLocator('iframe').locator('body').innerText(),await page.evaluate(()=>window.toolCalls));if(process.env.AGENDA_BROWSER_SCREENSHOT)await page.screenshot({path:process.env.AGENDA_BROWSER_SCREENSHOT,fullPage:true});throw error;}finally{await browser.close();}
