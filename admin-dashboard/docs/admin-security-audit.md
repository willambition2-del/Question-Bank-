# Security Audit
API keys do not leak to the frontend.
All interactions go through the Next.js proxy route to attach HttpOnly cookies.
No raw secrets in HTML.