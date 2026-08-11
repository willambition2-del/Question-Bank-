# Question duplicate policy

Detection order: source external id, exact normalized text fingerprint scoped by subject/type, question+options fingerprint, existing destination fingerprint, then optional fuzzy similarity/image checksum/passage relation for review. Default is SKIP_EXISTING. CREATE_NEW_VERSION, UPDATE_MISSING_FIELDS_ONLY and MERGE_REVIEW_REQUIRED require explicit administrative selection. Any material discrepancy becomes REVIEW_CONFLICT; no published record is silently changed.
