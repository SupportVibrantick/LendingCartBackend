/**
 * Shared defaults for all prisma seed scripts.
 * Override via environment variables on local/staging/production seed runs.
 */
module.exports = {
  BROKER_ORG_NAME: process.env.SEED_BROKER_ORG_NAME || "LendingCart Broker",
  BROKER_ORG_EMAIL: process.env.SEED_BROKER_ORG_EMAIL || "broker@lendingcart.local",
  BROKER_ORG_PHONE: process.env.SEED_BROKER_ORG_PHONE || "+10000000001",
  BROKER_EMAIL: process.env.SEED_BROKER_EMAIL || "broker@lendingcart.com",
  BROKER_PASSWORD: process.env.SEED_BROKER_PASSWORD || "Broker@123",

  PLATFORM_ORG_NAME: process.env.SEED_PLATFORM_ORG_NAME || "LendingCart Platform",
  PLATFORM_ORG_EMAIL: process.env.SEED_PLATFORM_ORG_EMAIL || "platform@lendingcart.local",
  PLATFORM_ORG_PHONE: process.env.SEED_PLATFORM_ORG_PHONE || "+10000000000",

  ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL || "admin@lendingcart.com",
  ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD || "admin@123",

  LOAN_OFFICER_PASSWORD: process.env.SEED_LOAN_OFFICER_PASSWORD || "LoanOfficer@123",
  SUB_BROKER_PASSWORD: process.env.SEED_SUB_BROKER_PASSWORD || "SubBroker@123",
};
