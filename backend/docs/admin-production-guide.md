# Admin production guide

The dashboard uses an HttpOnly-cookie BFF and does not expose backend tokens to
browser code. Next Proxy performs only optimistic redirects; backend
`SUPER_ADMIN` authorization remains authoritative for every management route.

Production build uses Next standalone output and no build-time Google Font
download. Providers, models, routing, prompts, knowledge, documents, usage,
policies and health pages call live BFF routes. The home dashboard also uses
live usage data and displays an explicit error rather than fabricated values.

Before release, verify login/refresh/logout, ordinary-user 403, secret masking,
provider/model tests, route reordering, prompt activation, document
reprocessing and health against the production-like backend.
