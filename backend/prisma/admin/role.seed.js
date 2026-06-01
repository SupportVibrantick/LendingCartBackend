const prisma = require("../client");

async function seedRoles() {
  const roles = [
    "PLATFORM_ADMIN",
    "PLATFORM_SUPPORT",
    "BROKER_ADMIN",
    "BROKER_OFFICER",
    "SUB_BROKER",
    "LENDER_ADMIN",
    "LENDER_UNDERWRITER",
    "CLIENT_USER",
  ];

  for (const roleName of roles) {
    const existingRole = await prisma.role.findFirst({
      where: { name: roleName },
    });

    if (!existingRole) {
      await prisma.role.create({
        data: {
          name: roleName,
          description: roleName.replaceAll("_", " "),
        },
      });

      console.log(`✅ Created role: ${roleName}`);
    } else {
      console.log(`ℹ️ Role already exists: ${roleName}`);
    }
  }

  console.log("✅ Roles seeded");
}

module.exports = {
  seedRoles,
};