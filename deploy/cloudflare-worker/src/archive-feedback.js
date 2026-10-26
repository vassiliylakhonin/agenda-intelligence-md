const outcomes=['packet_prepared','still_blocked'];
const contexts=['own_files','synthetic_example','unspecified'];
const blockers=['none','checklist','files','extraction','export','other'];
export function archiveFeedbackObservation(value){
  if(!value||Object.keys(value).length!==4||value.consent!=='yes'||!outcomes.includes(value.outcome)||!contexts.includes(value.context)||!blockers.includes(value.blocker)||
    (value.outcome==='packet_prepared'?value.blocker!=='none':value.blocker==='none'))return null;
  return {feedback_version:1,feedback_outcome:value.outcome,feedback_context:value.context,feedback_blocker:value.blocker,
    feedback_consent:true,evaluation_performed:false,acceptance_verified:false};
}
const frame=content=>`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Archive feedback — Agenda</title><style>body{font:17px/1.6 system-ui,sans-serif;max-width:760px;margin:auto;padding:28px 20px;color:#162a35}label{display:block;margin:20px 0}select,button{font:inherit;padding:10px;max-width:100%}select{display:block;width:100%}a{color:#07576a}.note{color:#52676c}</style><main>${content}</main></html>`;
export const ARCHIVE_FEEDBACK_HTML=frame(`<h1>Did you prepare a review packet?</h1><p>Optional feedback about your own experience. This form sends only the choices below and ordinary request metadata. No documents, filenames, excerpts, archive IDs or contact details are requested.</p>
<form action="/archive-feedback" method="post"><label>What happened?<select name="outcome" required><option value="">Choose an outcome</option><option value="packet_prepared">I prepared a packet for review</option><option value="still_blocked">I am still blocked</option></select></label>
<label>What did you work with?<select name="context" required><option value="">Choose a context</option><option value="own_files">My own authorized files</option><option value="synthetic_example">The synthetic example</option><option value="unspecified">Prefer not to say</option></select></label>
<label>Where did you get stuck?<select name="blocker" required><option value="">Choose an answer</option><option value="none">Not blocked — packet prepared</option><option value="checklist">Defining or assigning the checklist</option><option value="files">Adding files or size limits</option><option value="extraction">Reading document text</option><option value="export">Preparing or downloading the export</option><option value="other">Another step</option></select></label>
<label><input type="checkbox" name="consent" value="yes" required> Send these choices as voluntary feedback. I understand this is a self-report, not confirmation of document correctness or reviewer acceptance.</label><button type="submit">Send my feedback</button></form><p class="note">Reports separate synthetic examples, other cases and our labelled checks. Feedback is not a purchase, customer identity or verified completed evaluation. There is no automatic submission.</p><p><a href="/document-archive">Open the workspace</a> · <a href="/privacy">Privacy</a></p>`);
// Native non-CORS form POSTs may serialize Origin as null under no-referrer.
// Send provenance only within this origin; retain strict Origin validation.
const headers={'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin',
  'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; connect-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
export async function handleArchiveFeedback(request,record){
  const reply=(content,status=200,extra={})=>new Response(request.method==='HEAD'?null:content,{status,headers:{...headers,...extra}});
  const failure=(message,status)=>reply(frame(`<h1>Feedback was not accepted</h1><p>${message}</p><p>No response was marked accepted. <a href="/archive-feedback">Return to the form</a>.</p>`),status);
  if(['GET','HEAD'].includes(request.method))return reply(ARCHIVE_FEEDBACK_HTML);
  if(request.method!=='POST')return reply('Method not allowed',405,{allow:'GET, HEAD, POST'});
  if(request.headers.get('origin')!==new URL(request.url).origin)return failure('Open the form on this site and submit it deliberately.',403);
  if((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/x-www-form-urlencoded')return failure('Use the published form fields.',415);
  if(Number(request.headers.get('content-length'))>1024)return failure('The form exceeds its size limit.',413);
  let bytes=0,chunks=[];
  try{const reader=request.body?.getReader();if(!reader)return failure('Choose all required fields.',400);while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>1024){await reader.cancel();return failure('The form exceeds its size limit.',413);}chunks.push(value);}}
  catch{return failure('The form could not be read. Retry only if you choose to.',400);}
  const data=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
  let entries;try{entries=[...new URLSearchParams(new TextDecoder('utf-8',{fatal:true}).decode(data))];}catch{return failure('Invalid form encoding.',400);}
  if(entries.length!==4||new Set(entries.map(([key])=>key)).size!==4)return failure('Use only the four published fields.',400);
  const observation=archiveFeedbackObservation(Object.fromEntries(entries));if(!observation)return failure('Choose a consistent outcome, context and blocker, and confirm consent.',400);
  try{await record(observation);}catch{return failure('Feedback reporting is temporarily unavailable. Your archive is unaffected.',503);}
  return reply(frame('<h1>Feedback accepted</h1><p>Thank you. The server accepted your selected choices for reporting. This does not verify a document, a completed download or reviewer acceptance.</p><p>Your workspace remains in its original tab. <a href="/document-archive">Open the workspace</a> · <a href="/archive-review">Inspect the optional preparation service</a></p>'));
}
