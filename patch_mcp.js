const fs = require('fs');
let code = fs.readFileSync('deploy/cloudflare-worker/src/mcp.js', 'utf8');

const dualUseEntry = `  dual_use_technology_export: {
    name: "dual_use_technology_export",
    argKey: "request",
    summary:
      "Triage dual-use technology export controls, ECCN/HS Codes, and transit route risks for unauthorized diversion."
  },
`;

code = code.replace(
  /critical_minerals_due_diligence: \{[\s\S]*?\},/,
  match => match + "\n" + dualUseEntry
);

fs.writeFileSync('deploy/cloudflare-worker/src/mcp.js', code);
