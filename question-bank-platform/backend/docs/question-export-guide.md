# Question export guide

Administrative exports support XLSX, CSV and JSON with subject/unit/lesson/status/source/year/import-job/selection filters. Full answer/explanation exports require SUPER_ADMIN and create `QuestionExportAudit`. CSV/XLSX cells beginning with `=`, `+`, `-` or `@` must be escaped to prevent formula injection. Public/student export endpoints must not reuse administrative serializers.
