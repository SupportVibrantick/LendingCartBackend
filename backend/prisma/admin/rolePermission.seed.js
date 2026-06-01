const prisma = require("../client");

async function seedRolePermissions() {
  const rolePermissions = {
    PLATFORM_ADMIN: ["*"],

    PLATFORM_SUPPORT: [
      "VIEW_DASHBOARD",
      "VIEW_USERS",
      "VIEW_ORGANIZATIONS",
      "VIEW_APPLICATIONS",
      "VIEW_LENDERS",
      "VIEW_LOAN_PRODUCTS",
      "VIEW_REPORTS",
    ],

    BROKER_ADMIN: [
      "VIEW_DASHBOARD",

      "VIEW_APPLICATIONS",
      "CREATE_APPLICATION",
      "UPDATE_APPLICATION",
      "SUBMIT_APPLICATION",

      "VIEW_CONTACTS",
      "CREATE_CONTACT",
      "UPDATE_CONTACT",
      "DELETE_CONTACT",

      "VIEW_DOCUMENTS",
      "UPLOAD_DOCUMENTS",

      "VIEW_CAMPAIGNS",
      "CREATE_CAMPAIGN",
      "UPDATE_CAMPAIGN",
      "DELETE_CAMPAIGN",
      "SEND_CAMPAIGN",
    ],

    BROKER_OFFICER: [
      "VIEW_DASHBOARD",

      "VIEW_APPLICATIONS",
      "CREATE_APPLICATION",
      "UPDATE_APPLICATION",
      "SUBMIT_APPLICATION",

      "VIEW_CONTACTS",

      "VIEW_DOCUMENTS",
      "UPLOAD_DOCUMENTS",
    ],

    SUB_BROKER: [
      "VIEW_DASHBOARD",

      "VIEW_APPLICATIONS",

      "VIEW_DOCUMENTS",
      "UPLOAD_DOCUMENTS",
    ],

    LENDER_ADMIN: [
      "VIEW_DASHBOARD",

      "VIEW_APPLICATIONS",

      "VIEW_LOAN_PRODUCTS",
      "CREATE_LOAN_PRODUCT",
      "UPDATE_LOAN_PRODUCT",

      "VIEW_DOCUMENTS",

      "VIEW_USERS",
      "CREATE_USER",
      "UPDATE_USER",
    ],

    LENDER_UNDERWRITER: [
      "VIEW_DASHBOARD",
      "VIEW_APPLICATIONS",
      "VIEW_DOCUMENTS",
    ],

    CLIENT_USER: [
      "VIEW_APPLICATIONS",
      "VIEW_DOCUMENTS",
      "UPLOAD_DOCUMENTS",
    ],
  };

  for (const [roleName, permissionKeys] of Object.entries(rolePermissions)) {
    const role = await prisma.role.findFirst({
      where: { name: roleName },
    });

    if (!role) {
      console.log(`⚠️ Role not found: ${roleName}`);
      continue;
    }

    let permissions = [];

    if (permissionKeys.includes("*")) {
      permissions = await prisma.permission.findMany();
    } else {
      permissions = await prisma.permission.findMany({
        where: {
          key: {
            in: permissionKeys,
          },
        },
      });
    }

    for (const permission of permissions) {
      const exists = await prisma.rolePermission.findFirst({
        where: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });

      if (!exists) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });

        console.log(
          `✅ ${roleName} -> ${permission.key}`
        );
      }
    }
  }

  console.log("✅ Role permissions seeded");
}

module.exports = {
  seedRolePermissions,
};