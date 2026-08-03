# Dependency security audit

Date: 2026-08-02
Node.js policy: 22.17.1

## Backend

- Command: `npm audit --json`
- Result: 0 critical, 0 high, 0 moderate, 0 low.
- Dependency totals reported by npm: 1,242 (536 production).
- No `npm audit fix --force` was used and no breaking dependency change was applied.

## Admin dashboard

- Command: `npm audit --json`
- Result: 0 critical, 0 high, 0 moderate, 0 low.
- Dependency totals reported by npm: 618 (63 production).
- No `npm audit fix --force` was used and no breaking dependency change was applied.

## Classification and decision

There are no current npm advisories to classify or remediate. The lockfiles were refreshed only to record the exact Node engine policy; no direct package version was deliberately upgraded. CI should continue to fail on critical/high production advisories and archive the JSON report for review.
