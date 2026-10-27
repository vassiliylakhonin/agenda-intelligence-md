import {WorkflowEntrypoint} from 'cloudflare:workers';
import legacy from './index.js';
import {handleResearch} from './research-http.js';
import {cleanupResearch,executeResearch,researchDiscovery} from './corridor-research.js';

export class CorridorResearchWorkflow extends WorkflowEntrypoint {
  async run(event,step) {
    return executeResearch(this.env,event.payload.research_id,{step});
  }
}
export default {
  async fetch(request,env,ctx) {
    const research=await handleResearch(request,env);if(research)return research;
    const response=await legacy.fetch(request,env,ctx);
    // Advertise an additive research interface without changing the existing MCP tool contracts.
    if(env.RESEARCH_ENABLED==='1'&&new URL(request.url).pathname==='/.well-known/agent-card.json'&&response.ok) {
      const card=await response.json();
      card.x_agenda_research={discovery:'/.well-known/corridor-research.json',...researchDiscovery(env)};
      return Response.json(card,{status:response.status,headers:response.headers});
    }
    return response;
  },
  async scheduled(event,env,ctx) {
    if(legacy.scheduled)await legacy.scheduled(event,env,ctx);
    await cleanupResearch(env);
  }
};
