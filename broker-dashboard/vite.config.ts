import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

const require = createRequire(import.meta.url);

/**
 * Copy pdf.js worker into /public as a stable .js URL.
 * Vite's hashed /assets/*.mjs worker often 404/500 in production (nginx MIME / SPA fallback).
 */
function copyPdfWorker(): Plugin {
  const copy = () => {
    const source = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
    const target = path.resolve(__dirname, "public/pdf.worker.min.js");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  };

  return {
    name: "copy-pdf-worker",
    buildStart: copy,
    configureServer: copy,
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    copyPdfWorker(),
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
});
