// Strip UTF-8 BOM from prisma/migrations/<name>/migration.sql
// Safe to run on every deploy.
const fs = require("fs");
const path = require("path");

const migrationsDir = path.join(__dirname, "..", "..", "prisma", "migrations");

if (!fs.existsSync(migrationsDir)) {
  console.log("No prisma/migrations directory; skipping BOM cleanup");
  process.exit(0);
}

let stripped = 0;
for (const dir of fs.readdirSync(migrationsDir)) {
  const file = path.join(migrationsDir, dir, "migration.sql");
  if (!fs.existsSync(file)) continue;
  const buf = fs.readFileSync(file);
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    fs.writeFileSync(file, buf.subarray(3));
    stripped += 1;
    console.log(`stripped BOM: ${path.join(dir, "migration.sql")}`);
  }
}

console.log(`BOM cleanup done (${stripped} file(s) fixed)`);
