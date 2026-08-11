# Question Bank Hardening Audit

Audit date: 2026-07-18 (Asia/Riyadh)
Branch: question-bank-hardening
Starting commit: b0a7f9d0a48e9f23f121498e659f1d55439b1717
Selected phase: Question Bank + Review Workflow Hardening
Status: COMPLETE_FOR_SELECTED_PHASE

## Scope and existing implementation

The audit covered Source, ReadingPassage, Question, QuestionOption and
QuestionReview models, all migrations, Content code/tests, relevant Auth/Common/
Education behavior, the guarded E2E runner, Swagger, fixtures and documentation.

The start already had the five models, existing controllers/enums/ContentModule,
CRUD, separate student/admin mappers, basic MCQ/TRUE_FALSE checks, review routes,
fingerprints, soft deletion, bulk actions, unit tests and mock E2E. All were
reused rather than duplicated.

## Defects found

| Area | Starting defect | Risk |
|---|---|---|
| Hierarchy | Reads/publication skipped ancestors | Hidden-parent leakage |
| Passage | Publication skipped Subject/Source ancestry | Orphan visibility |
| Duplicates | Fingerprints were never checked | Exact duplicates |
| MCQ | Normalized duplicate option text accepted | Ambiguous answers |
| Review | No central transition matrix | Invalid state changes |
| Roles | REVIEWER could not approve/reject | Broken responsibility split |
| Metadata | Submission/archive overwrote reviewer | Misleading history |
| Publication | READY/active alone was sufficient | Invalid publication |
| Similar | Only Passage state filtered | Hidden ancestors could leak |
| Bulk | Writes/history were separate | Partial results |
| Assignment | Subject mismatch possible | Corrupt hierarchy |
| Queries | Source reused question filters | False API contract |
| Passage writes | Ordinary writes accepted publish state | Publish bypass |
| Errors | Generic/inconsistent codes | Unsafe contract |
| Fixture | Arabic mojibake in one unit fixture | Corrupt test data |
| Integration | No real Question Bank PostgreSQL suite | Workflow unproven |

## Implemented policies

QuestionHierarchyValidator requires a non-deleted Subject; Unit ownership;
Lesson ownership by Unit and Subject; lessonId with unitId; non-deleted Source;
and Passage ownership by Subject. Publication/student visibility additionally
requires active/published/non-deleted Subject, Unit, Lesson and Passage;
active/non-deleted Grade, Curriculum and Source; and visible Passage Source.

MULTIPLE_CHOICE requires two or more non-empty options, unique sort orders,
unique normalized text, exactly one correct option and null correctBoolean.
TRUE_FALSE requires a boolean correctBoolean and no options. Creation,
replacement and type conversion use callback transactions.

normalizeQuestionText applies NFKC, trim, whitespace/newline folding,
Arabic-safe tatweel removal, punctuation folding and locale-aware lowercase.
SHA-256 uses normalized text, Subject ID and type. Create/update reject an
active non-deleted exact match with QUESTION_DUPLICATE; update excludes itself.
Deleted questions are deliberately excluded.

The central review matrix is:

| Current | Allowed next states |
|---|---|
| DRAFT | REVIEW_REQUIRED |
| REVIEW_REQUIRED | READY, REJECTED |
| REJECTED | DRAFT, REVIEW_REQUIRED |
| READY | ARCHIVED |
| ARCHIVED | DRAFT, REVIEW_REQUIRED |

Edits reset to DRAFT, increment contentVersion, clear review metadata and
unpublish. Every transition updates Question and inserts QuestionReview in one
transaction. Approve/reject set reviewer/time; reject records a reason;
resubmit/approve clear it. No transition publishes.

ADMIN/SUPER_ADMIN create, edit, delete, publish and administer bulk actions.
REVIEWER/ADMIN/SUPER_ADMIN read review queues and approve/reject. REVIEWER
cannot publish/delete/create sources/bulk publish. Self-approval is forbidden
for every role with QUESTION_SELF_APPROVAL_FORBIDDEN.

Publication requires READY, active, non-deleted, valid answer shape and visible
hierarchy. Unpublish is idempotent. Deactivate/delete unpublish. Restore
validates relationships and remains unpublished. Passage create/update cannot
publish implicitly; explicit publish validates ancestry. Source restore remains
inactive.

Student question/similar responses return only READY, active, published,
non-deleted visible content. They omit correctBoolean, option isCorrect/
whyWrong, explanations, common mistakes, fingerprint, rejection data,
creator/reviewer IDs and deletion state. Similar excludes itself, is
deterministic and is capped at 10.

Sources and Passages use dedicated filter DTOs. Question filters implement all
documented fields and seven sorts. Bulk accepts 1-100 UUIDs, deduplicates IDs,
validates the whole batch, enforces Subject ownership, and commits writes/
history in one transaction. It is all-or-nothing and returns
processed/succeeded/failed/errors.

Known Prisma P2002, P2003 and P2025 errors map to controlled responses without
raw SQL, constraint names, Prisma metadata or stack traces.

## Migration decision

All fields, relations and indexes already exist. Prisma validation passes, 12
migrations are applied and migrate diff reports no difference. No migration was
created. The applied questions_and_passages migration was not edited.

## Test gaps closed and evidence

A central policy unit suite and real
test/question-bank-postgres.e2e-spec.ts were added without service/Prisma
overrides. Real users log in through Auth HTTP. The scenario covers hierarchy,
Source, unpublished Passage, MCQ/TF, review/approve/reject/resubmit,
self-approval, publication, duplicates, safe question/similar responses, valid
bulk, invalid rollback, parent hiding, soft delete/restore, 401/403, invalid
UUID, Health, Swagger and cleanup.

Results: 22 unit suites / 91 tests and 6 E2E suites / 36 tests pass. Zero are
skipped; no snapshots or open-handle warnings. Expected Node experimental VM
Modules warning remains.

## Acceptance

Existing models/controllers/enums were reused. Type, hierarchy, review,
separation-of-duties, publication, student safety, duplicate, Source, Passage
and transactional bulk rules pass. PostgreSQL E2E, Prisma validation/status/
diff, format, lint, build, Health and Swagger pass.

The phase is COMPLETE_FOR_SELECTED_PHASE. Exam Models Hardening is next and was
not implemented.
