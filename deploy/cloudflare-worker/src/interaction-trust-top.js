// First-screen explainer for the agentic_interaction_trust landing page.
// Every claim below is bound to the live contract: schemas/v1/agentic-interaction-trust-*.schema.json,
// the hosted free_trial/free_trial_status MCP tools and the x402 price line. Do not add
// capability, scoring or authorization claims here; the tool grades supplied evidence only.
export function interactionTrustTopHtml() {
  return `<section class="card" id="missing-evidence-check" aria-labelledby="missing-evidence-check-title">
    <h2 id="missing-evidence-check-title">Not a trust score. A missing-evidence checklist.</h2>
    <p>An unknown agent asks to do something high-stakes: call a tool, move money, read a file. Before you say yes, this review checks the evidence you supply about that one interaction and lists what is missing. It checks this interaction, not the agent's history, and it does not give a reputation score.</p>
    <p><strong>What you get back</strong></p>
    <ul>
      <li><strong>Triage recommendation:</strong> <code>allow_low_risk</code>, <code>require_step_up</code>, <code>escalate_to_human_review</code>, <code>block_until_verified</code>, <code>not_decision_ready</code> or <code>insufficient_information</code>. Routing advice for a human, never permission: every response has <code>authorization_granted: false</code>.</li>
      <li><strong>Trust signal:</strong> <code>low</code> / <code>medium</code> / <code>medium_high</code> / <code>high</code> / <code>unknown</code>, saying how much of the expected evidence your supplied records cover.</li>
      <li><strong>Decision-readiness score:</strong> a heuristic 0-100 measure of how ready your evidence pack is for a human decision. Not approval, and not a reputation score.</li>
      <li><strong>Evidence gaps:</strong> the specific missing categories, for example operator or principal authorization, agent card or signed manifest, tool scope, session authentication, action intent or target-action evidence.</li>
      <li><strong>Repair list:</strong> when a request is rejected or incomplete, <code>remediation.issues</code> gives one entry per problem: what is wrong, what to fix and how to recheck.</li>
    </ul>
    <p><strong>What this does not do.</strong> It does not verify that the agent is who it claims to be, and it does not check whether your evidence is true. It grades only the records you supply, so fabricated records can look complete; do not fabricate missing evidence. It does not authorize the action, and it gives no legal, compliance, sanctions, financial or cybersecurity advice. Human review is required.</p>
    <p><strong>Interaction Trust, then Vizier.</strong> First this page: do you have the evidence to trust this interaction, and what is missing? It enforces nothing. Then <a href="https://vizier.agendamcp.dpdns.org/">Vizier</a>: with the evidence collected, a signed grant authorizes one action and returns ALLOW, BLOCK or REVIEW with a receipt bound to the request.</p>
    <p><strong>The six required fields, in plain words</strong></p>
    <ol>
      <li><code>actor</code>: who is asking. A declared type (<code>ai_agent</code>, <code>automation_script</code>, <code>api_client</code>, <code>browser_bot</code>, <code>human_delegated_agent</code>, <code>unknown</code> or <code>other</code>) and a declared name; optionally the operator and authentication context.</li>
      <li><code>target_surface</code>: where it would act. <code>checkout</code>, <code>account</code>, <code>api</code>, <code>mcp_tool</code>, <code>a2a_endpoint</code>, <code>content_or_catalog</code>, <code>auth_flow</code>, <code>support_or_messaging</code> or <code>other</code>.</li>
      <li><code>requested_action</code>: the concrete action it wants to perform.</li>
      <li><code>decision_stage</code>: when you are deciding. <code>pre_execution</code>, <code>in_session</code>, <code>post_alert</code>, <code>policy_review</code>, <code>committee_review</code> or <code>other</code>.</li>
      <li><code>dated_sources</code>: the evidence you hold. Each record needs an <code>id</code>, a <code>source_type</code> (17 categories, from <code>agent_identity_claim</code> to <code>human_review_note</code>), a <code>title</code> and a <code>date</code>.</li>
      <li><code>risk_question</code>: the question you want answered, for example "Is this agent-mediated checkout ready to allow, step up, or route to human review?"</li>
    </ol>
    <p>2 free checks per network address per product for this campaign; shared networks share the allowance and it does not reset daily. Free checks need no wallet or HTTP adapter: agents call <code>free_trial_status</code>, then <code>free_trial</code>. After the allowance, 0.01 USDC per paid check on Base.</p>
  </section>`;
}
