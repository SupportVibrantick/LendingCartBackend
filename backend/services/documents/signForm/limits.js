function numberEnv(name, fallback) {
  const raw = process.env[name];
  const value = raw == null || raw === "" ? fallback : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getSignFormLimits() {
  return {
    maxPages: numberEnv("SIGN_FORM_MAX_PAGES", 20),
    maxFields: numberEnv("SIGN_FORM_MAX_FIELDS", 150),
    maxConditionals: numberEnv("SIGN_FORM_MAX_CONDITIONALS", 40),
    maxTables: numberEnv("SIGN_FORM_MAX_TABLES", 8),
    maxTableRows: numberEnv("SIGN_FORM_MAX_TABLE_ROWS", 20),
    maxUploadBytes: numberEnv(
      "UPLOAD_MAX_BYTES",
      numberEnv("SIGN_FORM_MAX_UPLOAD_BYTES", 25 * 1024 * 1024),
    ),
  };
}

function getUploadMaxBytes() {
  return getSignFormLimits().maxUploadBytes;
}

function assertSignFormLimits(schema) {
  const limits = getSignFormLimits();
  const pages = schema?.pages || [];
  const fields = schema?.fields || [];
  const conditionals = schema?.conditionals || [];
  const tables = schema?.tables || [];

  const fail = (message) => {
    const err = new Error(message);
    err.statusCode = 400;
    throw err;
  };

  if (pages.length > limits.maxPages) {
    fail(`Forms can have at most ${limits.maxPages} pages`);
  }
  if (fields.length > limits.maxFields) {
    fail(`Forms can have at most ${limits.maxFields} fields`);
  }
  if (conditionals.length > limits.maxConditionals) {
    fail(`Forms can have at most ${limits.maxConditionals} conditionals`);
  }
  if (tables.length > limits.maxTables) {
    fail(`Forms can have at most ${limits.maxTables} tables`);
  }
  for (const table of tables) {
    if ((table.rows || 0) > limits.maxTableRows) {
      fail(`Tables can have at most ${limits.maxTableRows} rows`);
    }
  }
}

module.exports = {
  getSignFormLimits,
  getUploadMaxBytes,
  assertSignFormLimits,
};
