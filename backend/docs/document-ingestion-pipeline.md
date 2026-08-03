# Document Ingestion Pipeline

Supported uploads:

- PDF (`%PDF-` signature)
- DOCX (ZIP signature plus Office MIME type)
- UTF-8 TXT
- Markdown

The platform validates size, extension, MIME and file signature before writing
the original file with a generated server-side name. Storage paths cannot escape
the configured root.

Processing is asynchronous:

1. Store original file.
2. Create document metadata.
3. Mark `QUEUED` and signal Redis.
4. A worker acquires a distributed document lock.
5. Extract text and page metadata.
6. Normalize and split into token-bounded overlapping chunks.
7. Replace chunks transactionally.
8. Mark the document `READY`.

Scanned PDFs with no extractable text fail with `DOCUMENT_OCR_REQUIRED`; OCR is
an optional external pipeline and is not silently simulated. In production, the
document processor is intended to run as a separate worker. Reprocessing is
idempotent because chunks are replaced transactionally under a distributed lock.

No document text, image, API credential, or authorization header is written to
application logs.
