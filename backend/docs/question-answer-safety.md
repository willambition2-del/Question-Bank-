# Question answer safety

Question-aware operations use `QuestionContextService`; clients cannot submit
question text, answer keys, correctness or explanations as trusted context.

During an active attempt:

- hint requests require an owned active attempt with hints enabled;
- hint context excludes the correct option/boolean and explanations;
- prompts require a progressive hint and prohibit stating the answer;
- explanation requires a recorded answer and the attempt explanation policy;
- full answer review requires an owned completed attempt with explanations
  enabled.

The service resolves all question and attempt state from PostgreSQL and checks
ownership, status and settings on every request. Public responses pass through
the privacy validator and contain no selected route, model/provider identifiers,
pricing details, prompts or credentials.

Regression coverage must include hints disabled, unanswered explanation,
active-attempt answer leakage, completed review, cross-user access, and public
response privacy.

