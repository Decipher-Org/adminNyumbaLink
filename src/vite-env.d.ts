/// <reference types="vite/client" />

/**
 * Typed build-time configuration.
 *
 * Everything here ships to the browser in plain text — a `VITE_*` variable is
 * public by definition. API base URLs are fine; secrets (the Resend key, the
 * Better Auth secret, database URLs) belong to the backend's own `.env` and must
 * never appear in this file or any `VITE_*` value.
 */
interface ImportMetaEnv {
  /** Backend origin, no trailing slash. Defaults to http://localhost:8080. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
