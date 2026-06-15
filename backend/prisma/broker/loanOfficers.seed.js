const bcrypt = require("bcryptjs");
const prisma = require("../client");
const { BROKER_ORG_NAME, LOAN_OFFICER_PASSWORD } = require("../seedConfig");

const LOAN_OFFICERS = [
  {
    email: process.env.SEED_LO_OFFICER_1_EMAIL || "sarah.mitchell@demo-broker.com",
    firstName: "Sarah",
    lastName: "Mitchell",
    phone: "+1-555-0101",
    permissions: [
      "VIEW_APPLICATIONS",
      "VIEW_CONTACTS",
      "VIEW_CAMPAIGNS",
      "VIEW_REPORTS",
    ],
    profile: {
      company: BROKER_ORG_NAME,
      tollFree: "800-555-0101",
      tollFreeExt: "101",
      serviceProvider: "Twilio",
      address: "123 Main Street",
      suite: "Suite 200",
      city: "Des Moines",
      state: "IA",
      zipCode: "50309",
      agentType: "Loan Officer",
      licenseNumber: "LO-IA-1001",
      preferredComm: "Email",
      website: "https://demo-broker.com/sarah",
    },
  },
  {
    email: process.env.SEED_LO_OFFICER_2_EMAIL || "james.carter@demo-broker.com",
    firstName: "James",
    lastName: "Carter",
    phone: "+1-555-0102",
    permissions: ["VIEW_APPLICATIONS", "VIEW_CONTACTS"],
    profile: {
      company: BROKER_ORG_NAME,
      tollFree: "800-555-0102",
      address: "456 Oak Avenue",
      city: "Dallas",
      state: "TX",
      zipCode: "75201",
      agentType: "Loan Officer",
      licenseNumber: "LO-TX-2002",
      preferredComm: "Phone",
      website: "https://demo-broker.com/james",
    },
  },
];

async function assignPermissions(userId, permissionKeys) {
  if (!permissionKeys?.length) return;

  const permissionRecords = await prisma.permission.findMany({
    where: { key: { in: permissionKeys } },
  });

  for (const perm of permissionRecords) {
    const existing = await prisma.userPermission.findFirst({
      where: {
        userId,
        permissionId: perm.id,
      },
    });

    if (!existing) {
      await prisma.userPermission.create({
        data: {
          userId,
          permissionId: perm.id,
          isAllowed: true,
        },
      });
    }
  }
}

async function seedLoanOfficers() {
  const brokerOrgName = BROKER_ORG_NAME;

  const organization = await prisma.organization.findFirst({
    where: { name: brokerOrgName },
  });

  if (!organization) {
    throw new Error(`Broker organization not found: ${brokerOrgName}`);
  }

  const role = await prisma.role.findFirst({
    where: { name: "BROKER_OFFICER" },
  });

  if (!role) {
    throw new Error("BROKER_OFFICER role not found");
  }

  const passwordHash = await bcrypt.hash(LOAN_OFFICER_PASSWORD, 10);
  const seededUsers = [];

  for (const officer of LOAN_OFFICERS) {
    let user = await prisma.userAccount.findUnique({
      where: { email: officer.email },
    });

    if (!user) {
      user = await prisma.userAccount.create({
        data: {
          organizationId: organization.id,
          email: officer.email,
          passwordHash,
          firstName: officer.firstName,
          lastName: officer.lastName,
          phone: officer.phone,
          status: "ACTIVE",
        },
      });

      console.log(`✅ Loan officer created: ${user.email}`);
    } else {
      console.log(`ℹ️ Loan officer already exists: ${user.email}`);
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

      console.log(`✅ BROKER_OFFICER role assigned to ${user.email}`);
    }

    const existingProfile = await prisma.brokerUserProfile.findUnique({
      where: { userId: user.id },
    });

    if (!existingProfile) {
      await prisma.brokerUserProfile.create({
        data: {
          userId: user.id,
          ...officer.profile,
        },
      });

      console.log(`✅ Loan officer profile created for ${user.email}`);
    } else {
      console.log(`ℹ️ Loan officer profile already exists for ${user.email}`);
    }

    await assignPermissions(user.id, officer.permissions);
    seededUsers.push(user);
  }

  console.log("✅ Loan officers seeded");
  return seededUsers;
}

module.exports = {
  seedLoanOfficers,
};
