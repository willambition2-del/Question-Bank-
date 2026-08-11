# Multiplayer Challenges Hardening Audit

Date: 2026-07-19
Status: COMPLETE_FOR_SELECTED_PHASE

## Baseline and defects

The existing REST, Socket.IO, challenge participant, question and answer models were retained. The baseline had no invitation lifecycle or 2v2 team representation; ready transitions could race; question eligibility did not enforce the complete published hierarchy; reconnect did not restore rooms/state; server timing and timeout completion were incomplete; and challenge responses could expose correctness data before completion.

## Implemented hardening

- Added owner-controlled invitations with accept, reject and cancellation flows, active-student validation, persisted challenge notifications and explicit 2v2 team assignment/capacity rules.
- Added `TWO_VS_TWO` lobbies with exactly two ready participants per team. Public teamless joins and 2v2 matchmaking are rejected in favor of explicit team invitations.
- Serialized ready transitions through a Redis lock and a serializable PostgreSQL transaction. Question assignment uses `createMany(skipDuplicates)` and the WAITING-to-COUNTDOWN transition is compare-and-set.
- Challenge question selection now reuses the centralized complete hierarchy visibility policy and respects subject, unit, lesson and difficulty scope.
- Gameplay uses persisted server `startedAt`, rejects early, late, duplicate and out-of-turn answers, omits answer keys/correctness, and completes expired matches from server time.
- 2v2 finalization aggregates team scores, persists `winnerTeam`, assigns shared team ranks and awards a server-owned challenge win to every winning teammate.
- Socket.IO authentication remains JWT/database-backed. Reconnect restores active rooms and current state; sync and heartbeat events support recovery and timeout processing.
- Pre-start responses expose no questions, in-progress responses expose only the current question, and completed responses retain the safe question projection.

## Migration

Added `20260719020000_multiplayer_challenges_hardening`. It appends `TWO_VS_TWO`, adds nullable `ChallengeParticipant.team` and `Challenge.winnerTeam`, and creates the team/status lookup index. No prior migration was edited. The SQL was inspected before deploy and matches Prisma's generated schema diff.

## Verification

- Format, lint and build: pass.
- Unit: 23 suites / 119 tests, all pass, including JWT identity and concurrent in-memory lock behavior.
- PostgreSQL E2E: 12 suites / 60 tests, all pass; the focused challenge suite contributes 3 tests.
- The E2E suite proves invitation reject/cancel/notification behavior, concurrent 2v2 readiness, safe question/answer responses, duplicate-answer idempotency, server timeout completion, team winner/ranks, and one win ledger award per winning teammate.
- All 16 migrations are applied to the development and isolated test databases.

## Remaining honest limits

- Cross-instance Socket.IO room broadcasting requires the production Redis adapter completed in the infrastructure phase.
- Matchmaking remains intentionally 1v1/solo-mode only; team challenges require deterministic invitation lobbies.