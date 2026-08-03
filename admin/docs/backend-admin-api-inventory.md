# Backend Admin API Inventory

- `GET /admin/users` - UsersController - Used by /users
- `PATCH /admin/users/:id/role` - UsersController - Used by /users
- `PATCH /admin/users/:id/status` - UsersController - Used by /users
- `GET /admin/questions` - QuestionsController - Used by /questions
- `POST /admin/questions` - QuestionsController - Used by /questions/new
- `PATCH /admin/questions/:id` - QuestionsController - Used by /questions (quick edit)
- `POST /admin/question-imports/upload` - QuestionImportsController - Used by /questions/import
- `POST /admin/question-imports/:id/validate` - QuestionImportsController - Used by /questions/import
- `POST /admin/question-imports/:id/confirm` - QuestionImportsController - Used by /questions/import
- `GET /admin/question-imports` - QuestionImportsController - Used by /questions/import
- `POST /admin/grades` - EducationAdminController - Used by /education
- `GET /admin/grades` - EducationAdminController - Used by /education
- `DELETE /admin/grades/:id` - EducationAdminController - Used by /education
- `GET /admin/intelligent-services/providers` - ISController - Used by /providers
- `GET /admin/exam-models` - MISSING UI
- `GET /admin/reading-passages` - MISSING UI
- `GET /admin/sources` - MISSING UI
- `GET /admin/updates` - MISSING UI