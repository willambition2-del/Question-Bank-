# OCR pipeline

PDF text is extracted page-by-page. Pages below
`OCR_MIN_CHARACTERS_PER_PAGE` transition through `OCR_REQUIRED` and
`OCR_PROCESSING`, are rendered with PDF.js and `@napi-rs/canvas`, and are read
with Tesseract.js. Only those pages are OCRed, then merged with native text
before chunking and embeddings.

Controls include maximum document pages, render scale capped at 4, worker
concurrency, language selection, and no temporary page files. Tesseract
language data must be pre-warmed or mounted in production; the production
volume persists its cache.

A local real-image verification recognized `QUESTION BANK 2026` with reported
confidence 96. This proves the installed English OCR path, not Arabic language
availability. Add the Arabic trained data before enabling `ara`.
