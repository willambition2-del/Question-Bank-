# Usage, cost and quota policy

All provider-bound requests pass through `UsageGovernanceService` before model
routing. The service loads the task policy, verifies the active user's role,
checks input and image limits, and reserves usage in Redis.

## Counters

One atomic Redis script checks and increments:

- per-user daily usage;
- per-user monthly usage;
- platform-wide daily usage; and
- per-user/task cooldown.

Limits set to zero are unlimited. Keys use UTC day and month boundaries. Redis
is mandatory in production; the in-memory implementation exists only for local
development and deterministic tests.

## Request accounting

After quota reservation, one `ServiceRequestLog` row is created with `PENDING`
status. On completion it is conditionally transitioned from `PENDING` to
`SUCCEEDED` or `FAILED`, preventing terminal accounting from being applied
twice. The record contains token counts, latency, internal routing identifiers,
fallback count, estimated cost, prompt version and whether knowledge retrieval
was used.

Request logs intentionally exclude prompts, user text, images, document
contents, credentials, authorization headers and identity-provider tokens.
Internal provider/model fields are available only to the protected control
plane and never enter the public assistant response.

## Client contract

The public response may expose `usage.remainingToday`. It does not expose model
pricing, provider identity, internal routing, or platform-wide spend. Flutter
limits are informational only; backend enforcement remains authoritative.
