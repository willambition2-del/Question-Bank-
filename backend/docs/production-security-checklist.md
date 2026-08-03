# Production Security Checklist

## Implemented and verified in code/tests

- [x] SUPER_ADMIN guards for intelligent-service administration.
- [x] Provider credentials encrypted server-side and absent from public DTOs.
- [x] No provider/model selection in Flutter public requests.
- [x] Quiz solution protection for text and image analysis.
- [x] Image MIME/magic, size, dimensions, pixels, animation and metadata controls.
- [x] Document path traversal controls and S3 bucket/key validation.
- [x] Provider URL SSRF/private-address restrictions in the existing gateway.
- [x] Production CORS rejects wildcard.
- [x] Production JWT/encryption/Redis requirements fail closed.
- [x] Vector enablement fails closed without extension/storage.
- [x] Admin authentication uses HttpOnly, Secure-in-production, SameSite=Strict cookies.
- [x] Admin BFF mutations validate same-origin and never expose backend tokens to browser code.
- [x] Public errors omit provider/model identity.
- [x] Logs avoid prompts, files, images and secrets in new flows.

## Required before release

- [ ] Complete dependency audits and triage without forced breaking upgrades.
- [ ] Run authorization/ownership and CSRF tests against deployed HTTPS origins.
- [ ] Run decompression/PDF bomb fixtures with memory/time limits.
- [ ] Verify DNS-rebinding protections in the real network environment.
- [ ] Verify Markdown rendering sanitization in all assistant views.
- [ ] Add and test authenticated SSE if streaming remains in scope.
- [ ] Verify Socket authentication after proxy deployment.
- [ ] Run secret scanning on final commits and images.
- [ ] Configure final Flutter package identity, release signing and non-HTTP API URL.
- [ ] Perform backup/restore and key-recovery drill.
- [ ] Run external penetration testing before public exposure.