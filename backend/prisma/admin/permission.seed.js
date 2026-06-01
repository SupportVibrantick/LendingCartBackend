const prisma = require("../client");

async function seedPermissions() {
  const permissions = [
    // Dashboard
    "VIEW_DASHBOARD",

    // Users
    "VIEW_USERS",
    "CREATE_USER",
    "UPDATE_USER",
    "DELETE_USER",

    // Organizations
    "VIEW_ORGANIZATIONS",
    "CREATE_ORGANIZATION",
    "UPDATE_ORGANIZATION",
    "DELETE_ORGANIZATION",

    // Applications
    "VIEW_APPLICATIONS",
    "CREATE_APPLICATION",
    "UPDATE_APPLICATION",
    "DELETE_APPLICATION",
    "SUBMIT_APPLICATION",

    // Lenders
    "VIEW_LENDERS",
    "CREATE_LENDER",
    "UPDATE_LENDER",
    "DELETE_LENDER",

    // Loan Products
    "VIEW_LOAN_PRODUCTS",
    "CREATE_LOAN_PRODUCT",
    "UPDATE_LOAN_PRODUCT",
    "DELETE_LOAN_PRODUCT",

    // Documents
    "VIEW_DOCUMENTS",
    "UPLOAD_DOCUMENTS",
    "DELETE_DOCUMENTS",

    // Roles & Permissions
    "VIEW_ROLES",
    "MANAGE_ROLES",
    "MANAGE_PERMISSIONS",

    // Contacts
    "VIEW_CONTACTS",
    "CREATE_CONTACT",
    "UPDATE_CONTACT",
    "DELETE_CONTACT",

    // Campaigns
    "VIEW_CAMPAIGNS",
    "CREATE_CAMPAIGN",
    "UPDATE_CAMPAIGN",
    "DELETE_CAMPAIGN",
    "SEND_CAMPAIGN",

    // Reports
    "VIEW_REPORTS",

    // Settings
    "MANAGE_SETTINGS",
  ];

  for (const key of permissions) {
    const existing = await prisma.permission.findFirst({
      where: { key },
    });

    if (!existing) {
      await prisma.permission.create({
        data: {
          key,
          description: key.replaceAll("_", " "),
        },
      });

      console.log(`✅ Created permission: ${key}`);
    } else {
      console.log(`ℹ️ Permission already exists: ${key}`);
    }
  }

  console.log("✅ Permissions seeded");
}

module.exports = {
  seedPermissions,
};