const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Admin seeds
const { seedRoles } = require("./admin/role.seed");
const { seedPermissions } = require("./admin/permission.seed");
const { seedRolePermissions } = require("./admin/rolePermission.seed");
const { seedPlatformOrg } = require("./admin/platformOrg.seed");
const { seedAdminUser } = require("./admin/admin.seed");
const { seedDocumentTypes } = require("./admin/documentTypes.seed");
const {
  seedSubscriptionPackages,
} = require("./admin/subscriptionPackages.seed");

// Broker seeds
const { seedBrokerOrg } = require("./broker/brokerOrg.seed");
const { seedBrokerUser } = require("./broker/broker.seed");
const { seedLoanOfficers } = require("./broker/loanOfficers.seed");
const { seedSubBrokers } = require("./broker/subBrokers.seed");
const { seedApplicationBuilder } = require("./broker/applicationBuilder.seed");
// Optional demo data (run manually if needed):
// const { seedLoanApplication } = require("./broker/loanApplication.seed");
// const { seedEligibleApplication } = require("./broker/application.seed");
// const { ensureConversationTypes } = require("./broker/ensureConversationTypes");

// Lender seeds
const { seedLenderOrg } = require("./lender/lenderOrg.seed");
const { seedLenderUser } = require("./lender/lender.seed");
const { seedLenderProfile } = require("./lender/lenderProfile.seed");
const { seedLoanProducts } = require("./admin/loanProduct.seed");
// const { seedEligibleApplication } = require("./broker/application.seed");

async function main() {
  console.log("🚀 Starting database seed...\n");

  // ================== Admin ==================
  await seedRoles();
  await seedPermissions();
  await seedRolePermissions();
  await seedPlatformOrg();
  await seedAdminUser();

  // ================== Broker ==================
  await seedBrokerOrg();
  await seedBrokerUser();
  await seedLoanOfficers();
  await seedSubBrokers();
  await seedLoanProducts();

  // ================== Lender ==================
  await seedLenderOrg();
  await seedLenderUser();
  await seedLenderProfile();

  await seedDocumentTypes();

  await seedSubscriptionPackages();
  await seedApplicationBuilder();
  // await seedLoanApplication();      // demo loan pipeline row + submission fields
  // await seedEligibleApplication();  // minimal submitted application only
  // await ensureConversationTypes();

  console.log("\n✅ Database seed completed successfully.");
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
