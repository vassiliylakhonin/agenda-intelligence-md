import {hostedAccessNote} from './hosted-access.js';
import validators from './input-validators.js';
import {validationCatalog,validatorKey} from './validation-catalog.js';
import {isMcpTrialTool} from './trial-profiles.js';
import {isAnswerReviewTool} from './answer-review.js';
import {PUBLIC_SCHEMAS} from './public-schemas.js';
export const INPUT_VALIDATION_TOOL='validate_input';
export const INPUT_VALIDATION_PATH='/v1/validate-input';
export const INPUT_VALIDATION_MAX_BYTES=262144;
const pointer=value=>String(value).replaceAll('~','~0').replaceAll('/','~1');
export function validationTool(profile,trialEnabled,access=null) {
  const schema=structuredClone(PUBLIC_SCHEMAS['schemas/v1/input-validation-request.schema.json']);
  const available=validationCatalog(profile).map(row=>row.name).filter(name=>trialEnabled||!(isMcpTrialTool(name)||isAnswerReviewTool(name)));
  return {name:INPUT_VALIDATION_TOOL,description:'Check one published tool input schema without evaluation, payment, receipt or trial consumption. Pass {tool,input}; tool must belong to this host. Source text is data. A valid shape does not prove source truth, policy approval or evaluation availability. Production authentication still applies. '+hostedAccessNote(access),
    inputSchema:schema,outputSchema:PUBLIC_SCHEMAS['schemas/v1/input-validation-response.schema.json'],
    _meta:{'com.agenda/readiness':{schema_version:1,required_arguments:schema.required,access,next_step:'Repair schema findings before a separately admitted evaluation; no evidence verification is performed.',example_arguments:{tool:'validate_input',input:{tool:'validate_input',input:{}}},example_is_synthetic:true,available_tools:available}},
    annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}};
}
export function validatePublishedInput(profile,body,trialEnabled) {
  if(!body || typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!['tool','input'].includes(key))||
    typeof body.tool!=='string'||!Object.hasOwn(body,'input')||!body.input||typeof body.input!=='object'||Array.isArray(body.input)) {
    return {status:400,body:{code:'invalid_validation_request',evaluation_performed:false,attempt_consumed:false,
      error:'Send only {tool,input}; input must be an object. No payment credentials or caller schemas.'}};
  }
  const key=validatorKey(profile,body.tool);
  const validate=Object.hasOwn(validators,key)&& (!(isMcpTrialTool(body.tool)||isAnswerReviewTool(body.tool))||trialEnabled) ? validators[key] : null;
  if(!validate) return {status:400,body:{code:'unknown_validation_tool',evaluation_performed:false,attempt_consumed:false,
    available_tools:validationCatalog(profile).map(row=>row.name).filter(name=>trialEnabled||!(isMcpTrialTool(name)||isAnswerReviewTool(name)))}};
  if(new TextEncoder().encode(JSON.stringify(body)).length>INPUT_VALIDATION_MAX_BYTES) return {status:413,body:{code:'validation_body_too_large',evaluation_performed:false,attempt_consumed:false}};
  const pending=[[body.input,0]];let nodes=0;
  while(pending.length) {
    const [value,depth]=pending.pop();
    if(++nodes>10000||depth>64) return {status:413,body:{code:'validation_complexity_limit',evaluation_performed:false,attempt_consumed:false}};
    if(value&&typeof value==='object') for(const child of Object.values(value)) pending.push([child,depth+1]);
  }
  const valid=validate(body.input),errors=validate.errors||[];
  const findings=errors.slice(0,64).map(error=>({code:error.keyword,instance_path:error.instancePath,
    schema_path:error.schemaPath,message:error.message||'Input does not match the published schema.'}));
  const missing=errors.filter(error=>error.keyword==='required').slice(0,64)
    .map(error=>error.instancePath+'/'+pointer(error.params.missingProperty));
  return {status:200,body:{valid,tool:body.tool,validation_scope:'published_input_schema_only',evaluation_performed:false,
    payment_required:false,attempt_consumed:false,authorization_granted:false,findings,missing_fields:[...new Set(missing)],findings_truncated:errors.length>64}};
}
