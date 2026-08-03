# Provider onboarding

1. Sign in to the admin BFF as `SUPER_ADMIN`.
2. Create a provider with an allowlisted HTTPS base URL and enter its key only
   in the protected form. Confirm the returned view masks the secret.
3. Test the provider, then create models with accurate capabilities and cost
   metadata. Do not mark vision, embeddings, JSON or streaming support unless
   a real test passes.
4. Create/activate prompt versions, usage policy, and routing candidates.
5. Test the task route and failure fallback before enabling student traffic.
6. For embeddings, keep configured vector dimensions equal to the model output
   and database index. Reprocess documents after a model/version change.

Keys are encrypted at rest with the runtime master key and decrypted only in
memory for an outbound request. Never paste a key into CLI history, logs,
documentation, Git, or Flutter configuration.
