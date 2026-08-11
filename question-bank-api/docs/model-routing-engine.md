# Model routing engine

Routing is database driven and keyed by task type. A policy selects enabled
candidates without relying on public or hard-coded model names.

## Eligibility

Candidates are removed when the provider/model is disabled or unhealthy, its
circuit is open, a required capability is missing, context is too small, the
estimated request cost exceeds policy, or its configured minute/day/cost budget
has been reached. Daily windows use UTC and successful request logs.

## Ordering and fallback

Eligible candidates are ordered using the configured strategy: priority,
weighted, lowest estimated cost, lowest observed latency, quality first, or
balanced. The primary candidate is preferred when eligible. The gateway tries
no more than `maxFallbacks + 1` candidates and only falls back for normalized
retryable failures.

Circuit state is stored in Redis. Authentication, invalid input and other
non-retryable failures do not cascade to another candidate. When no candidate
is eligible the API returns a generic temporary-unavailability response.

Cost/request checks are routing admission controls. Redis user/global quotas
remain the atomic abuse boundary; operators should leave headroom in financial
budgets for concurrent requests.

