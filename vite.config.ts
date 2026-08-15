import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

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
