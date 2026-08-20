#!/usr/bin/env node
/**
 * Runs all GHL payment scenario tests (Node built-in test runner).
 * Explicit file list keeps Windows npm scripts reliable.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const files = [
  "tests/ghl/priceMap.test.js",
  "tests/ghl/checkoutErrors.test.js",
  "tests/ghl/webhookLifecycle.test.js",
  "tests/ghl/webhookExtractIds.test.js",
  "tests/ghl/checkoutContactsReuse.test.js",
  "tests/ghl/paymentsLiveMode.test.js",
  "tests/ghl/oauthEncryption.test.js",
  "tests/ghl/oauthState.test.js",
  "tests/ghl/oauthConnection.test.js",
  "tests/ghl/oauthCallback.test.js",
  "tests/ghl/brokerGhlClient.test.js",
  "tests/ghl/brokerGhlWebsites.test.js",
].map((f) => path.join(__dirname, "..", f));

const result = spawnSync(process.execPath, ["--test", ...files], {
  stdio: "inherit",
  cwd: path.join(__dirname, ".."),
  env: process.env,
});

process.exit(result.status == null ? 1 : result.status);
