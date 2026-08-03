# Question import field mapping

Matching uses a search-only Arabic normalization (trim/collapse whitespace, Unicode NFKC, diacritics/tatweel removal, safe alef/ya variants). Original text is retained. Equations, quotations, Quran text, correct answers, and English words are never rewritten.

| Source | Type | Destination | Transform / validation | Required | Conflict/review policy |
|---|---|---|---|---|---|
| `subjects.name_ar` | text | `Question.subjectId` | explicit normalized lookup; aliases documented in audit | yes | unmatched = INVALID |
| `curriculum_units.unit_title` / `questions.unit` | text | `Question.unitId` | subject-scoped exact normalized mapping | no | unmatched = REQUIRES_REVIEW |
| `curriculum_lessons.lesson_title` | text | `Question.lessonId` | subject/unit-scoped mapping | policy-required | unmatched = REQUIRES_REVIEW; never guess |
| `source_sets.title` | text | `Source` / source reference | preserve source file and external row | no | create/map only after review |
| `source_sets.academic_year` | text | `Source.year` | parse only unambiguous four-digit year | no | ambiguous = review |
| `questions.external_id` | text | `QuestionSourceReference.externalId` | preserve verbatim | no | source checksum + row idempotency |
| `question_text` | text | `Question.questionText` | trim/collapse whitespace only | yes | blank = INVALID |
| `question_type` | text | `Question.type` | اختيار من متعدد→MULTIPLE_CHOICE; صح وخطأ→TRUE_FALSE | yes | unsupported = INVALID |
| `question_options` | rows | `QuestionOption[]` | stable source ordering | MCQ yes | <2/blank/duplicate text = INVALID |
| `isCorrect` | integer | `QuestionOption.isCorrect` | exactly one for MCQ | yes | zero/multiple = INVALID |
| `correct_answer` | text | `Question.correctBoolean` | صح/صواب/True→true; خطأ/False→false | T/F yes | ambiguous = INVALID |
| `hint_text` | text | `Question.hintText` | preserve | no | missing = quality warning |
| `explanation_short` or `explanation` | text | `Question.explanationShort` | explicit precedence | no | missing = quality warning |
| `explanation_detailed` | text | `Question.explanationDetailed` | preserve | no | missing = quality warning |
| `whyWrong` / `why_wrong` | text | `QuestionOption.whyWrong` | explicit precedence | no | missing = quality warning |
| `difficulty` | text | `Question.difficulty` | allowlisted mapping only | no | unknown→MEDIUM + review |
| `tags` | JSON/text | future tag relation | parse only valid source representation | no | malformed = warning |
| passage relation | integer | `Question.readingPassageId` | map only existing/imported passage | conditional | missing = review |
| image reference | text | `questionImageUrl` | magic/checksum and safe storage | conditional | missing file = INVALID |
| review flags | integer | `reviewStatus` | any source flag forces REVIEW_REQUIRED | yes | never auto-publish |
| source fingerprint | text | staging evidence | destination fingerprint is recomputed | no | default SKIP_EXISTING |

Default conflict policy is `SKIP_EXISTING`. Material answer/text/options/subject/lesson differences are `REVIEW_CONFLICT`; published questions are never overwritten automatically.
