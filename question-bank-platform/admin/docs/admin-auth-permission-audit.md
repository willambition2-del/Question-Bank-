# Admin Auth & Permission Audit
Authentication is handled via JWT and BFF proxy in `src/api/proxy`.
SUPER_ADMIN checks exist on backend endpoints.
Frontend sidebar restricts navigation but middleware must ensure unauthenticated users redirect to /login.