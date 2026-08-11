# Nginx and SSL

The production Nginx configuration redirects HTTP to HTTPS, terminates TLS,
adds HSTS and content-type/referrer headers, applies an API request limit,
supports WebSocket upgrade, disables proxy buffering for API responses, and
routes all other traffic to the admin dashboard.

Provision certificates with the host's ACME client and mount them read-only as
`fullchain.pem` and `privkey.pem`. Never store private keys in Git. Replace the
catch-all `server_name _` with the real hostname before launch. Re-run
`nginx -t` inside the container after every configuration change.
