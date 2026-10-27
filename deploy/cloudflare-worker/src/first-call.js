import {INPUT_VALIDATION_MAX_BYTES,INPUT_VALIDATION_PATH} from './input-validation.js';
import {outputTrialEnabled,outputTrialTerms} from './output-trial.js';
import {productionAuthKey} from './hosted-access.js';
import {isMcpClientPath} from './mcp-client-path.js';

// Server-owned links only. Never copy rejected input, request IDs, query strings,
// payment proofs or credentials into recovery instructions.
function guidance(request,profile,env) {
  const origin=new URL(request.url).origin;
  const get=path=>({url:origin+path,method:'GET',headers:{Accept:'application/json'}});
  const terms=outputTrialEnabled(profile,env)?outputTrialTerms(profile):null;
  return {
    schema_version:1,automatic_retry:false,automatic_payment:false,
    client_download:{url:origin+'/.well-known/first-check.mjs',method:'GET',headers:{Accept:'text/javascript'}},
    authentication:productionAuthKey(profile,env)?'bearer_required':'none',
    contract_request:get('/.well-known/agent-contract.json'),
    input_preflight:{url:origin+INPUT_VALIDATION_PATH,method:'POST',
      headers:{'Content-Type':'application/json'},request_fields:['tool','input'],
      max_body_bytes:INPUT_VALIDATION_MAX_BYTES,evaluation_performed:false,attempt_consumed:false,
      instruction:'Select an advertised tool and send {tool,input}, where input contains its original tool arguments, not an MCP/A2A envelope. Repair schema findings without inventing evidence. Production authentication still applies.'},
    free_trial:terms?{
      tool:terms.tool,mcp_tool:terms.mcp_tool,mcp_status_tool:terms.mcp_status_tool,
      terms_request:get(terms.endpoint),status_request:get(terms.endpoint+'?availability=1'),
      inspection_consumes_attempt:false,post_consumes_attempt:true,
      instruction:'Inspect terms, input_schema, example_request and advisory availability first. Only an explicit trial POST or free_trial call evaluates and consumes the existing shared allowance. This trial covers only its named tool, not every paid operation.'
    }:null,
    instruction:'These are separate optional next steps, not an evaluation or authorization. Keep your original evidence and request. Never replace them with a synthetic example or replay a funded request through a different endpoint.'
  };
}

export async function firstCallResponse(request,response,profile,env) {
  if(request.method!=='POST')return response;
  const standardMcp=response.status===200 && response.headers.has('payment-required') &&
    isMcpClientPath(new URL(request.url).pathname);
  if(!standardMcp && ![400,402,413].includes(response.status))return response;
  let body;
  try {body=await response.clone().json();} catch {return response;}
  if(!body || typeof body!=='object' || Array.isArray(body))return response;
  const admission=body.result?._meta?.['com.agenda/admission'];
  // Only business admission/input refusals. Authentication and protocol errors
  // retain their own recovery contracts; successful executions remain untouched.
  if(standardMcp ? admission?.admission_status!==402 :
    response.status!==402 && body.code!=='invalid_paid_request')return response;
  const first_call=guidance(request,profile,env);
  if(standardMcp) {
    admission.first_call=first_call;
    if(!first_call.free_trial)admission.next_step='Inspect first_call for free input schema preflight. This deployment does not advertise a free trial. Review separate paid admission with the owner; do not pay automatically.';
    // Keep the first x402 text/structured payload exact for standard clients,
    // while letting text-only assistants also see the optional free entry.
    if(Array.isArray(body.result.content))body.result.content.push({type:'text',text:JSON.stringify({first_call})});
  }
  else {
    body.first_call=first_call;
    if(body.error?.data && typeof body.error.data==='object' && !Array.isArray(body.error.data))body.error.data.first_call=first_call;
  }
  const headers=new Headers(response.headers);headers.delete('content-length');
  return Response.json(body,{status:response.status,headers});
}
