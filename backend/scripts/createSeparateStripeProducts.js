/**
 * Create separate Stripe Products (with matching recurring Prices) so Checkout
 * shows distinct names instead of one mega-product.
 *
 * Usage (from backend/):
 *   node scripts/createSeparateStripeProducts.js           # dry-run
 *   node scripts/createSeparateStripeProducts.js --apply   # create + write .env
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const Stripe = require("stripe");

const APPLY = process.argv.includes("--apply");
const ENV_PATH = path.join(__dirname, "..", ".env");
const OUT_PATH = path.join(__dirname, "stripe-separate-products.generated.json");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/** One Stripe Product → list of env price keys to clone onto it. */
const PRODUCT_SPECS = [
  {
    name: "Loan AI - Starter",
    description: "Loan Automation Starter plan for brokers.",
    prices: ["STRIPE_BASIC_MONTHLY_PRICE_ID", "STRIPE_BASIC_YEARLY_PRICE_ID"],
  },
  {
    name: "Loan AI - Pro",
    description: "Loan Automation Pro plan for brokers.",
    prices: ["STRIPE_PRO_MONTHLY_PRICE_ID", "STRIPE_PRO_YEARLY_PRICE_ID"],
  },
  {
    name: "Loan AI - Elite",
    description: "Loan Automation Elite plan for brokers.",
    prices: ["STRIPE_ELITE_MONTHLY_PRICE_ID", "STRIPE_ELITE_YEARLY_PRICE_ID"],
  },
  {
    name: "Loan AI - CRE & Multifamily Pack",
    description: "Unlock CRE & Multifamily loan categories.",
    prices: [
      "STRIPE_ADDON_CRE_PACK_MONTHLY_PRICE_ID",
      "STRIPE_ADDON_CRE_PACK_YEARLY_PRICE_ID",
    ],
  },
  {
    name: "Loan AI - Business Lending Pack",
    description: "Unlock SBA, USDA, and Asset-Based Lending products.",
    prices: [
      "STRIPE_ADDON_BUSINESS_LENDING_PACK_MONTHLY_PRICE_ID",
      "STRIPE_ADDON_BUSINESS_LENDING_PACK_YEARLY_PRICE_ID",
      "STRIPE_ADDON_BUSINESS_LENDING_PACK_PRO_MONTHLY_PRICE_ID",
      "STRIPE_ADDON_BUSINESS_LENDING_PACK_PRO_YEARLY_PRICE_ID",
    ],
  },
  {
    name: "Loan AI - Fee Agreement Pack",
    description: "Fee agreements, term sheets, and LOI tools.",
    prices: [
      "STRIPE_ADDON_FEE_AGREEMENT_PACK_MONTHLY_PRICE_ID",
      "STRIPE_ADDON_FEE_AGREEMENT_PACK_YEARLY_PRICE_ID",
    ],
  },
  {
    name: "Loan AI - Lender Marketplace Pack",
    description: "Lender marketplace and add-your-own lenders.",
    prices: [
      "STRIPE_ADDON_LENDER_MARKETPLACE_PACK_MONTHLY_PRICE_ID",
      "STRIPE_ADDON_LENDER_MARKETPLACE_PACK_YEARLY_PRICE_ID",
      "STRIPE_ADDON_LENDER_MARKETPLACE_PACK_PRO_MONTHLY_PRICE_ID",
      "STRIPE_ADDON_LENDER_MARKETPLACE_PACK_PRO_YEARLY_PRICE_ID",
    ],
  },
  {
    name: "Loan AI - GoHighLevel Starter",
    description: "GoHighLevel CRM starter suite add-on.",
    prices: [
      "STRIPE_ADDON_GHL_STARTER_MONTHLY_PRICE_ID",
      "STRIPE_ADDON_GHL_STARTER_YEARLY_PRICE_ID",
    ],
  },
  {
    name: "Loan AI - GoHighLevel Growth",
    description: "GoHighLevel Growth automation add-on.",
    prices: [
      "STRIPE_ADDON_GHL_BASIC_SYNC_MONTHLY_PRICE_ID",
      "STRIPE_ADDON_GHL_BASIC_SYNC_YEARLY_PRICE_ID",
      "STRIPE_ADDON_GHL_BASIC_SYNC_PRO_MONTHLY_PRICE_ID",
      "STRIPE_ADDON_GHL_BASIC_SYNC_PRO_YEARLY_PRICE_ID",
    ],
  },
  {
    name: "Loan AI - White-Label",
    description: "White-label branding for the broker portal.",
    prices: [
      "STRIPE_ADDON_WHITE_LABEL_MONTHLY_PRICE_ID",
      "STRIPE_ADDON_WHITE_LABEL_YEARLY_PRICE_ID",
      "STRIPE_ADDON_WHITE_LABEL_PRO_MONTHLY_PRICE_ID",
      "STRIPE_ADDON_WHITE_LABEL_PRO_YEARLY_PRICE_ID",
    ],
  },
  {
    name: "Loan AI - Extra User",
    description: "Additional loan officer / co-broker seats.",
    prices: [
      "STRIPE_ADDON_EXTRA_USER_MONTHLY_PRICE_ID",
      "STRIPE_ADDON_EXTRA_USER_YEARLY_PRICE_ID",
      "STRIPE_ADDON_EXTRA_USER_PRO_MONTHLY_PRICE_ID",
      "STRIPE_ADDON_EXTRA_USER_PRO_YEARLY_PRICE_ID",
      "STRIPE_ADDON_EXTRA_USER_ELITE_MONTHLY_PRICE_ID",
      "STRIPE_ADDON_EXTRA_USER_ELITE_YEARLY_PRICE_ID",
    ],
  },
  {
    name: "Loan AI - ABL Pack",
    description: "Legacy Asset-Based Lending category pack.",
    prices: [
      "STRIPE_ADDON_ABL_PACK_MONTHLY_PRICE_ID",
      "STRIPE_ADDON_ABL_PACK_YEARLY_PRICE_ID",
    ],
  },
  {
    name: "Loan AI - SBA Pack",
    description: "Legacy SBA & USDA category pack.",
    prices: [
      "STRIPE_ADDON_SBA_PACK_MONTHLY_PRICE_ID",
      "STRIPE_ADDON_SBA_PACK_YEARLY_PRICE_ID",
    ],
  },
];

function upsertEnvValue(envText, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(envText)) return envText.replace(re, line);
  return `${envText.replace(/\s*$/, "")}\n${line}\n`;
}

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY missing");
  }
  const mode = String(process.env.STRIPE_SECRET_KEY).startsWith("sk_live")
    ? "live"
    : "test";
  console.log(`Stripe mode: ${mode}`);
  console.log(APPLY ? "APPLY mode — will create products/prices and update .env" : "DRY RUN — pass --apply to write");

  const result = {
    createdAt: new Date().toISOString(),
    mode,
    products: [],
    envUpdates: {},
  };

  for (const spec of PRODUCT_SPECS) {
    console.log(`\n== ${spec.name} ==`);
    const priceSources = [];
    for (const envKey of spec.prices) {
      const oldId = process.env[envKey];
      if (!oldId) {
        console.warn(`  skip missing env ${envKey}`);
        continue;
      }
      const old = await stripe.prices.retrieve(oldId);
      if (!old.recurring) {
        console.warn(`  skip non-recurring ${envKey}`);
        continue;
      }
      priceSources.push({
        envKey,
        oldPriceId: oldId,
        unit_amount: old.unit_amount,
        currency: old.currency,
        interval: old.recurring.interval,
        interval_count: old.recurring.interval_count || 1,
        nickname: old.nickname || envKey,
        trial_period_days: old.recurring.trial_period_days || undefined,
      });
      console.log(
        `  clone ${envKey}: ${old.unit_amount / 100} ${old.currency}/${old.recurring.interval}`,
      );
    }
    if (!priceSources.length) continue;

    if (!APPLY) {
      result.products.push({ name: spec.name, dryRun: true, priceSources });
      continue;
    }

    const product = await stripe.products.create({
      name: spec.name,
      description: spec.description,
      metadata: {
        lendingCart: "true",
        source: "createSeparateStripeProducts",
      },
    });
    console.log(`  product ${product.id}`);

    const createdPrices = [];
    for (const src of priceSources) {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: src.unit_amount,
        currency: src.currency,
        nickname: src.nickname,
        recurring: {
          interval: src.interval,
          interval_count: src.interval_count,
          ...(src.trial_period_days
            ? { trial_period_days: src.trial_period_days }
            : {}),
        },
        metadata: {
          lendingCartEnvKey: src.envKey,
          replacedPriceId: src.oldPriceId,
        },
      });
      createdPrices.push({
        envKey: src.envKey,
        oldPriceId: src.oldPriceId,
        newPriceId: price.id,
        amount: src.unit_amount,
        interval: src.interval,
      });
      result.envUpdates[src.envKey] = price.id;
      console.log(`  price ${price.id} → ${src.envKey}`);
    }

    result.products.push({
      name: spec.name,
      productId: product.id,
      prices: createdPrices,
    });
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));
  console.log(`\nWrote ${OUT_PATH}`);

  if (APPLY && Object.keys(result.envUpdates).length) {
    let envText = fs.readFileSync(ENV_PATH, "utf8");
    // Keep previous IDs commented for rollback
    const stamp = new Date().toISOString().slice(0, 10);
    for (const [key, newId] of Object.entries(result.envUpdates)) {
      const oldId = process.env[key];
      if (oldId && oldId !== newId) {
        const comment = `# ${key} previous (${stamp}): ${oldId}`;
        if (!envText.includes(comment)) {
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
    fs.writeFileSync(ENV_PATH, envText);
    console.log(`Updated ${ENV_PATH} with ${Object.keys(result.envUpdates).length} Stripe price IDs`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
