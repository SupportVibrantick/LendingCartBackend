const path = require("path");
const fs = require("fs");

function readDotEnvValue(name) {
  try {
    const text = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
    const line = text
      .split(/\r?\n/)
      .find((row) => row.startsWith(`${name}=`));
    if (!line) return "";
    return line
      .slice(name.length + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  } catch {
    return "";
  }
}

// 2 API processes by default (chat uses Redis, so events reach every process).
// Override on a small VPS with WEB_CONCURRENCY=1, or raise up to 4.
const requested = Number(
  process.env.WEB_CONCURRENCY || readDotEnvValue("WEB_CONCURRENCY"),
);
const apiInstances =
  Number.isFinite(requested) && requested >= 1
    ? Math.min(4, Math.floor(requested))
    : 2;

module.exports = {
  apps: [
    {
      name: "lendingcart-backend",
      script: path.join(__dirname, "bin/www"),
      exec_mode: "cluster",
      instances: apiInstances,
      cwd: __dirname,
      autorestart: true,
      max_memory_restart: "1024M",
      env: {
        NODE_ENV: "production",
        ENABLE_CRONS: "false",
      },
    },
    {
      name: "lendingcart-worker",
      script: path.join(__dirname, "bin/worker.js"),
      exec_mode: "fork",
      instances: 1,
      cwd: __dirname,
      autorestart: true,
      max_memory_restart: "1024M",
      env: {
        NODE_ENV: "production",
        ENABLE_CRONS: "true",
      },
    },
  ],
};
