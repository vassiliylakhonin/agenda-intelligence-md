// Presentation only. Routing, admission and specialist behavior are unchanged.
export function corridorAssistantTopHtml() {
  return `<section class="card" id="corridor-orientation" aria-label="Orientation and specialist selection">
    <h2>Choose a specialist, not a shipment verdict</h2>
    <p>Start with a plain-language trade question and the decision ahead. This is a free orientation tool, not another shipment or counterparty evidence gate. It suggests a specialist from keywords in your question; it does not assess whether a trade is safe or permitted.</p>
    <p><strong>You receive:</strong> a suggested review route, bank/compliance and insurer checklists, and an incomplete request draft when a specialist is selected. Complete and validate the draft before a separate submission. Nothing is sent to the specialist automatically.</p>
    <p><strong>Already know the review you need?</strong> Go directly to the Middle Corridor gate for a shipment file or CIS Exposure for a counterparty file. This assistant helps you choose; it does not run either review.</p>
    <details><summary>Inputs, HS hints and limits: read before routing</summary>
      <p>The main tool is <code>corridor_sanctions_assistant</code>. Its input is an optional <code>text</code> question, not a six-step cargo dossier. Without a question it returns the available gates. Use redacted inputs and keep unknown facts explicit.</p>
      <p>Maritime questions mentioning Hormuz, Bab-el-Mandeb or the Red Sea can lead to Gulf Maritime Exposure. These are routing suggestions, not findings about route exposure or a required review sequence.</p>
      <p>An explicitly labeled six-digit HS code can return a hint from the bundled, dated Common High Priority Items List (CHPL) reference snapshot. A match is only a review lead; no match is not clearance. This does not classify a product or settle licensing. The separate <code>screen_dual_use_hs_code</code> tool has its own admission and price. <a href="/.well-known/x402">Check operation prices</a>.</p>
      <p>This is not a comprehensive sanctions name-screening service. If configured, upstream checks may report name flags or unavailable screening; they do not verify identity or ownership or establish a clean counterparty. No cargo clearance, shipment authorization, or legal, compliance, sanctions or export-control advice is provided. Human review is required.</p>
      <p>Question routing, request preparation and schema preflight are free. Selected specialist evaluations and model exports have separate access terms. Routing needs no trial attempt; a saved example also consumes none. <a href="/terms#access">Read the access terms</a>.</p>
    </details>
  </section>`;
}
