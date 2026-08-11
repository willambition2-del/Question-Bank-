# Intelligent services administration

All routes in this guide require an authenticated `SUPER_ADMIN`. Internal
provider, model, cost, health and routing information must never be copied into
student-facing endpoints.

## Providers and credentials

Provider endpoints live under `/admin/intelligent-services/providers`.
Credentials are encrypted before persistence. Read responses expose only
`credentialConfigured` and, when available, a last-four mask. They never return
ciphertext or plaintext.

On update, omit the credential field or submit an empty value to retain the
current credential. Submit a non-empty value to replace it. Creation,
replacement, connection-test results and disable operations create credential
audit records. Deleting a provider or model disables it; it does not remove
historical usage records.

Connection tests are private operations. Failures return a stable platform error
and do not forward an upstream response body.

## Models, routing and prompts

- Models declare capabilities, context/output limits, pricing and health.
- Routing policies own an ordered candidate list and increment
  `routingVersion` whenever they are edited.
- Prompt edits create a new immutable version. Activation deactivates the
  previously active prompt for the same task in one transaction.
- Usage policies control feature enablement, roles, token/image limits,
  per-user/global quotas and cooldowns.

Keep new providers, models, policies and knowledge bases disabled until their
configuration and connection tests have been reviewed.

## Knowledge bases

Knowledge-base routes live under `/admin/knowledge-bases` and
`/admin/knowledge-documents`. Uploads are multipart requests and pass through
the file signature, MIME, extension, size and path-containment checks described
in the ingestion documentation. Delete operations archive documents or disable
knowledge bases. Test search exposes retrieved excerpts and scores only inside
the protected control plane.

## Monitoring

The protected overview exposes request outcomes, latency, cost, fallback and
cache rates, tasks, document processing counts and recent stable error codes.
Detailed health and request logs are available to the control center. Logs do
not contain prompts, full user text, images, document contents, credentials,
authorization headers or identity-provider tokens.
