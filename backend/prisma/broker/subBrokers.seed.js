const bcrypt = require("bcryptjs");
const prisma = require("../client");
const { BROKER_ORG_NAME, BROKER_EMAIL, SUB_BROKER_PASSWORD } = require("../seedConfig");

const DEFAULT_PASSWORD = SUB_BROKER_PASSWORD;

const SUB_BROKERS = [
  {
    email: process.env.SEED_SUB_BROKER_1_EMAIL || "alex.rivera@demo-broker.com",
    firstName: "Alex",
    lastName: "Rivera",
    phone: "+1-555-0201",
  },
  {
    email:
      process.env.SEED_SUB_BROKER_2_EMAIL || "maria.gonzalez@demo-broker.com",
    firstName: "Maria",
    lastName: "Gonzalez",
    phone: "+1-555-0202",
  },
];

async function seedSubBrokers() {
  const brokerOrgName = BROKER_ORG_NAME;
  const brokerEmail = BROKER_EMAIL;

  const organization = await prisma.organization.findFirst({
    where: { name: brokerOrgName },
  });

  if (!organization) {
    throw new Error(`Broker organization not found: ${brokerOrgName}`);
  }

  const brokerAdmin = await prisma.userAccount.findUnique({
    where: { email: brokerEmail },
  });

  if (!brokerAdmin) {
    throw new Error(
      `Broker admin not found: ${brokerEmail}. Run seedBrokerUser first.`,
    );
  }

  const role = await prisma.role.findFirst({
    where: { name: "SUB_BROKER" },
  });

  if (!role) {
    throw new Error("SUB_BROKER role not found");
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const seededUsers = [];

  for (const subBroker of SUB_BROKERS) {
    let user = await prisma.userAccount.findUnique({
      where: { email: subBroker.email },
    });

    if (!user) {
      user = await prisma.userAccount.create({
        data: {
          organizationId: organization.id,
          email: subBroker.email,
          passwordHash,
          firstName: subBroker.firstName,
          lastName: subBroker.lastName,
          phone: subBroker.phone,
          createdById: brokerAdmin.id,
          status: "ACTIVE",
        },
      });

      console.log(`✅ Sub broker created: ${user.email}`);
    } else {
      console.log(`ℹ️ Sub broker already exists: ${user.email}`);

      if (!user.createdById) {
        await prisma.userAccount.update({
          where: { id: user.id },
          data: { createdById: brokerAdmin.id },
        });
      }
    }

    const existingUserRole = await prisma.userRole.findFirst({
      where: {
        userId: user.id,
        roleId: role.id,
      },
    });

    if (!existingUserRole) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
        },
      });

      console.log(`✅ SUB_BROKER role assigned to ${user.email}`);
    }

    seededUsers.push(user);
  }

  console.log("✅ Sub brokers seeded");
  return seededUsers;
}

module.exports = {
  seedSubBrokers,
};
