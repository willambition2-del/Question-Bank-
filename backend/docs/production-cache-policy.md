# Production cache policy

Only stable lesson summaries and simplifications are cached in this revision.
Keys contain task type, normalized content SHA-256, prompt version, active
routing version and safety mode. TTL is controlled by
`ASSISTANT_CACHE_TTL_SECONDS`.

Personal chat, active quiz work, answer review, private knowledge and image
analysis are never cached. Raw images, credentials, internal provider data and
prompts are never cache values. A lesson content, prompt or routing-version
change naturally produces a different key. Cache hits return a new request ID
and do not pretend to have consumed a new quota reservation.
