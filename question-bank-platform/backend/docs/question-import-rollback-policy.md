# Question import rollback policy

Rollback is scoped by `QuestionSourceReference.importJobId`. It may remove only records created by that job that were not manually changed and are not referenced by student attempts or published exam content. Dependencies yield BLOCKED_BY_DEPENDENCIES; those questions are not deleted. Every rollback records actor, time, deleted count, blocked count and reasons. Updates/merges require before-images before rollback can be enabled.
