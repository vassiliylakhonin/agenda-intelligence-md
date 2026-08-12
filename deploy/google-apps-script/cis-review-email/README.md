# CIS review Gmail notification relay

This Google Apps Script web app sends an operational copy of a stored CIS
review request to `vassiliy.lakhonin@gmail.com`. Cloudflare KV remains the
system of record. Email delivery runs after storage and never changes the form
response.

## Google setup

1. Create a standalone Apps Script project in the receiving Google account.
2. Replace `Code.gs` with this directory's `Code.gs` and use the advanced
   editor to copy `appsscript.json`.
3. Add one Script Property named `WEBHOOK_SECRET` with a cryptographically
   random value. Never commit or paste it into source.
4. Deploy as a web app, execute as the deploying account, with access set to
   anyone. Authorize only the permission to send email.
5. Copy the `/exec` deployment URL.

## Cloudflare setup

Set the deployment URL and the same shared secret as encrypted Worker secrets:

```bash
npx wrangler secret put CIS_REVIEW_EMAIL_WEBHOOK_URL --env cis-secondary-sanctions
npx wrangler secret put CIS_REVIEW_EMAIL_WEBHOOK_SECRET --env cis-secondary-sanctions
```

The Worker accepts only an HTTPS `script.google.com` URL. It signs a timestamped
JSON payload with HMAC-SHA-256. The Apps Script rejects stale or invalid
signatures and suppresses duplicate request IDs for six hours.

The email contains the redacted first-pass fields and uses the applicant's work
email as `Reply-To`. Google Apps Script quotas apply. Do not include names,
attachments, account details, contracts, invoices, IDs or other confidential
content in the public form.
