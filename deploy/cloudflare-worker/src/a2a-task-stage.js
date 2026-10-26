// A response-stage observation, never a customer, payment or authorization claim.
export const A2A_TASK_STAGES=['setup','routing','input_required','evaluation_completed','failed','unmeasured'];
export function taskStage(stage){
  if(!A2A_TASK_STAGES.includes(stage))stage='unmeasured';
  return {version:1,stage,evaluation_performed:stage==='evaluation_completed'?true:['setup','routing','input_required'].includes(stage)?false:null,
    scope:'response_stage_only',human_review_required:true};
}
export function executionTaskStage(result,{routing=false,utility=false}={}){
  const state=result?.status?.state;
  if(state==='TASK_STATE_FAILED')return taskStage('failed');
  if(state==='TASK_STATE_INPUT_REQUIRED')return taskStage('input_required');
  if(state!=='TASK_STATE_COMPLETED')return taskStage('unmeasured');
  return taskStage(utility?'setup':routing?'routing':'evaluation_completed');
}
export function taskStageObservation(profile,stamp,status=200){
  if(!stamp||stamp.version!==1||!A2A_TASK_STAGES.includes(stamp.stage)||stamp.scope!=='response_stage_only'||stamp.evaluation_performed!==taskStage(stamp.stage).evaluation_performed||!Number.isInteger(status)||status<100||status>599)return null;
  return {agent_profile:profile,task_stage_version:1,a2a_stage:stamp.stage,evaluation_performed:stamp.evaluation_performed,http_status:status};
}
export function documentArchiveIntent(text){
  if(typeof text!=='string')return false;const value=text.slice(0,8000).toLowerCase();
  return /archive|архив/u.test(value)&&/document|file|документ|файл/u.test(value)&&/reconcil|review|duplicate|missing|checklist|свер|дубл|пропуск|реестр|проверк|разбор/u.test(value);
}
export function documentArchiveRoute(origin){
  const url=origin+'/document-archive';
  const data={workflow:'document_archive_review',workspace_url:url,next_action:'prepare_local_archive',
    required_inputs:['Your purpose and intended reviewer','An explicit checklist and responsible owners','Authorized local source files'],
    limits:{files:50,bytes_per_file:5242880,total_source_bytes:20971520},
    evaluation_performed:false,human_review_required:true,authorization_granted:false};
  return {kind:'task',id:crypto.randomUUID(),contextId:crypto.randomUUID(),status:{state:'TASK_STATE_COMPLETED'},
    artifacts:[{artifactId:crypto.randomUUID(),name:'Document archive review — next steps',parts:[
      {mediaType:'text/markdown',text:`# Prepare a document archive review\n\nOpen the free local workspace: ${url}\n\n1. Define the purpose, reviewer and checklist.\n2. Select authorized files on your device and assign them to checklist items.\n3. Review same-byte copies, name collisions and missing distinct documents.\n4. Download the source-linked reviewer ZIP or checked JSON backup.\n\nThis response routes the task; no supplied documents were evaluated. File contents remain in the browser. Requirements are user-defined. A person reviews content and authenticity. No upload, payment, message or approval is performed.`},
      {mediaType:'application/json',data}]}],
    metadata:{product_profile:'agenda',operation:'document_archive_route',response:data,task_persisted:false}};
}
