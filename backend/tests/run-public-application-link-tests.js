#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const files = [
  "tests/publicApplicationLink.test.js",
  "tests/referringBrokerStep.test.js",
].map((f) => path.join(__dirname, "..", f));

const result = spawnSync(process.execPath, ["--test", ...files], {
  stdio: "inherit",
  cwd: path.join(__dirname, ".."),
  env: process.env,
});

process.exit(result.status == null ? 1 : result.status);
