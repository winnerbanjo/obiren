# Compliance and launch readiness

**Status:** every technical control is implemented and covered by e2e tests. What
remains is approval and configuration — no API route is missing.

Two columns matter for launch: **Enforced by** (the code that already refuses the
unsafe path) and **Sign-off needed** (the human decision that unlocks it).

| Gate | Enforced by | Default behaviour today | Sign-off needed |
| --- | --- | --- | --- |
| Consent purposes, policy versions, revocation | `POST /consents`, `PATCH /privacy-settings` append immutable events; features read the latest event (`health_sharing`, `location_sharing`) before acting | Undecided purpose is reported as `granted: null`; sharing/location are refused | Product + privacy: purpose list, lawful basis, policy version strings, which consent gates which action |
| Health-data encryption | AES-256-GCM at rest for notes, messages, brief snapshots and the MFA secret (`HEALTH_DATA_ENCRYPTION_KEY`) | Refuses to start in production without the key; no fallback secret | Security: key ownership, rotation and custodian |
| Payment / refunds / promotions | `PAYMENT_ENABLED` + `PAYMENT_POLICY_VERSION` + `PAYSTACK_SECRET_KEY`; checkout returns 503 and writes nothing otherwise; paid cancellations become `pending_policy`; promo validation returns `applied: false` | Fully fail-closed | Product + finance: prices, currency per market, cancellation/refund policy, promo rules, Paystack live keys |
| Medical content | `PUT /admin/articles/:id/review` requires evidence; publish refuses without `approved`; editing resets approval | Only reviewed content is public | Clinical reviewer: review workflow, evidence retention, copy approval |
| Pregnancy/cycle copy and warnings | Copy lives in responses with explicit non-contraceptive metadata; kick counting gated at 28 weeks | No prediction is presented as contraception or diagnosis | Clinical: wording, thresholds, urgent-symptom escalation |
| Emergency resources / SOS | `/safety/resources` reports `dispatchSupported: false`, `freshness` and `operationallyConfirmed: false` until a staff review with evidence exists; SOS never claims delivery without provider evidence | Nothing is confirmed by default | Safety operations: call each provider, record the review, approve per-country resources |
| Guardian invitations | Token hashed, single-use, expiring; `invitationDelivery: disabled_pending_approved_channel`; resend throttled | No message is sent or claimed | Operations: approved delivery channel and identity-verification challenge |
| Attachments | Metadata only; `scanStatus: not_configured`, downloads return 503 | Nothing unscanned leaves storage | Security: malware-scanning provider |
| Erasure and retention | `request-deletion` + cancellable window, export endpoint; retention job previews by default and only deletes expired operational rows | Health records are never auto-purged; erasure is operator-managed | Privacy/legal: retention schedule, exceptions (e.g. payment receipts), DSAR SLA |
| MFA for staff | TOTP enrol/verify/challenge, encrypted secret, recovery codes | Opt-in per account | Security: which roles must enable it (then enforce at the role level) |
| Rate limits / abuse | Global throttler (Redis-backed when `REDIS_URL` is set), auth and SOS-specific limits, idempotency keys | On | Security: confirm limits for launch traffic |
| Email / SMS / push delivery | Providers fail closed; unconfigured delivery is recorded as failed, never "sent" | Disabled without credentials | Operations: Resend domain, Twilio sender, APNs/FCM credentials |

## Credential checklist (the only remaining blockers)

| Variable | Unlocks |
| --- | --- |
| `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS`, `CRON_SECRET`, `HEALTH_DATA_ENCRYPTION_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `REDIS_URL` | Production startup (the API refuses to boot without them) |
| `PAYSTACK_SECRET_KEY`, `PAYMENT_ENABLED=true`, `PAYMENT_POLICY_VERSION` | Checkout and webhook confirmation |
| `RESEND_API_KEY` (domain verified) | Verification and password-reset email |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | WhatsApp delivery and signed inbound webhooks |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Health-vault upload/download |
| Push credentials (APNs/FCM) | Device notification delivery |
| `RETENTION_EXECUTION_ENABLED=true` | Retention job may delete expired operational rows |
| `GOOGLE_CLIENT_ID` / audience (not yet implemented) | Google sign-in, once provider ownership is agreed |

## Pre-launch alignment (in order)

1. Product/privacy sign-off on consent purposes, policy versions and the privacy
   notice text; then set the versions the clients send.
2. Finance/product sign-off on prices, refunds and promotions; set Paystack keys
   and `PAYMENT_ENABLED` in staging and run the sandbox replay/mismatch tests.
3. Clinical sign-off on article copy, pregnancy/cycle wording and warnings.
4. Safety operations: call and record every emergency resource, then approve the
   guardian/SOS delivery channel.
5. Security: scanning provider for attachments, MFA mandate for privileged
   roles, key rotation plan, load test and P95 targets.
6. Legal: retention schedule, DSAR SLA, vendor DPAs, then enable erasure
   execution.

## What is deliberately not claimed

- No emergency dispatch, guaranteed rescue or government alerting.
- No refund, subscription plan, price or promo discount is applied by the API
  until the approved policy and credentials exist.
- No attachment is downloadable before scanning.
- No article is public before medical review.
- No unverified clinician appears in the patient catalogue.
