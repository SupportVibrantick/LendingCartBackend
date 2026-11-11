-- Update catalog list prices: Starter $199 / Pro $399 / Elite $699 (monthly).
-- Column names match init schema (camelCase on subscription_packages).

UPDATE "subscription_packages"
SET
  "priceMonthly" = 199,
  "priceYearly" = 1908,
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
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'BASIC';

UPDATE "subscription_packages"
SET
  "priceMonthly" = 399,
  "priceYearly" = 3828,
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
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'PRO';

UPDATE "subscription_packages"
SET
  "priceMonthly" = 699,
  "priceYearly" = 6708,
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
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'ELITE';
