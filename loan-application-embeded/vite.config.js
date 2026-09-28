import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Keep a stable origin so backend CORS_ORIGINS can allowlist it.
    port: 5177,
    strictPort: true,
  },
});
