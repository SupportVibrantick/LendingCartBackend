/**
 * Archive Stripe products (and their unused prices) that are NOT referenced by
 * any STRIPE_*_PRICE_ID in backend/.env.
 *
 * Stripe "delete" for catalog items is archive: active=false.
 * Products with active/trialing/past_due subscriptions are skipped.
 *
 * Usage (from backend/):
 *   node scripts/archiveUnusedStripeProducts.js              # dry-run
 *   node scripts/archiveUnusedStripeProducts.js --apply      # archive
 *   node scripts/archiveUnusedStripeProducts.js --apply --include-inactive
 */
require("dotenv").config();
const Stripe = require("stripe");

const APPLY = process.argv.includes("--apply");
const INCLUDE_INACTIVE = process.argv.includes("--include-inactive");

function collectKeepPriceIds(env) {
  const keep = new Set();
  for (const [key, value] of Object.entries(env)) {
    if (!/^STRIPE_.+_PRICE_ID$/.test(key)) continue;
    const id = String(value || "").trim();
    if (id.startsWith("price_")) keep.add(id);
  }
  return keep;
}

async function listAll(stripe, listFn) {
  const out = [];
  for await (const item of listFn) {
    out.push(item);
  }
  return out;
}

async function loadBlockedProductIds(stripe) {
  const blocked = new Map(); // productId -> { subscriptionId, status, priceId }
  for (const status of ["active", "trialing", "past_due", "unpaid", "paused"]) {
    for await (const sub of stripe.subscriptions.list({
      status,
      limit: 100,
      expand: ["data.items.data.price"],
    })) {
      for (const item of sub.items?.data || []) {
        const priceId =
          typeof item.price === "string" ? item.price : item.price?.id;
        let productId =
          typeof item.price?.product === "string"
            ? item.price.product
            : item.price?.product?.id;
        if (!productId && priceId) {
          try {
            const price = await stripe.prices.retrieve(priceId);
            productId =
              typeof price.product === "string"
                ? price.product
                : price.product?.id;
          } catch {
            /* ignore */
          }
        }
        if (productId && !blocked.has(productId)) {
          blocked.set(productId, {
            subscriptionId: sub.id,
            status: sub.status,
            priceId,
          });
        }
      }
    }
  }
  return blocked;
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");

  const mode = String(key).startsWith("sk_live") ? "live" : "test";
  const stripe = new Stripe(key);
  const keepPriceIds = collectKeepPriceIds(process.env);

  console.log(`Stripe mode: ${mode}`);
  console.log(
    APPLY
      ? "APPLY — will archive unused products/prices"
      : "DRY RUN — pass --apply to archive",
  );
  console.log(`Keep price IDs from .env: ${keepPriceIds.size}`);

  if (!keepPriceIds.size) {
    throw new Error(
      "No STRIPE_*_PRICE_ID values found in .env — refusing to archive anything",
    );
  }

  // Resolve keep product IDs from keep prices
  const keepProductIds = new Set();
  const keepPriceMeta = [];
  for (const priceId of keepPriceIds) {
    try {
      const price = await stripe.prices.retrieve(priceId);
      keepProductIds.add(
        typeof price.product === "string" ? price.product : price.product?.id,
      );
      keepPriceMeta.push({
        priceId,
        productId:
          typeof price.product === "string" ? price.product : price.product?.id,
        active: price.active,
      });
    } catch (err) {
      console.warn(`  keep price missing in Stripe: ${priceId} (${err.message})`);
    }
  }
  console.log(`Keep product IDs (from those prices): ${keepProductIds.size}`);

  console.log("Scanning subscriptions for blocked products...");
  const blockedProducts = await loadBlockedProductIds(stripe);
  console.log(`Products with live subscriptions: ${blockedProducts.size}`);

  const products = await listAll(
    stripe,
    stripe.products.list({
      limit: 100,
      active: INCLUDE_INACTIVE ? undefined : true,
    }),
  );

  const report = {
    mode,
    applied: APPLY,
    keepPriceCount: keepPriceIds.size,
    keepProductIds: [...keepProductIds],
    kept: [],
    archiveCandidates: [],
    skippedBlocked: [],
    archived: [],
    errors: [],
  };

  for (const product of products) {
    const prices = await listAll(
      stripe,
      stripe.prices.list({ product: product.id, limit: 100 }),
    );
    const priceIds = prices.map((p) => p.id);
    const referenced = priceIds.some((id) => keepPriceIds.has(id));
    const keepByProduct = keepProductIds.has(product.id);

    const row = {
      productId: product.id,
      name: product.name,
      active: product.active,
      priceCount: prices.length,
      priceIds,
    };

    if (referenced || keepByProduct) {
      report.kept.push(row);
      continue;
    }

    const block = blockedProducts.get(product.id);
    if (block) {
      report.skippedBlocked.push({ ...row, ...block });
      console.log(
        `SKIP (active sub): ${product.name} [${product.id}] via ${block.priceId} (${block.status})`,
      );
      continue;
    }

    report.archiveCandidates.push(row);
    console.log(
      `ARCHIVE candidate: ${product.name} [${product.id}] prices=${priceIds.length}`,
    );

    if (!APPLY) continue;

    try {
      for (const price of prices) {
        if (price.active) {
          await stripe.prices.update(price.id, { active: false });
        }
      }
      if (product.active) {
        await stripe.products.update(product.id, { active: false });
      }
      report.archived.push(row);
      console.log(`  archived ${product.id}`);
    } catch (err) {
      report.errors.push({
        productId: product.id,
        name: product.name,
        error: err.message,
      });
      console.error(`  FAILED ${product.id}: ${err.message}`);
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Kept: ${report.kept.length}`);
  console.log(`Archive candidates: ${report.archiveCandidates.length}`);
  console.log(`Skipped (subs): ${report.skippedBlocked.length}`);
  console.log(`Archived: ${report.archived.length}`);
  console.log(`Errors: ${report.errors.length}`);

  // Soft verification: every keep price still retrieves
  let keepOk = 0;
  for (const priceId of keepPriceIds) {
    try {
      await stripe.prices.retrieve(priceId);
      keepOk += 1;
    } catch {
      console.warn(`KEEP PRICE BROKEN: ${priceId}`);
    }
  }
  console.log(`Keep prices still retrievable: ${keepOk}/${keepPriceIds.size}`);

  if (!APPLY && report.archiveCandidates.length) {
    console.log("\nRe-run with --apply to archive the candidates above.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
