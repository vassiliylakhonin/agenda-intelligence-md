import {MCP_PROTOCOL_VERSION,MCP_SUPPORTED_PROTOCOL_VERSIONS,MCP_META_PROTOCOL_VERSION} from './mcp.js';
export const isModernMcpHttp=(request,body)=>request.headers.get('mcp-protocol-version')===MCP_PROTOCOL_VERSION ||
  body?.params?._meta?.[MCP_META_PROTOCOL_VERSION]===MCP_PROTOCOL_VERSION;
function decodeName(value) {
  if(value===null) return null;
  if(value.startsWith('=?base64?')&&value.endsWith('?=')) {
    const encoded=value.slice(9,-2);
    if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded))return null;
    try{return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(encoded),char=>char.charCodeAt(0)));}catch{return null;}
  }
  return /^[\x20-\x7e]*$/u.test(value)&&value.trim()===value ? value : null;
}
export function mcpHttpRejection(request,body) {
  const header=request.headers.get('mcp-protocol-version');
  const modern=isModernMcpHttp(request,body);
  const error=(code,message,data)=>({jsonrpc:'2.0',id:typeof body?.id==='string'||typeof body?.id==='number'?body.id:null,error:{code,message,...(data?{data}:{})}});
  if(header&&!MCP_SUPPORTED_PROTOCOL_VERSIONS.includes(header)) return error(-32022,'Unsupported protocol version',{supported:[...MCP_SUPPORTED_PROTOCOL_VERSIONS]});
  if(!modern)return null; // The supported legacy era keeps its own handshake.
  if(!body||typeof body!=='object'||Array.isArray(body)||body.jsonrpc!=='2.0'||typeof body.method!=='string'||
    (body.id!==undefined&&!(typeof body.id==='string'||typeof body.id==='number'&&Number.isFinite(body.id)))||
    (body.params!==undefined&&(!body.params||typeof body.params!=='object'||Array.isArray(body.params)))) return error(-32600,'Invalid Request');
  if(body.id===undefined) return body.method==='notifications/initialized'?null:error(-32600,'Notification not supported');
  if(header!==body.params?._meta?.[MCP_META_PROTOCOL_VERSION] || request.headers.get('mcp-method')!==body.method) return error(-32020,'Header mismatch: protocol version and method headers must match the request body');
  const source=body.method==='resources/read'?'uri':['tools/call','prompts/get'].includes(body.method)?'name':null;
  if(source&&(typeof body.params?.[source]!=='string'||decodeName(request.headers.get('mcp-name'))!==body.params[source])) return error(-32020,'Header mismatch: Mcp-Name must match the request body');
  return null;
}
export function mcpHttpStatus(request,body,result) {
  if(!isModernMcpHttp(request,body))return 200;
  if(result?.error?.code===-32601)return 404;
  return [-32600,-32700,-32020,-32022].includes(result?.error?.code)?400:200;
}
