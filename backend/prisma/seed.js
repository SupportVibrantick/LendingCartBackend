const { PrismaClient } = require("../generated/prisma/client");

const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function role() {
  const roleName = "Admin";

  // Upsert role
  const role = await prisma.role.upsert({
    where: { name: roleName },
    update: {},
    create: {
      name: roleName,
    },
  });

  console.log(`✅ Role seeded: ${role.name}`);
  return role.id;
}

async function admin(roleId) {
  const name = "Vcn";
  const email = "admin@gmail.com";
  const plainPassword = "Admin@123";
  const phone = "7894561230";

  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  // Upsert admin user
  await prisma.admin.upsert({
    where: { email },
    update: {},
    create: {
      name,
      email,
      password: hashedPassword,
      phone,
      roleId: roleId,
    },
  });

  console.log(`✅ Admin seeded: ${email}`);
}

async function main() {
  const roleId = await role();
  await admin(roleId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });