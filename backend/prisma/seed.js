// backend/prisma/seedSubBrokerRole.js

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("▶️ Seeding SUB_BROKER role...");

  const roleName = "SUB_BROKER";

  const orgName = process.env.SEED_ADMIN_ORG_NAME || "LendingCart Platform";
  const orgEmail =
    process.env.SEED_ADMIN_ORG_EMAIL || "platform@lendingcart.local";

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@lendingcart.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin@123";
  const hashed = await bcrypt.hash(adminPassword, 10);

  // 1) Seed roles
  console.log("📦 Seeding roles...");
  await ensureRoles(rolesToSeed);

  // 2) Find or create Organization
  let organization = await prisma.organization.findFirst({
    where: { name: orgName },
  });

  if (existing) {
    console.log(`ℹ️ Role already exists: ${roleName} (${existing.id})`);
    return;
  }

  // Create role
  const role = await prisma.role.create({
    data: {
      name: roleName,
      description: "Sub broker role",
    },
  });

  console.log("Admin user upserted:", admin.id);

  // 4) Ensure PLATFORM_ADMIN role exists and link user -> role via UserRole if not already linked
  const platformAdminRole = await prisma.role.findFirst({
    where: { name: "PLATFORM_ADMIN" },
  });
  if (!platformAdminRole) {
    throw new Error("PLATFORM_ADMIN role not found after seeding.");
  }

  const existingUserRole = await prisma.userRole.findFirst({
    where: { userId: admin.id, roleId: platformAdminRole.id },
  });

  if (!existingUserRole) {
    await prisma.userRole.create({
      data: {
        userId: admin.id,
        roleId: platformAdminRole.id,
      },
    });
    console.log(`✅ Linked user ${admin.id} -> role ${platformAdminRole.name}`);
  } else {
    console.log(
      `ℹ️  User ${admin.id} already has role ${platformAdminRole.name}`,
    );
  }

  console.log("\n🎉 Seed finished.");
  console.log(`Organization: ${organization.name} (${organization.id})`);
  console.log(`Admin Email: ${admin.email}`);
  console.log(`Admin Password (plaintext): ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });





















  