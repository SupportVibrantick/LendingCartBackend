// backend/prisma/seed.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function ensureRoles(roleNames = []) {
  const created = [];
  for (const name of roleNames) {
    const existing = await prisma.role.findFirst({ where: { name } });
    if (!existing) {
      const r = await prisma.role.create({
        data: { name, description: `${name} role seeded` },
      });
      created.push(r);
      console.log(`✅ Created role: ${name} (${r.id})`);
    } else {
      console.log(`ℹ️  Role exists: ${name} (${existing.id})`);
    }
  }
  return created;
}

async function main() {
  console.log("▶️  Starting seed...");

  const rolesToSeed = [
    "PLATFORM_ADMIN",
    "PLATFORM_SUPPORT",
    "BROKER_ADMIN",
    "BROKER_OFFICER",
    "LENDER_ADMIN",
    "LENDER_UNDERWRITER",
    "CLIENT_USER",
  ];

  const orgName = process.env.SEED_ADMIN_ORG_NAME || "LendingCart Platform";
  const orgEmail = process.env.SEED_ADMIN_ORG_EMAIL || "platform@lendingcart.local";

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

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: orgName,
        type: "PLATFORM",
        status: "ACTIVE",
        email: orgEmail,
      },
    });
    console.log("✅ Created organization:", organization.id);
  } else {
    console.log("ℹ️  Found existing organization:", organization.id);
  }

  // 3) Upsert admin user by unique email (UserAccount.email is unique in schema)
  const admin = await prisma.userAccount.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: hashed,
      status: "ACTIVE",
      organizationId: organization.id,
      firstName: "Admin",
      lastName: "User",
    },
    create: {
      email: adminEmail,
      passwordHash: hashed,
      status: "ACTIVE",
      firstName: "Admin",
      lastName: "User",
      organizationId: organization.id,
    },
  });

  console.log("✅ Admin user upserted:", admin.id);

  // 4) Ensure PLATFORM_ADMIN role exists and link user -> role via UserRole if not already linked
  const platformAdminRole = await prisma.role.findFirst({ where: { name: "PLATFORM_ADMIN" } });
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
    console.log(`ℹ️  User ${admin.id} already has role ${platformAdminRole.name}`);
  }

  console.log("\n🎉 Seed finished.");
  console.log(`Organization: ${organization.name} (${organization.id})`);
  console.log(`Admin Email: ${admin.email}`);
  console.log(`Admin Password (plaintext): ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
