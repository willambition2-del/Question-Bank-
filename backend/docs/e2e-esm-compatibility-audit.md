# E2E ESM compatibility audit

## Environment

- Node.js: 22.17.1 locally; Node.js 24 in Docker and CI.
- Jest: 30.4.2.
- ts-jest: 29.4.11.
- file-type: 22.0.1 (direct dependency), with 21.3.4 also nested under NestJS.
- Project package type: CommonJS (no type: module); TypeScript uses NodeNext resolution.

## Root cause

QuestionImportsService statically imported file-type. Version 22 is ESM-only,
while Jest loads the Nest application through the CommonJS path emitted by ts-jest.
Jest therefore attempted to require the ESM entry point while importing
ContentModule, before any E2E test could start. Unit tests did not expose the
same failure because the service spec mocked file-type before loading it.

## Resolution

FileTypeDetector isolates the dependency and loads it with native dynamic
import() only when magic-byte detection is needed. QuestionImportsService
injects this detector. Production validation remains fail-closed: unknown data
is rejected by the caller, module-loading failures propagate, and no extension
fallback was introduced. Jest configuration and dependency versions are
unchanged.
