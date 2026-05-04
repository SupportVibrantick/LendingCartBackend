// backend/prisma/seedSubBrokerRole.js

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("▶️ Seeding SUB_BROKER role...");

  const roleName = "SUB_BROKER";

  // Check if already exists
  const existing = await prisma.role.findFirst({
    where: { name: roleName },
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

  console.log(`✅ Created role: ${role.name} (${role.id})`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });