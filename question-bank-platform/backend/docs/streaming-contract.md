# Streaming contract and current gate

The target SSE event contract is `meta`, `delta`, `citation`, `usage`,
`complete`, and `error`. Metadata must never contain provider, model, route,
token or cost identifiers. Clients must not automatically replay a billable
POST after interruption.

True upstream streaming is intentionally **not enabled in this revision**.
The provider adapter contract currently returns a completed normalized result;
splitting that result into artificial deltas would not satisfy the production
requirement for aborting upstream work on disconnect. Release streaming only
after adapters expose an abortable async stream, usage is finalized exactly
once, heartbeat/timeout behavior is covered, and Flutter cancellation tests
pass. Non-streaming endpoints remain the supported production contract.
