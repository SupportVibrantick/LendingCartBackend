/**
 * Create separate GHL Products + Prices (mirrors Stripe split).
 * Usage:
 *   node scripts/createSeparateGhlProducts.js --apply
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const APPLY = process.argv.includes("--apply");
const ENV_PATH = path.join(__dirname, "..", ".env");
const OUT_PATH = path.join(__dirname, "ghl-separate-products.generated.json");

const client = axios.create({
  baseURL: process.env.GHL_API_BASE_URL || "https://services.leadconnectorhq.com",
  headers: {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    Version: process.env.GHL_API_VERSION || "2021-07-28",
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

const LOCATION_ID = process.env.GHL_LOCATION_ID;
const OLD_PRODUCT_ID = process.env.GHL_PRODUCT_ID;

const SPECS = [
  {
    name: "Loan AI - Starter",
    productEnv: "GHL_BASIC_PRODUCT_ID",
    description: "Loan Automation Starter plan for brokers.",
    prices: [
      { env: "GHL_BASIC_MONTHLY_PRICE_ID", label: "Monthly" },
      { env: "GHL_BASIC_YEARLY_PRICE_ID", label: "Yearly" },
    ],
  },
  {
    name: "Loan AI - Pro",
    productEnv: "GHL_PRO_PRODUCT_ID",
    description: "Loan Automation Pro plan for brokers.",
    prices: [
      { env: "GHL_PRO_MONTHLY_PRICE_ID", label: "Monthly" },
      { env: "GHL_PRO_YEARLY_PRICE_ID", label: "Yearly" },
    ],
  },
  {
    name: "Loan AI - Elite",
    productEnv: "GHL_ELITE_PRODUCT_ID",
    description: "Loan Automation Elite plan for brokers.",
    prices: [
      { env: "GHL_ELITE_MONTHLY_PRICE_ID", label: "Monthly" },
      { env: "GHL_ELITE_YEARLY_PRICE_ID", label: "Yearly" },
    ],
  },
  {
    name: "Loan AI - CRE & Multifamily Pack",
    productEnv: "GHL_ADDON_CRE_PACK_PRODUCT_ID",
    description: "Unlock CRE & Multifamily loan categories.",
    prices: [
      { env: "GHL_ADDON_CRE_PACK_MONTHLY_PRICE_ID", label: "Monthly" },
      { env: "GHL_ADDON_CRE_PACK_YEARLY_PRICE_ID", label: "Yearly" },
    ],
  },
  {
    name: "Loan AI - Business Lending Pack",
    productEnv: "GHL_ADDON_BUSINESS_LENDING_PACK_PRODUCT_ID",
    description: "Unlock SBA, USDA, and Asset-Based Lending.",
    prices: [
      { env: "GHL_ADDON_BUSINESS_LENDING_PACK_MONTHLY_PRICE_ID", label: "Starter Monthly" },
      { env: "GHL_ADDON_BUSINESS_LENDING_PACK_YEARLY_PRICE_ID", label: "Starter Yearly" },
      { env: "GHL_ADDON_BUSINESS_LENDING_PACK_PRO_MONTHLY_PRICE_ID", label: "Pro Monthly" },
      { env: "GHL_ADDON_BUSINESS_LENDING_PACK_PRO_YEARLY_PRICE_ID", label: "Pro Yearly" },
    ],
  },
  {
    name: "Loan AI - Fee Agreement Pack",
    productEnv: "GHL_ADDON_FEE_AGREEMENT_PACK_PRODUCT_ID",
    description: "Fee agreements, term sheets, and LOI tools.",
    prices: [
      { env: "GHL_ADDON_FEE_AGREEMENT_PACK_MONTHLY_PRICE_ID", label: "Monthly" },
      { env: "GHL_ADDON_FEE_AGREEMENT_PACK_YEARLY_PRICE_ID", label: "Yearly" },
    ],
  },
  {
    name: "Loan AI - Lender Marketplace Pack",
    productEnv: "GHL_ADDON_LENDER_MARKETPLACE_PACK_PRODUCT_ID",
    description: "Lender marketplace and add-your-own lenders.",
    prices: [
      { env: "GHL_ADDON_LENDER_MARKETPLACE_PACK_MONTHLY_PRICE_ID", label: "Starter Monthly" },
      { env: "GHL_ADDON_LENDER_MARKETPLACE_PACK_YEARLY_PRICE_ID", label: "Starter Yearly" },
      { env: "GHL_ADDON_LENDER_MARKETPLACE_PACK_PRO_MONTHLY_PRICE_ID", label: "Pro Monthly" },
      { env: "GHL_ADDON_LENDER_MARKETPLACE_PACK_PRO_YEARLY_PRICE_ID", label: "Pro Yearly" },
    ],
  },
  {
    name: "Loan AI - GoHighLevel Starter",
    productEnv: "GHL_ADDON_GHL_STARTER_PRODUCT_ID",
    description: "GoHighLevel CRM starter suite.",
    prices: [
      { env: "GHL_ADDON_GHL_STARTER_MONTHLY_PRICE_ID", label: "Monthly" },
      { env: "GHL_ADDON_GHL_STARTER_YEARLY_PRICE_ID", label: "Yearly" },
    ],
  },
  {
    name: "Loan AI - GoHighLevel Growth",
    productEnv: "GHL_ADDON_GHL_BASIC_SYNC_PRODUCT_ID",
    description: "GoHighLevel Growth automation suite.",
    prices: [
      { env: "GHL_ADDON_GHL_BASIC_SYNC_MONTHLY_PRICE_ID", label: "Starter Monthly" },
      { env: "GHL_ADDON_GHL_BASIC_SYNC_YEARLY_PRICE_ID", label: "Starter Yearly" },
      { env: "GHL_ADDON_GHL_BASIC_SYNC_PRO_MONTHLY_PRICE_ID", label: "Pro Monthly" },
      { env: "GHL_ADDON_GHL_BASIC_SYNC_PRO_YEARLY_PRICE_ID", label: "Pro Yearly" },
    ],
  },
  {
    name: "Loan AI - White-Label",
    productEnv: "GHL_ADDON_WHITE_LABEL_PRODUCT_ID",
    description: "White-label branding for the broker portal.",
    prices: [
      { env: "GHL_ADDON_WHITE_LABEL_MONTHLY_PRICE_ID", label: "Starter Monthly" },
      { env: "GHL_ADDON_WHITE_LABEL_YEARLY_PRICE_ID", label: "Starter Yearly" },
      { env: "GHL_ADDON_WHITE_LABEL_PRO_MONTHLY_PRICE_ID", label: "Pro Monthly" },
      { env: "GHL_ADDON_WHITE_LABEL_PRO_YEARLY_PRICE_ID", label: "Pro Yearly" },
    ],
  },
  {
    name: "Loan AI - Extra User",
    productEnv: "GHL_ADDON_EXTRA_USER_PRODUCT_ID",
    description: "Additional loan officer / co-broker seats.",
    prices: [
      { env: "GHL_ADDON_EXTRA_USER_MONTHLY_PRICE_ID", label: "Starter Monthly" },
      { env: "GHL_ADDON_EXTRA_USER_YEARLY_PRICE_ID", label: "Starter Yearly" },
      { env: "GHL_ADDON_EXTRA_USER_PRO_MONTHLY_PRICE_ID", label: "Pro Monthly" },
      { env: "GHL_ADDON_EXTRA_USER_PRO_YEARLY_PRICE_ID", label: "Pro Yearly" },
      { env: "GHL_ADDON_EXTRA_USER_ELITE_MONTHLY_PRICE_ID", label: "Elite Monthly" },
      { env: "GHL_ADDON_EXTRA_USER_ELITE_YEARLY_PRICE_ID", label: "Elite Yearly" },
    ],
  },
  {
    name: "Loan AI - ABL Pack",
    productEnv: "GHL_ADDON_ABL_PACK_PRODUCT_ID",
    description: "Legacy Asset-Based Lending pack.",
    prices: [
      { env: "GHL_ADDON_ABL_PACK_MONTHLY_PRICE_ID", label: "Monthly" },
      { env: "GHL_ADDON_ABL_PACK_YEARLY_PRICE_ID", label: "Yearly" },
    ],
  },
  {
    name: "Loan AI - SBA Pack",
    productEnv: "GHL_ADDON_SBA_PACK_PRODUCT_ID",
    description: "Legacy SBA & USDA pack.",
    prices: [
      { env: "GHL_ADDON_SBA_PACK_MONTHLY_PRICE_ID", label: "Monthly" },
      { env: "GHL_ADDON_SBA_PACK_YEARLY_PRICE_ID", label: "Yearly" },
    ],
  },
];

function upsertEnvValue(envText, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(envText)) return envText.replace(re, line);
  return `${envText.replace(/\s*$/, "")}\n${line}\n`;
}

async function fetchOldPrice(priceId) {
  const res = await client.get(`/products/${OLD_PRODUCT_ID}/price/${priceId}`, {
    params: { locationId: LOCATION_ID },
  });
  return res.data?.price || res.data;
}

async function main() {
  if (!process.env.GHL_API_KEY || !LOCATION_ID || !OLD_PRODUCT_ID) {
    throw new Error("GHL_API_KEY, GHL_LOCATION_ID, GHL_PRODUCT_ID required");
  }
  console.log(APPLY ? "APPLY mode" : "DRY RUN — pass --apply");

  const result = { createdAt: new Date().toISOString(), products: [], envUpdates: {} };

  for (const spec of SPECS) {
    console.log(`\n== ${spec.name} ==`);
    const sources = [];
    for (const p of spec.prices) {
      const oldId = process.env[p.env];
      if (!oldId) {
        console.warn(`  skip missing ${p.env}`);
        continue;
      }
      const old = await fetchOldPrice(oldId);
      sources.push({
        env: p.env,
        label: p.label,
        oldPriceId: oldId,
        amount: Number(old.amount),
        currency: old.currency || "USD",
        interval: old.recurring?.interval || "month",
        intervalCount: old.recurring?.intervalCount || 1,
        name: old.name || `${spec.name} ${p.label}`,
      });
      console.log(`  clone ${p.env}: ${old.amount} ${old.currency}/${old.recurring?.interval}`);
    }
    if (!sources.length) continue;

    if (!APPLY) {
      result.products.push({ name: spec.name, dryRun: true, sources });
      continue;
    }

    const created = await client.post("/products/", {
      name: spec.name,
      locationId: LOCATION_ID,
      description: spec.description,
      productType: "DIGITAL",
      availableInStore: true,
    });
    const productId =
      created.data?._id || created.data?.product?._id || created.data?.id;
    console.log(`  product ${productId}`);
    result.envUpdates[spec.productEnv] = productId;

    const createdPrices = [];
    for (const src of sources) {
      const priceRes = await client.post(`/products/${productId}/price`, {
        name: src.name,
        type: "recurring",
        currency: src.currency,
        amount: src.amount,
        recurring: {
          interval: src.interval,
          intervalCount: src.intervalCount,
        },
        locationId: LOCATION_ID,
      });
      const price =
        priceRes.data?.price || priceRes.data?.data || priceRes.data;
      const priceId = price?._id || price?.id;
      createdPrices.push({ env: src.env, oldPriceId: src.oldPriceId, newPriceId: priceId });
      result.envUpdates[src.env] = priceId;
      console.log(`  price ${priceId} → ${src.env}`);
    }

    result.products.push({
      name: spec.name,
      productId,
      productEnv: spec.productEnv,
      prices: createdPrices,
    });
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));
  console.log(`\nWrote ${OUT_PATH}`);

  if (APPLY && Object.keys(result.envUpdates).length) {
    let envText = fs.readFileSync(ENV_PATH, "utf8");
    const stamp = new Date().toISOString().slice(0, 10);
    for (const [key, newId] of Object.entries(result.envUpdates)) {
      const oldId = process.env[key];
      if (oldId && oldId !== newId && key.includes("PRICE_ID")) {
        const comment = `# ${key} previous (${stamp}): ${oldId}`;
        if (!envText.includes(comment) && new RegExp(`^${key}=`, "m").test(envText)) {
          envText = envText.replace(
            new RegExp(`^${key}=.*$`, "m"),
            `${comment}\n${key}=${newId}`,
          );
        } else {
          envText = upsertEnvValue(envText, key, newId);
        }
      } else {
        envText = upsertEnvValue(envText, key, newId);
      }
    }
    // Keep legacy GHL_PRODUCT_ID pointing at Starter for backward compat
    if (result.envUpdates.GHL_BASIC_PRODUCT_ID) {
      envText = upsertEnvValue(
        envText,
        "GHL_PRODUCT_ID",
        result.envUpdates.GHL_BASIC_PRODUCT_ID,
      );
    }
    fs.writeFileSync(ENV_PATH, envText);
    console.log(`Updated ${ENV_PATH}`);
  }
}

main().catch((err) => {
  console.error(err.response?.data || err);
  process.exit(1);
});
