# Image question analysis

`POST /api/v1/assistant/images/analyze-question` accepts an authenticated
student multipart request with `image`, optional curriculum identifiers,
`userQuestion`, and `analysisMode`.

The API validates the declared MIME type against JPEG/PNG/WebP magic bytes,
enforces byte/pixel/dimension limits, rejects animation, rotates safely,
strips metadata, normalizes to high-quality JPEG in memory, and computes a
checksum. Raw images are not cached or persisted.

Routing always uses `IMAGE_QUESTION_ANALYSIS`, so only vision-capable models
are eligible. Provider/model/routing/cost data never enters the public DTO.
The service attempts a scoped question-bank match. A direct solution is
rejected with `ACTIVE_QUIZ_SOLUTION_BLOCKED` when the matched question belongs
to an in-progress owned attempt; other modes redact the final answer as needed.

## Operations

- Configure a vision model, prompt, route, and usage policy in the admin UI.
- Keep image limits aligned between Nginx, Multer, policy, and environment.
- Treat image text as untrusted data; the server prompt explicitly ignores
  instructions embedded in an image.
- Monitor rejected images, latency, fallback, and quota logs by request ID.
