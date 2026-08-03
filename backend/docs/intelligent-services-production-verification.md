# Intelligent services production verification

Run this checklist in staging before enabling production traffic.

## Build and data

1. Back up PostgreSQL and document storage.
2. Run `npx prisma validate`.
3. Review migration SQL, then run `npx prisma migrate deploy`.
4. Run `npm run build`, `npm run lint`, `npm run test:ci` and the configured
   PostgreSQL E2E suite.
5. Start the API and document worker from the same immutable build.

Never use `prisma db push` or reset against production.

## Configuration

- Use strong, independently managed JWT secrets and credential master key.
- Keep intelligent services disabled until provider, model, prompt, route,
  usage policy and knowledge configuration are complete.
- Use an absolute durable document-storage mount shared with the worker.
- Require Redis durability/availability appropriate to quota and circuit state.
- Keep private-network provider URLs disabled unless explicitly approved.
- Configure CORS to the deployed client origins.

## Smoke tests

- Verify student auth and existing quiz flows first.
- Confirm admin reads never return ciphertext or plaintext credentials.
- Test each configured connection from the protected admin endpoint.
- Test route capability filtering, retryable fallback and open-circuit behavior.
- Verify disabled feature, role denial, cooldown and daily/monthly quota paths.
- Upload a small supported document; observe uploaded, processing and ready
  states, then test scoped retrieval and citations.
- Verify an unsupported/scanned document fails honestly when OCR is unavailable.
- During an active quiz, verify a hint cannot reveal the answer and explanation
  follows attempt settings.
- Confirm mobile traffic goes only to this API and receives no infrastructure
  identifiers.
- Confirm request logs contain metadata only and cost/health dashboards update.

Enable policies gradually and monitor failure rate, latency, fallback rate,
quota rejection, circuit state and spend. Roll back by disabling the affected
feature policy or route; do not delete configuration or migrations.

