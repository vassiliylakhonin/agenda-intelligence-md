// Read-only discovery plus explicit schema preflight. No evaluation, wallet,
// payment authorization, approval or automatic retry is performed here.
const LIMIT=1048576;
function trustedOrigin(value) {
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname)) throw Error('Provide an explicitly trusted HTTPS origin only.');
  return url.origin;
}
function sameOrigin(value,origin) {
  const url=new URL(value);
  if(url.origin!==origin||url.username||url.password) throw Error('Discovery link leaves the selected origin.');
  return url.href;
}
async function json(fetcher,url,options={}) {
  const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(15000),...options,
    headers:{accept:'application/json, application/schema+json',...options.headers}});
  if(!response.ok) throw Error('Contract request failed: HTTP '+response.status);
  if(!response.headers.get('content-type')?.includes('json')) throw Error('Expected JSON, received another content type.');
  const reader=response.body.getReader(),chunks=[];let size=0;
  for(;;) {
    const {done,value}=await reader.read();if(done)break;
    if((size+=value.byteLength)>LIMIT){await reader.cancel();throw Error('Contract response exceeds limit.');}
    chunks.push(value);
  }
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
export async function inspectMachineAgent(origin,{tool,fetcher=fetch,headers={}}={}) {
  origin=trustedOrigin(origin);
  const contract=await json(fetcher,origin+'/.well-known/agent-contract.json',{headers});
  if(contract.contract_version!=='agent-call.v1'||!Array.isArray(contract.offers)) throw Error('Unsupported machine contract.');
  const offer=contract.offers.find(item=>item.tool===tool);
  if(!offer)throw Error('The requested tool is not published by this host.');
  const [inputSchema,outputSchema,example]=await Promise.all([
    json(fetcher,sameOrigin(offer.input_schema_url,origin),{headers}),
    offer.output_schema_url?json(fetcher,sameOrigin(offer.output_schema_url,origin),{headers}):null,
    json(fetcher,sameOrigin(offer.example_url,origin),{headers})
  ]);
  const validationUrl=sameOrigin(contract.validation.http_endpoint,origin);
  if(new URL(validationUrl).pathname!=='/v1/validate-input'||contract.validation.payment_required!==false||contract.validation.evaluation_performed!==false) throw Error('Expected the explicit free preflight operation.');
  return {contract,offer,inputSchema,outputSchema,example,
    validate:input=>json(fetcher,validationUrl,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({tool,input})})};
}
