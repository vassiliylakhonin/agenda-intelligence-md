import {WorkflowEntrypoint} from 'cloudflare:workers';
import legacy from './index.js';
import {handleResearch} from './research-http.js';
import {cleanupResearch,executeResearch,researchDiscovery} from './corridor-research.js';
import {maybeSignCard} from './jws.js';

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
    if(env.RESEARCH_ENABLED==='1'&&['/.well-known/agent-card.json','/.well-known/agent.json'].includes(new URL(request.url).pathname)&&response.ok) {
      const card=await response.json();
      card.capabilities??={};card.capabilities.extensions??=[];
      card.capabilities.extensions.push({uri:'https://agendamcp.dpdns.org/capabilities/corridor-research',required:false,
        description:'Experimental bounded Middle Corridor/Caspian research; human review required.',
        params:{discovery:'/.well-known/corridor-research.json',...researchDiscovery(env)}});
      delete card.signatures;
      return Response.json(await maybeSignCard(card,env),{status:response.status,headers:response.headers});
    }
    return response;
  },
  async scheduled(event,env,ctx) {
    if(legacy.scheduled)await legacy.scheduled(event,env,ctx);
    await cleanupResearch(env);
  }
};
