import { MCP_AGENT_ENDPOINT_PATH } from './mcp.js';

// A business admission failure is a tool error for standard MCP clients. The
// original URL/body still goes through the paid executor and signature binding.
// HTTP authentication, malformed requests and legacy endpoints keep their status.
export async function mcpAgentAdmissionResponse(request, response) {
  if (new URL(request.url).pathname !== MCP_AGENT_ENDPOINT_PATH ||
      request.method !== 'POST' || ![401, 402].includes(response.status)) return response;
  const payload = await response.clone().json();
  const details = payload.error?.data;
  if (payload.jsonrpc !== '2.0' || !payload.error || details === null || typeof details !== 'object' ||
      (typeof payload.id !== 'string' && typeof payload.id !== 'number') ||
      (response.status === 401 && typeof details.challenge_message !== 'string')) return response;
  const admission = {
    evaluated: false,
    admission_status: response.status,
    payment_trace_id: response.headers.get('x-payment-trace-id'),
    payment_attempt_id: response.headers.get('x-payment-attempt-id'),
    next_step: response.status === 401
      ? 'The funding wallet must sign the exact challenge for this original request. Do not transfer again.'
      : 'Inspect pricing and admission details with the owner. Do not pay automatically. This is not an evaluation.',
    details
  };
  return Response.json({jsonrpc:'2.0', id:payload.id, result:{
    isError:true,
    content:[{type:'text', text:JSON.stringify(admission)}],
    _meta:{'com.agenda/admission':admission}
  }}, {status:200, headers:response.headers});
}
