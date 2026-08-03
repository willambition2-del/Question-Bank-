# Retrieval and grounded answer flow

Documents are stored outside PostgreSQL. Extraction produces normalized,
checksummed chunks with document, page and curriculum metadata. The current
retriever uses deterministic indexed keyword scoring; the vector interface is
disabled unless deployment support is explicitly verified.

For a grounded request:

1. Resolve the enabled knowledge base and curriculum scope.
2. Retrieve only enabled chunks from ready documents.
3. Apply subject, unit and lesson filters.
4. Enforce the configured top-k and context budget.
5. If evidence is insufficient, return `INSUFFICIENT_CONTEXT` without
   generation.
6. Supply retrieved excerpts to the gateway with an active versioned prompt.
7. Validate each returned citation against the retrieved document/page set.
8. Remove unverified citations and return only the public response contract.

No document text, question content or generated answer is written to usage
logs. Reprocessing replaces chunks for the selected document; archiving disables
it from subsequent retrieval.

