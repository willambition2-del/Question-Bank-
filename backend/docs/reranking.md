# Reranking

Knowledge-base retrieval settings can enable reranking after hybrid
deduplication. The reranking task receives only candidate IDs, query, and
candidate text through the centrally governed gateway. Its output is parsed as
a strict ordered ID list; unknown and duplicate IDs are ignored.

If reranking is disabled, has fewer than two candidates, has no user context,
or returns an invalid response, retrieval safely retains the hybrid order.
Public responses expose sources but never reranker, provider, model, cost or
routing details.
