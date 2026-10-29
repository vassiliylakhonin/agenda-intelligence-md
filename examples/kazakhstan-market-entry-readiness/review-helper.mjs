#!/usr/bin/env node
// Offline projection of a previously completed gate response. No network, evaluation or payment.
import {readFileSync,statSync} from 'node:fs';
import {marketEntryView,marketEntryProgress} from '../../deploy/cloudflare-worker/src/market-entry-workflow.js';
try {
 const [operation,path,...extra]=process.argv.slice(2);
 if(!path||extra.length||!['view','compare'].includes(operation))throw Error('Usage: node review-helper.mjs view|compare input.json');
 if(statSync(path).size>512*1024)throw Error('Input exceeds 512 KiB.');
 const input=JSON.parse(readFileSync(path,'utf8'));let output;
 if(operation==='view')output=marketEntryView(input.request,input.response);
 else output=marketEntryProgress(input.previous?.request,input.previous?.response,input.current?.request,input.current?.response);
 if(!output)throw Error('Invalid result or incompatible project / decision scope; no comparison was made.');
 process.stdout.write(JSON.stringify(output,null,2)+'\n');
} catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
