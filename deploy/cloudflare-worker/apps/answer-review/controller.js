import {answerReviewErrors} from '../../src/answer-review.js';

export function mountAnswerReview(app, document) {
  const byId = id => document.getElementById(id);
  const answer=byId('answer'), rows=byId('sources');
  const status=byId('status'), result=byId('result'), review=byId('review'), allowance=byId('allowance');
  let busy=false, connected=false, quotaBlocked=false;
  let sourceSequence=1;
  const reservedSourceIds=new Set();
  const buttons=()=>{review.disabled=busy||!connected||quotaBlocked;allowance.disabled=busy||!connected;};
  const exhausted=status=>['network_allowance_exhausted','daily_capacity_exhausted'].includes(status);
  const quotaMessage=availability=>availability.status==='network_allowance_exhausted'
    ? 'This network has used its shared campaign allowance. It does not reset daily; opening another client does not create new attempts.'
    : `Today's shared free-trial capacity is full. Check the allowance again after ${availability.reset_at || 'the next UTC midnight'}.`;
  function nextSourceId() {
    let id;
    do{id='s'+sourceSequence++;}
    while(reservedSourceIds.has(id)||[...rows.children].some(row=>row.querySelector('input').value===id));
    return id;
  }
  function addSource(source={source_id:nextSourceId(),text:''}) {
    reservedSourceIds.add(source.source_id);
    const row=document.createElement('fieldset');
    const legend=document.createElement('legend');legend.textContent='Source excerpt';row.append(legend);
    const idLabel=document.createElement('label');idLabel.textContent='Source ID (for example s1)';
    const id=document.createElement('input');id.value=source.source_id;id.maxLength=64;id.required=true;idLabel.append(id);
    const reference=document.createElement('small');
    const updateReference=()=>{reservedSourceIds.add(id.value);reference.textContent=`Cite this source as [${id.value}] in your answer.`;};
    id.oninput=updateReference;updateReference();
    const textLabel=document.createElement('label');textLabel.textContent='Actual source text';
    const text=document.createElement('textarea');text.value=source.text;text.maxLength=20000;text.required=true;text.rows=4;textLabel.append(text);
    const remove=document.createElement('button');remove.type='button';remove.textContent='Remove source';remove.onclick=()=>row.remove();
    row.append(idLabel,reference,textLabel,remove);rows.append(row);
  }
  const parse=value=>value.structuredContent || JSON.parse(value.content?.find(item=>item.type==='text')?.text || '{}');
  function show(value) {
    const body=parse(value);
    if (value.isError) {
      if(body.code==='trial_exhausted'){quotaBlocked=true;buttons();}
      const hint=exhausted(body.trial?.limit_reason)?quotaMessage({status:body.trial.limit_reason}):body.error || '';
      status.textContent=`Review did not complete: ${body.code || body.error || 'admission refused'}. ${hint} No automatic retry. The previous result below is unchanged.`;
      return false;
    }
    if (body.evaluation) {
      result.hidden=false;
      result.textContent=body.evaluation.findings.length
        ? body.evaluation.findings.map(item=>`Line ${item.line}${item.source_id ? ' ['+item.source_id+']' : ''}: ${item.next_action}`).join('\n\n')
        : 'No issues found in the supported citation and quote structure. A human still needs to check whether each statement is supported by authentic, current sources.';
      byId('raw-result').textContent=JSON.stringify(body,null,2);
      status.textContent=`${body.evaluation.findings?.length || 0} citation/quote issues. Human review is required; semantic support and truth were not assessed. This review consumed one shared campaign attempt.`;
    }
    return true;
  }
  app.ontoolresult=value=>{try{show(value);}catch{status.textContent='Could not read this result. No automatic retry.';}};
  app.ontoolinput=value=>{
    const input=value.arguments;
    if (answerReviewErrors(input).length) return;
    answer.value=input.answer;rows.replaceChildren();input.sources.forEach(addSource);
  };
  byId('add-source').onclick=()=>{if(rows.children.length<20)addSource();};
  allowance.onclick=async()=>{
    if(busy||!connected)return;busy=true;buttons();
    try {
      const value=await app.callServerTool({name:'free_trial_status',arguments:{}}), body=parse(value);
      if(value.isError)show(value);
      else {
        if(!['available','network_allowance_exhausted','daily_capacity_exhausted'].includes(body.availability?.status))throw Error('Unknown allowance');
        quotaBlocked=exhausted(body.availability.status);
        status.textContent=quotaBlocked
          ? `${quotaMessage(body.availability)} No review was requested. You can check the allowance again; availability is advisory.`
          : `${body.availability.remaining_attempts} shared campaign attempts remain (${body.availability.status}). Shared networks share 5 attempts; this check consumed none. Availability is advisory.`;
      }
    } catch {status.textContent='Could not read the allowance. No review was requested. Retry only when you choose.';}
    finally{busy=false;buttons();}
  };
  review.onclick=async event=>{
    event.preventDefault();if(busy||!connected||quotaBlocked)return;
    const input={answer:answer.value,sources:[...rows.children].map(row=>({source_id:row.querySelector('input').value,text:row.querySelector('textarea').value}))};
    const errors=answerReviewErrors(input);
    if(errors.length){status.textContent=errors.join(' ');return;}
    busy=true;buttons();status.textContent='Reviewing supplied citations and quotes…';
    try{show(await app.callServerTool({name:'review_answer',arguments:input}));}
    catch{status.textContent='The result could not be received. The attempt may have been consumed. No automatic retry; the previous result below is unchanged.';}
    finally{busy=false;buttons();}
  };
  addSource();buttons();
  return app.connect().then(()=>{connected=true;buttons();if(result.hidden)status.textContent='Ready. Check your allowance, then choose Review. Opening this form performed no evaluation.';})
    .catch(()=>{status.textContent='This view needs an MCP Apps host. Use the ordinary review_answer tool with answer and sources instead. No evaluation was requested.';});
}
