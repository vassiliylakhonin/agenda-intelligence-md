const NOTIFICATION_EMAIL = "vassiliy.lakhonin@gmail.com";
const EVENT_NAME = "cis_review_request_received";
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

function textResponse(value) {
  return ContentService.createTextOutput(value).setMimeType(ContentService.MimeType.TEXT);
}

function normalizedText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function hexBytes(bytes) {
  return bytes
    .map(function (byte) {
      return ((byte + 256) % 256).toString(16).padStart(2, "0");
    })
    .join("");
}

function constantTimeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  var difference = 0;
  for (var index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function expectedSignature(secret, timestamp, payload) {
  return hexBytes(
    Utilities.computeHmacSha256Signature(
      timestamp + "." + payload,
      secret,
      Utilities.Charset.UTF_8
    )
  );
}

function emailBody(request) {
  return [
    "New $99 CIS review request",
    "",
    "Request ID: " + request.request_id,
    "Received: " + request.submitted_at,
    "Reply to: " + request.email,
    "Language: " + request.locale,
    "Role and deal: " + request.role_deal_type,
    "Blocked: " + request.blocked,
    "Deadline: " + (request.deadline || "Not stated"),
    "",
    "Evidence already held:",
    request.evidence_held || "Not stated",
    "",
    "Reviewer request:",
    request.reviewer_request,
    "",
    "Cloudflare retention until: " + request.retention_until,
    "The public form asks for redacted context only."
  ].join("\n");
}

function doPost(event) {
  try {
    var envelope = JSON.parse((event.postData && event.postData.contents) || "{}");
    var timestamp = normalizedText(envelope.timestamp, 30);
    var payload = normalizedText(envelope.payload, 12000);
    var signature = normalizedText(envelope.signature, 128).toLowerCase();
    var secret = PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET") || "";
    if (!secret || !timestamp || !payload || !signature) return textResponse("ERROR");

    var timestampNumber = Number(timestamp);
    if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() - timestampNumber) > MAX_CLOCK_SKEW_MS) {
      return textResponse("ERROR");
    }
    if (!constantTimeEqual(signature, expectedSignature(secret, timestamp, payload))) {
      return textResponse("ERROR");
    }

    var message = JSON.parse(payload);
    var request = message && message.request;
    if (!message || message.event !== EVENT_NAME || !request) return textResponse("ERROR");

    request = {
      request_id: normalizedText(request.request_id, 80),
      submitted_at: normalizedText(request.submitted_at, 40),
      retention_until: normalizedText(request.retention_until, 40),
      locale: request.locale === "ru" ? "ru" : "en",
      email: normalizedText(request.email, 254),
      role_deal_type: normalizedText(request.role_deal_type, 240),
      blocked: normalizedText(request.blocked, 120),
      evidence_held: normalizedText(request.evidence_held, 1800),
      reviewer_request: normalizedText(request.reviewer_request, 1800),
      deadline: normalizedText(request.deadline, 240)
    };
    if (!request.request_id || !request.submitted_at || !validEmail(request.email) || !request.reviewer_request) {
      return textResponse("ERROR");
    }

    var cache = CacheService.getScriptCache();
    var cacheKey = "cis-review-" + request.request_id;
    if (cache.get(cacheKey)) return textResponse("OK");

    MailApp.sendEmail({
      to: NOTIFICATION_EMAIL,
      replyTo: request.email,
      name: "CIS review intake",
      subject: "New $99 CIS review request",
      body: emailBody(request)
    });
    cache.put(cacheKey, "sent", 21600);
    return textResponse("OK");
  } catch (error) {
    console.error(JSON.stringify({ event: "cis_review_email_relay", status: "failed", error: error.name || "Error" }));
    return textResponse("ERROR");
  }
}

function doGet() {
  return textResponse("CIS review email relay is active.");
}
