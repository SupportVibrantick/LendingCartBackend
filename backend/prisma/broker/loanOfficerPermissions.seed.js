const prisma = require("../client");

const LOAN_OFFICER_PERMISSIONS = [
  "VIEW_APPLICATIONS",
  "VIEW_DASHBOARD_STATS",
  "VIEW_DASHBOARD_RECENT",
  "CREATE_APPLICATION",
  "EDIT_APPLICATION",
  "DELETE_APPLICATION",
  "ASSIGN_APPLICATION",
  "SUBMIT_TO_LENDERS",
  "VIEW_BORROWERS",
  "CREATE_BORROWERS",
  "EDIT_BORROWERS",
  "UPLOAD_DOCUMENTS",
  "REQUEST_DOCUMENTS",
  "DOCUMENTS_TO_SIGN",
  "VIEW_LOI_TERM_SHEET",
  "VIEW_FEE_AGREEMENT",
  "VIEW_LENDER_HUB",
  "AUTO_FORWARD_TO_LENDER",
  "AUTO_FORWARD_TO_CLIENT",
  "DELETE_DOCUMENTS",
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
  "ACCESS_BORROWER_PORTAL",
  "VIEW_CONTACTS",
  "CREATE_CONTACTS",
  "EDIT_CONTACTS",
  "DELETE_CONTACTS",
  "CREATE_CO_BROKER",
  "MANAGE_OWN_CO_BROKERS",
  "ASSIGN_CO_BROKER",
  "CHAT",
  "SEND_EMAILS",
  "SEND_NOTIFICATIONS",
  "VIEW_REPORTS",
  "EXPORT_REPORTS",
  "VIEW_COMMISSIONS",
  "VIEW_INVOICES",
  "MANAGE_BRANDING",
  "VIEW_COMPANY_SETTINGS",
  "MANAGE_CUSTOM_DOCUMENTS",
  "VIEW_CUSTOM_DOCUMENTS",
];

async function seedLoanOfficerPermissions() {
  for (const key of LOAN_OFFICER_PERMISSIONS) {
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

      console.log(`✅ Created LO permission: ${key}`);
    }
  }

  console.log("✅ Loan officer permissions seeded");
}

module.exports = {
  seedLoanOfficerPermissions,
  LOAN_OFFICER_PERMISSIONS,
};
