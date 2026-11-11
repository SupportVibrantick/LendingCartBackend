import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const publicDir = path.resolve(__dirname, "../public");

fs.mkdirSync(publicDir, { recursive: true });
for (const name of ["pdf.worker.min.mjs", "pdf.worker.min.js"]) {
  const target = path.join(publicDir, name);
  fs.copyFileSync(source, target);
  console.log(`Copied pdf.js worker → ${target}`);
}
