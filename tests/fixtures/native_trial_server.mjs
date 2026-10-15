// Local-only bridge for the official MCP SDK regression. The trusted test
// server supplies the network identity; clients cannot select it or reset D1.
import http from 'node:http';
import {handleRequest} from '../../deploy/cloudflare-worker/src/index.js';
import {memoryD1} from '../../deploy/cloudflare-worker/test/helpers/d1.js';
import {TRIAL_PROFILES} from '../../deploy/cloudflare-worker/src/trial-profiles.js';
const db=memoryD1();
console.log=()=>{};
const server=http.createServer(async(req,res)=>{
  try {
    const parts=req.url.split('/');
    const profile=parts[1];
    if(!Object.hasOwn(TRIAL_PROFILES,profile)){res.writeHead(404).end();return;}
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const body=Buffer.concat(chunks);
    const headers=new Headers(req.headers);
    headers.set('cf-connecting-ip','192.0.2.73');
    const request=new Request('http://127.0.0.1/'+parts.slice(2).join('/'),{
      method:req.method,headers,...(body.length?{body}: {})});
    const response=await handleRequest(request,{AGENT_PROFILE:profile,WORKER_FREE_TRIAL:'1',
      BILLING_MODE:'pay_per_call',VIZIER_DISABLED:'1',PAYMENT_LEDGER:db});
    res.writeHead(response.status,Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {res.writeHead(500).end();}
});
server.listen(0,'127.0.0.1',()=>process.stdout.write(JSON.stringify({port:server.address().port})+'\n'));
