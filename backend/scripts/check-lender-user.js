const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const email = process.argv[2] || "tusharjain61451@gmail.com";
const password = process.argv[3] || "admin@123";

async function main() {
  const prisma = new PrismaClient();
  const user = await prisma.userAccount.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
    },
    include: {
      organization: true,
      roles: { include: { role: true } },
    },
  });

  if (!user) {
    console.log("USER_NOT_FOUND");
    return;
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  console.log(
    JSON.stringify(
      {
        found: true,
        email: user.email,
        status: user.status,
        orgType: user.organization?.type,
        orgStatus: user.organization?.status,
        roles: user.roles.map((r) => r.role.name),
        passwordMatch,
      },
      null,
      2,
    ),
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    const prisma = new PrismaClient();
    await prisma.$disconnect();
  });
