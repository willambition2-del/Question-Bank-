# Question import admin guide

Only SUPER_ADMIN may upload/import/rollback/full-export. First download the official template, upload CSV/XLSX, review detected columns and explicit field mapping, run dry-run, then inspect invalid, duplicate and review tabs. A completed dry-run is not permission to import. Resolve curriculum mappings and validation errors, then explicitly confirm. Never publish imported content automatically; imported questions begin as REVIEW_REQUIRED.

The development source command is `npm run questions:dry-run -- --source <sqlite-path>` after building. Production must use managed storage. The job detail/report endpoints expose aggregate and paginated staging data; public APIs never expose source payloads or correct answers.
