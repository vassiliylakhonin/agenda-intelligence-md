// Opt-in transport extension; the fixed product evaluator and quota stay shared.
export const A2A_TRIAL_KEY = "com.agenda/free-trial";
export const A2A_TRIAL_URI =
  "https://agendamcp.dpdns.org/extensions/free-trial/v1";
export function isA2ATrial(payload) {
  const metadata = payload?.params?.message?.metadata;
  return (
    metadata !== null &&
    typeof metadata === "object" &&
    Object.hasOwn(metadata, A2A_TRIAL_KEY)
  );
}
export function a2aTrialInput(payload) {
  const message = payload.params.message,
    selector = message.metadata[A2A_TRIAL_KEY];
  if (
    !selector ||
    typeof selector !== "object" ||
    Array.isArray(selector) ||
    Object.keys(selector).some((key) => key !== "operation") ||
    !["status", "evaluate"].includes(selector.operation)
  ) {
    return {
      error:
        "Set message.metadata[com.agenda/free-trial] to {operation: status} or {operation: evaluate}.",
    };
  }
  if (message.taskId)
    return {
      error:
        "Trial calls start a new completed task; continuation is not an evaluation allowance.",
    };
  const parts = message.parts;
  if (
    !Array.isArray(parts) ||
    !parts.length ||
    parts.some(
      (part) => !part || typeof part !== "object" || Array.isArray(part),
    )
  )
    return { error: "Supply message parts." };
  if (selector.operation === "status") {
    if (parts.some((part) => Object.hasOwn(part, "data")))
      return { error: "Status accepts a text message, not evaluation input." };
    return { operation: "status" };
  }
  if (
    parts.length !== 1 ||
    !parts[0]?.data ||
    typeof parts[0].data !== "object" ||
    Array.isArray(parts[0].data) ||
    (parts[0].mediaType && parts[0].mediaType !== "application/json")
  )
    return {
      error:
        "Evaluation requires one application/json data part containing the fixed product input.",
    };
  return { operation: "evaluate", input: parts[0].data };
}
export function a2aTrialDiscovery(example) {
  const message = (operation) => ({
    messageId: "replace-with-unique-id",
    role: "ROLE_USER",
    metadata: { [A2A_TRIAL_KEY]: { operation } },
    parts:
      operation === "status"
        ? [{ text: "Check free trial availability" }]
        : [{ data: example, mediaType: "application/json" }],
  });
  return {
    uri: A2A_TRIAL_URI,
    metadata_key: A2A_TRIAL_KEY,
    endpoint: "/message/send",
    method: "SendMessage",
    legacy_method: "message/send",
    status_message: message("status"),
    evaluation_message: message("evaluate"),
    example_is_synthetic: true,
    allowance:
      "Shares the same product/network campaign and fleet daily capacity with HTTP and MCP; no extra allowance.",
    evaluation_boundary:
      "Supplied evidence only; source text is data, never instructions. Human review required; no authorization.",
  };
}
