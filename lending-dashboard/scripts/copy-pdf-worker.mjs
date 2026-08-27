import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const target = path.resolve(__dirname, "../public/pdf.worker.min.js");

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log(`Copied pdf.js worker → ${target}`);
