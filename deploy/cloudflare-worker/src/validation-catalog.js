// Published MCP inputs and the existing raw trial contract are the only schemas
// accepted by preflight. Callers cannot supply a schema or select another host.
import {mcpToolsForProfile} from './mcp.js';
import {TRIAL_PROFILES} from './trial-profiles.js';
import {mcpTrialTools} from './mcp-trial.js';
import {PUBLIC_SCHEMAS} from './public-schemas.js';
const RAW_TRIAL_SCHEMAS={
  agent_financial_guard:'agent-financial-guard-request.schema.json',
  m2m_escrow_arbiter:'m2m-escrow-arbiter-request.schema.json'
};
export function validationCatalog(profile) {
  const tools=mcpToolsForProfile(profile);
  const primary=TRIAL_PROFILES[profile]?.tool;
  const trialSchema=RAW_TRIAL_SCHEMAS[profile]
    ? PUBLIC_SCHEMAS['schemas/v1/'+RAW_TRIAL_SCHEMAS[profile]]
    : tools.find(tool=>tool.name===primary)?.inputSchema;
  return [...tools.map(tool=>({name:tool.name,schema:tool.inputSchema})),
    ...mcpTrialTools({inputSchema:trialSchema},{tool:primary,agent_profile:profile,attempts_per_network:5}).map(tool=>({name:tool.name,schema:tool.inputSchema})),
    {name:'validate_input',schema:PUBLIC_SCHEMAS['schemas/v1/input-validation-request.schema.json']}];
}
export const validatorKey=(profile,name)=>profile+'__'+name;
