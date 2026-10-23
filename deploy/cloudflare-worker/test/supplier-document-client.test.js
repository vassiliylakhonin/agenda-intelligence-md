import test from 'node:test';
import assert from 'node:assert/strict';
import {documentJob} from '../apps/supplier-desk/document-client.js';

test('browser document client ignores PDF.js startup messages and terminates after its own result',async t=>{
  const original=globalThis.Worker;t.after(()=>globalThis.Worker=original);let instance;
  globalThis.Worker=class{
    constructor(path){assert.equal(path,'/supplier-document-worker.js');instance=this;}
    postMessage(message){assert.equal(message.protocol,'agenda.document.v1');queueMicrotask(()=>{this.onmessage({data:{sourceName:'worker',targetName:'main',action:'ready'}});this.onmessage({data:{protocol:'agenda.document.v1',ok:true,result:{text:'[PDF page 1]\nEvidence'}}});});}
    terminate(){this.terminated=true;}
  };
  assert.equal((await documentJob('extract',{})).text,'[PDF page 1]\nEvidence');assert.equal(instance.terminated,true);
});
test('unresponsive or failed document processor is terminated and reports failure without changing its input',async t=>{
  const original=globalThis.Worker;t.after(()=>globalThis.Worker=original);let instance;
  globalThis.Worker=class{constructor(){instance=this;}postMessage(){}terminate(){this.terminated=true;}};
  const payload={name:'source.pdf',bytes:new Uint8Array([1])};
  await assert.rejects(documentJob('extract',payload,{timeout:5}),/timed out/);assert.equal(instance.terminated,true);assert.equal(payload.bytes[0],1);
  globalThis.Worker=class{constructor(){instance=this;}postMessage(){queueMicrotask(()=>this.onerror());}terminate(){this.terminated=true;}};
  await assert.rejects(documentJob('extract',payload),/could not run/);assert.equal(instance.terminated,true);
});
