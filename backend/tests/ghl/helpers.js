/**
 * Shared helpers for GHL payment / checkout tests.
 */

const PRICE_ENV_KEYS = [
  "GHL_BASIC_MONTHLY_PRICE_ID",
  "GHL_BASIC_YEARLY_PRICE_ID",
  "GHL_PRO_MONTHLY_PRICE_ID",
  "GHL_PRO_YEARLY_PRICE_ID",
  "GHL_ELITE_MONTHLY_PRICE_ID",
  "GHL_ELITE_YEARLY_PRICE_ID",
];

const DEFAULT_PRICE_ENV = {
  GHL_ENABLED: "true",
  GHL_API_KEY: "test-ghl-api-key",
  GHL_LOCATION_ID: "loc_test_123",
  GHL_PRODUCT_ID: "prod_test_123",
  GHL_BASIC_MONTHLY_PRICE_ID: "price_basic_monthly",
  GHL_BASIC_YEARLY_PRICE_ID: "price_basic_yearly",
  GHL_PRO_MONTHLY_PRICE_ID: "price_pro_monthly",
  GHL_PRO_YEARLY_PRICE_ID: "price_pro_yearly",
  GHL_ELITE_MONTHLY_PRICE_ID: "price_elite_monthly",
  GHL_ELITE_YEARLY_PRICE_ID: "price_elite_yearly",
};

function snapshotEnv(keys) {
  const snap = {};
  for (const key of keys) {
    snap[key] = process.env[key];
  }
  return snap;
}

function restoreEnv(snap) {
  for (const [key, value] of Object.entries(snap)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function applyPaymentEnv(overrides = {}) {
  const keys = [
    ...Object.keys(DEFAULT_PRICE_ENV),
    ...PRICE_ENV_KEYS,
    ...Object.keys(overrides),
  ];
  const unique = [...new Set(keys)];
  const snap = snapshotEnv(unique);
  for (const [key, value] of Object.entries({
    ...DEFAULT_PRICE_ENV,
    ...overrides,
  })) {
    if (value === null || value === undefined) delete process.env[key];
    else process.env[key] = String(value);
  }
  return () => restoreEnv(snap);
}

function clearModule(pathFromBackend) {
  const resolved = require.resolve(pathFromBackend);
  delete require.cache[resolved];
}

function reload(pathFromBackend) {
  clearModule(pathFromBackend);
  return require(pathFromBackend);
}

/**
 * Find an open reusable checkout — mirrors checkout route anti-duplicate logic.
 */
function findReusableOpenCheckout(checkouts, { loanAiUserId, packageId, billingCycle, windowMs = 15 * 60 * 1000 }) {
  const cutoff = Date.now() - windowMs;
  return (
    checkouts
      .filter(
        (c) =>
          c.loanAiUserId === loanAiUserId &&
          c.packageId === packageId &&
          c.billingCycle === billingCycle &&
          c.status === "CHECKOUT_CREATED" &&
          c.paymentStatus === "PENDING" &&
          c.checkoutUrl &&
          (!c.expiresAt || new Date(c.expiresAt).getTime() > Date.now()) &&
          new Date(c.createdAt).getTime() >= cutoff,
      )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null
  );
}

module.exports = {
  PRICE_ENV_KEYS,
  DEFAULT_PRICE_ENV,
  applyPaymentEnv,
  clearModule,
  reload,
  findReusableOpenCheckout,
};
