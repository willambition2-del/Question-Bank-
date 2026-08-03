# Provider credentials security

Credentials are accepted only by `SUPER_ADMIN` endpoints and are encrypted with
AES-256-GCM before persistence. The master key is supplied at runtime and is
never stored in the database or repository.

Read APIs expose only whether a credential exists and an optional masked last
four value. They never return plaintext, ciphertext, authentication headers or
provider response bodies. Credential create, rotate, remove and test actions
write a dedicated audit record without storing the secret.

Production startup fails closed when intelligent services are enabled without a
valid master key. Decryption happens inside the gateway immediately before a
request. Logs and request records contain identifiers, status, timing, token
counts and cost only.

Rotation procedure:

1. Put the new credential through the protected admin endpoint.
2. Run the protected connection test.
3. Confirm the credential audit and health result.
4. Revoke the previous credential externally.
5. Rotate the master key only through a controlled re-encryption maintenance
   procedure; changing it directly makes existing ciphertext unreadable.

