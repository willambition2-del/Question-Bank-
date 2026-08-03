# Provider adapter contract

All external inference traffic enters through `IntelligentServicesGateway`.
Controllers and Flutter never instantiate or call an adapter.

## Required behavior

An adapter validates a decrypted, request-scoped configuration and implements
connection testing, model discovery, text generation, image analysis and
embeddings. It must normalize successful responses into text/structured output
and token counts, and normalize failures into a stable error kind plus a
`retryable` decision.

Adapters must:

- use the gateway request ID;
- enforce the configured timeout and cancellation signal;
- reject redirects and unsafe destinations through the shared URL policy;
- avoid logging credentials, request bodies, generated content or raw remote
  errors;
- estimate cost from stored pricing metadata only after normalized usage is
  available;
- return no vendor metadata to public controllers.

Adding an adapter requires registry registration, URL/auth validation tests,
success normalization tests, error classification tests, and a check that the
public response privacy assertion still passes.

