# Admin Backend Compatibility Matrix

| Feature | Frontend Route | Backend Endpoint | Status |
|---|---|---|---|
| User List | /users | GET /admin/users | MATCH |
| User Role | /users | PATCH /admin/users/:id/role | MATCH |
| Add Grade | /education | POST /admin/grades | MATCH |
| Questions List | /questions | GET /admin/questions | MATCH |
| Import Questions | /questions/import | POST /admin/question-imports/upload | MATCH |
| AI Providers | /providers | GET /admin/intelligent-services/providers | MATCH |
| Reading Passages | NONE | GET /admin/reading-passages | MISSING_UI |
| Exam Models | NONE | GET /admin/exam-models | MISSING_UI |
| Sources | NONE | GET /admin/sources | MISSING_UI |