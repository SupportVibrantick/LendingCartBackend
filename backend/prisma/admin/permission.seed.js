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
    "EXPORT_REPORTS",

    // Settings
    "MANAGE_SETTINGS",

    // Loan Officer / Broker dashboard
    "VIEW_DASHBOARD_STATS",
    "VIEW_DASHBOARD_RECENT",
    "EDIT_APPLICATION",
    "ASSIGN_APPLICATION",
    "SUBMIT_TO_LENDERS",
    "REQUEST_DOCUMENTS",
    "DOCUMENTS_TO_SIGN",
    "VIEW_LOI_TERM_SHEET",
    "VIEW_FEE_AGREEMENT",
    "VIEW_LENDER_HUB",
    "AUTO_FORWARD_TO_LENDER",
    "AUTO_FORWARD_TO_CLIENT",
    "MANAGE_CUSTOM_DOCUMENTS",
    "VIEW_CUSTOM_DOCUMENTS",
    "GENERATE_LOI",
    "REGENERATE_LOI",
    "SEND_LOI_TO_CLIENT",
    "SEND_LOI_TO_LENDER",
    "VIEW_MARKETPLACE",
    "CONNECT_LENDERS",
    "SEND_APPLICATIONS",
    "ADD_OWN_LENDER",
    "VIEW_CO_BROKERS",
    "ACCESS_CO_BROKER_PORTAL",
    "EDIT_CO_BROKERS",
    "DISABLE_CO_BROKERS",
    "DELETE_CO_BROKERS",
    "VIEW_BORROWERS",
    "ACCESS_BORROWER_PORTAL",
    "CREATE_BORROWERS",
    "EDIT_BORROWERS",
    "CREATE_CONTACTS",
    "EDIT_CONTACTS",
    "DELETE_CONTACTS",
    "CHAT",
    "SEND_EMAILS",
    "SEND_NOTIFICATIONS",
    "VIEW_COMMISSIONS",
    "VIEW_INVOICES",
    "MANAGE_BRANDING",
    "VIEW_COMPANY_SETTINGS",

    // Subscriptions
    "VIEW_SUBSCRIPTIONS",
    "CREATE_SUBSCRIPTION",
    "UPDATE_SUBSCRIPTION",
    "DELETE_SUBSCRIPTION",
    "VIEW_SUBSCRIBERS",
    "MANAGE_SUBSCRIBERS",
    "VIEW_SUBSCRIPTION_INVOICES",
    "MANAGE_SUBSCRIPTION_INVOICES",
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