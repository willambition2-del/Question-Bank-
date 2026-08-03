# Backend Baseline

Date: 2026-07-17

## Runtime and dependencies

- NestJS Core: 11.1.28
- Prisma CLI and Client: 7.8.0
- PostgreSQL through `@prisma/adapter-pg`
- Throttler: 6.5.0
- Architecture: NestJS modular monolith

## Existing modules and behavior

- Global `ConfigModule` and `PrismaModule`.
- Global guards run in this order: throttling, JWT authentication, roles.
- Auth supports registration, login, refresh rotation, logout, current user, and password changes.
- Users supports reading and updating the authenticated profile.
- Health executes `SELECT 1` and is public and exempt from throttling.
- Swagger is exposed at `/api/docs` with the `access-token` bearer scheme.
- DTO validation uses whitelist, forbidden non-whitelisted properties, transformation, and implicit conversion.
- Prisma Client is generated to `src/generated/prisma` with the CommonJS module format.

## Database baseline

- `DATABASE_URL`: present; value was not printed.
- `SHADOW_DATABASE_URL`: present; value was not printed.
- `DATABASE_URL_TEST`: missing from the active `.env`; it is documented safely in `.env.example`.
- Existing migrations:
  1. `20260716101645_init_users`
  2. `20260716105419_auth_refresh_tokens`
- `npx prisma validate`: passed.
- `npx prisma migrate status`: passed; the development database is up to date.

## Quality gates before feature work

- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test`: passed, 5 suites and 22 tests.

## Baseline constraints and follow-up

- Existing Auth, Users, Health, and Swagger routes must remain compatible.
- Current CORS configuration uses `origin: true`; production-safe environment-based origins are required before deployment.
- ESLint currently disables `@typescript-eslint/no-explicit-any`; the existing handwritten source contains no explicit `any`, and the rule should be tightened during platform hardening.
- Real database E2E suites must not run until a separate `DATABASE_URL_TEST` is configured.
- Shadow database connectivity must be proven by the first new `prisma migrate dev`; no reset or `db push` is permitted.
