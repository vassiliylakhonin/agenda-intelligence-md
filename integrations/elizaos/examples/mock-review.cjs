// Synthetic offline demonstration. No network, wallet, payment or settlement.
const { AgendaGuardClient } = require('../dist/index.js');
const assert = require('node:assert/strict');

const client = new AgendaGuardClient({fetch:async()=>Response.json({
  financial_guard_verdict:{
    decision:'step_up_human_required', status:'not_decision_ready', score:40,
    human_review_required:true, evidence_gaps:['Authoritative wallet history unavailable'],
    execution_advisory:'Hold for human review; do not sign', violations:[],
  },
})});

async function main() {
  const verdict = await client.checkTransactionSafety({
    recipient:'0x1111111111111111111111111111111111111111', amount_usd:50,
    intent:'Synthetic evidence-review example',
  });
  assert.equal(verdict.is_safe,false);
  assert.equal(verdict.human_review_required,true);
  console.log(JSON.stringify({synthetic:true, signing_authorized:false, verdict},null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
