# Question-aware assistant

The assistant is a fixed-purpose backend capability. Clients cannot select a
provider, model, routing policy, prompt, or arbitrary task type. All public
responses use the stable `AssistantResponse` contract and omit gateway metadata.

## Context modes

- `HINT_SAFE` contains the published question, option text, reading passage and
  an existing hint only. Correctness and explanations are explicitly projected
  out. If the question belongs to an active attempt with hints disabled, the
  request is rejected.
- `EXPLANATION_AFTER_ANSWER` requires an owned attempt and a persisted answer.
  During an active attempt it is allowed only when the quiz setting is
  `AFTER_EACH`. It is always rejected when explanations are disabled.
- `REVIEW_FULL` requires an owned completed attempt and enabled explanations.
- `ADMIN_CONTENT_GENERATION` is reserved for the protected control plane and is
  not exposed by the student controller.

The immutable quiz snapshot is used for attempt-related operations. This keeps
the quiz engine authoritative even if an editor later changes the live question.

## Prompt and retrieval boundaries

Active, versioned prompts are loaded from the database. Missing prompts fail
closed with `PROMPT_NOT_CONFIGURED`; there is no hidden provider-specific
fallback prompt.

Retrieved document excerpts are placed inside a marked untrusted-data boundary.
Knowledge answers are not generated when retrieval returns no suitable chunks.
Provider-proposed citations are accepted only if their document and page pair
matches a chunk actually retrieved for that request.

## Public endpoints

- `POST /assistant/chat`
- `POST /assistant/questions/:id/hint`
- `POST /assistant/questions/:id/explain`
- `POST /assistant/questions/:id/review-answer`
- `POST /assistant/lessons/:id/summarize`
- `POST /assistant/lessons/:id/simplify`
- `POST /assistant/knowledge/ask`

Every endpoint requires platform authentication, uses DTO allow-list
validation, and is throttled. Flutter must call these endpoints only and must
never call an external service provider directly.
