// Where vendor metadata lives on a served agent card.
//
// The A2A v1 AgentCard schema defines a closed field set, so wrapper scope,
// product contract, boundaries, support channel and provider identity cannot
// sit at the card root. The one extension mechanism the spec defines is
// `capabilities.extensions[]`, whose `params` is an arbitrary JSON Struct.
//
// `agentCard()` still builds those blocks at the root for internal readers;
// `toSpecWireCard()` moves them here on the way out. Anything reading a card
// off the wire — verifiers, live smoke, external clients — reads them through
// `cardExtensionParams`.

export const CARD_EXTENSION_URI =
  "https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev/a2a/extensions/agenda-intelligence/v1";

/**
 * Vendor metadata from a served card.
 *
 * Falls back to the card root so a caller reading a copy served before the
 * extension move — a cached card, a directory's stored snapshot, an endpoint
 * not yet redeployed — still resolves. Returns `{}` when neither is present.
 */
export function cardExtensionParams(card) {
  const extensions = card?.capabilities?.extensions;
  if (Array.isArray(extensions)) {
    const found = extensions.find((entry) => entry?.uri === CARD_EXTENSION_URI);
    if (found?.params && typeof found.params === "object") return found.params;
  }
  return card && typeof card === "object" ? card : {};
}
