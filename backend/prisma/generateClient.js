/**
 * Run prisma generate with a clear message when Windows locks the query engine
 * (usually because npm run dev is still running).
 */
const { execSync } = require("child_process");
const path = require("path");

const backendRoot = path.join(__dirname, "..");

function runGenerate() {
  execSync("npx prisma generate", {
    stdio: "inherit",
    cwd: backendRoot,
    env: process.env,
  });
}

try {
  console.log("🔧 Generating Prisma client...");
  runGenerate();
  console.log("✅ Prisma client generated");
} catch (error) {
  const output = `${error.message || ""}\n${error.stderr?.toString() || ""}`;
  const isLockError =
    output.includes("EPERM") ||
    output.includes("operation not permitted") ||
    output.includes("query_engine-windows.dll.node");

  if (isLockError) {
    console.error("\n❌ prisma generate failed — query engine file is locked.\n");
    console.error("   This usually means the backend dev server is still running.\n");
    console.error("   Fix:");
    console.error("   1. Stop npm run dev (Ctrl+C in that terminal)");
    console.error("   2. Run: npx prisma generate");
    console.error("   3. Start npm run dev again\n");
    console.error(
      "   Note: database migrate/patches already completed successfully.\n",
    );
    process.exit(1);
  }

  throw error;
}
