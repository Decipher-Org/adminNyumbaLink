import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Refuse to build a deploy that would come up pointing at localhost.
 *
 * `VITE_API_URL` is optional by design — `lib/api/client.ts` falls back to
 * `http://localhost:8080` so a fresh clone runs with no `.env.local` at all. On a
 * hosted build that default is a trap: the build succeeds, the bundle ships with
 * `localhost` inlined into it, and every request fails in a way that reads as a
 * backend outage rather than a missing environment variable.
 *
 * So the check is scoped to Vercel (`VERCEL=1`), where a localhost API can never be
 * what anyone meant. A plain `npm run build` on a laptop is left alone.
 *
 * `http://` is rejected rather than merely warned about: the console is served over
 * https there, and a browser blocks mixed-content XHR outright. Values starting with
 * `/` are allowed — that is a same-origin API proxied by a rewrite, which is a
 * deliberate setup rather than a mistake.
 */
function assertDeployableApiUrl() {
  if (!process.env.VERCEL) return;

  const url = process.env.VITE_API_URL;
  if (!url) {
    throw new Error(
      "VITE_API_URL is not set, so this build would ship pointing at http://localhost:8080. " +
        "Add it under Settings → Environment Variables for every environment you deploy " +
        "(Production, Preview, Development) and redeploy — Vite inlines it at build time, " +
        "so setting it later has no effect on an existing build.",
    );
  }
  if (url.startsWith("http://")) {
    throw new Error(
      `VITE_API_URL is "${url}". This console is served over https, and browsers block ` +
        "mixed-content requests, so every API call would fail silently. Use an https origin.",
    );
  }
}

assertDeployableApiUrl();

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  // The tenant/landlord client already owns 5173 in local development, and both
  // are usually running at once against the same backend. Pinning the admin app
  // to its own port keeps `VITE_API_URL`/CORS_ORIGIN predictable.
  server: {
    port: 5174,
  },
});
