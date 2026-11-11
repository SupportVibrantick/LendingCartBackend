-- Update catalog list prices: Starter $199 / Pro $399 / Elite $699 (monthly).
-- Yearly display stays ~20% off (159 / 319 / 559). Applied on AWS via `prisma migrate deploy`.

UPDATE "subscription_packages"
SET
  "price_monthly" = 199,
  "price_yearly" = 1908,
  "features" = CASE
    WHEN "features" IS NOT NULL AND left(btrim("features"), 1) = '{'
      THEN jsonb_set(
        "features"::jsonb,
        '{priceYearlyMonthly}',
        '159'::jsonb,
        true
      )::text
    ELSE "features"
  END,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "code" = 'BASIC';

UPDATE "subscription_packages"
SET
  "price_monthly" = 399,
  "price_yearly" = 3828,
  "features" = CASE
    WHEN "features" IS NOT NULL AND left(btrim("features"), 1) = '{'
      THEN jsonb_set(
        "features"::jsonb,
        '{priceYearlyMonthly}',
        '319'::jsonb,
        true
      )::text
    ELSE "features"
  END,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "code" = 'PRO';

UPDATE "subscription_packages"
SET
  "price_monthly" = 699,
  "price_yearly" = 6708,
  "features" = CASE
    WHEN "features" IS NOT NULL AND left(btrim("features"), 1) = '{'
      THEN jsonb_set(
        "features"::jsonb,
        '{priceYearlyMonthly}',
        '559'::jsonb,
        true
      )::text
    ELSE "features"
  END,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "code" = 'ELITE';
