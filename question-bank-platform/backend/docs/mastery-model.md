# Mastery model

The mastery score is centralized in `MasteryService`. Controllers and quiz
handlers do not calculate mastery independently.

The score is bounded to 0–100 and combines:

- Accuracy: 50 points (`correct answers / attempts`).
- Repetition: 15 points, reaching its cap after five attempts.
- Consecutive correct answers: 15 points, capped at three.
- Recency: 10 points immediately after an answer, decaying linearly over 30 days.
- Speed: up to 10 points. It is capped so response speed cannot outweigh
  correctness; answers at or below 15 seconds receive the cap and the component
  reaches zero at 60 seconds.

A question is mastered only when all three conditions are met:

1. `masteryScore >= 80`.
2. At least three attempts have been recorded.
3. At least two consecutive correct answers have been recorded.

Manually reviewing a mistake never changes this score or `isMastered`. It only
sets `manualReviewedAt`, so the learner can distinguish reviewed items from
demonstrated mastery.

## Mastery timestamp policy

`masteredAt` records the first time demonstrated mastery is reached. If a later
wrong answer lowers the score and `isMastered` becomes false, the timestamp is
retained as historical evidence; it never grants current mastery by itself.

## Hierarchy aggregate mastery

Lesson, unit, and subject summaries are rebuilt from current visible question
progress. `masteryPercent` is the number of currently mastered questions divided
by all eligible READY, active, published, fully visible questions. This prevents
one answer from showing full hierarchy mastery and lets reconciliation repair
drift after content visibility changes.
