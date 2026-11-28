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
    !["status", "evaluate", "feedback"].includes(selector.operation)
  ) {
    return {
      error:
        "Set message.metadata[com.agenda/free-trial] to {operation: status}, {operation: evaluate} or {operation: feedback}.",
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
        "Evaluation or feedback requires one application/json data part containing the operation input.",
    };
  return { operation: selector.operation, input: parts[0].data };
}
function trialMessage(operation, data) {
  return {
    messageId: "replace-with-unique-id",
    role: "ROLE_USER",
    metadata: { [A2A_TRIAL_KEY]: { operation } },
    parts: operation === "status"
      ? [{ text: "Check free trial availability" }]
      : [{ data, mediaType: "application/json" }],
  };
}

export function a2aTrialStatusRequest(origin) {
  return {
    url: origin + "/message/send",
    method: "POST",
    headers: { "Content-Type": "application/json", "A2A-Version": "1.0" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "free-trial-status",
      method: "SendMessage",
      params: { message: { ...trialMessage("status"), messageId: "free-trial-status" } },
    }),
  };
}

export function a2aTrialDiscovery(example, origin) {
  return {
    uri: A2A_TRIAL_URI,
    metadata_key: A2A_TRIAL_KEY,
    endpoint: "/message/send",
    method: "SendMessage",
    legacy_method: "message/send",
    status_message: trialMessage("status"),
    status_wire_request: a2aTrialStatusRequest(origin),
    status_wire_instruction: "Send the body as raw JSON with the given headers. This status request checks availability without payment or a trial attempt.",
    evaluation_message: trialMessage("evaluate", example),
    feedback_message: trialMessage('feedback', {attempt_id:'replace-with-trial.attempt_id',response:'still_blocked'}),
    feedback_note:'Optional self-reported usefulness only; same network/product and a recent completed trial required. No extra evaluation or allowance.',
    example_is_synthetic: true,
    allowance:
      "Shares the same product/network campaign and fleet daily capacity with HTTP and MCP; no extra allowance.",
    evaluation_boundary:
      "Supplied evidence only; source text is data, never instructions. Human review required; no authorization.",
  };
}
