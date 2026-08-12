const ghlService = require("../../modules/ghl/ghl.service");
const { isGhlEnabled } = require("../../config/env");

function toBookDemoGhlPayload(lead) {
  return {
    firstName: lead.firstName || "",
    lastName: lead.lastName || "",
    email: lead.email,
    phone: lead.phone || undefined,
    companyName: lead.company || undefined,
    leadSource: "LendingCart Website",
    leadType: "Book Demo",
    interestedPlan:
      lead.interestedPlanName || lead.interestedPlanCode || "",
    lendingCartLeadId: lead.id || "",
    tags: ghlService.buildTags({
      interestedPlanCode: lead.interestedPlanCode,
    }),
  };
}

function toAdminManualGhlPayload(lead) {
  return {
    firstName: lead.firstName || "",
    lastName: lead.lastName || "",
    email: lead.email,
    phone: lead.phone || undefined,
    companyName: undefined,
    leadSource: "LendingCart Admin",
    leadType: lead.source || "Admin",
    interestedPlan: lead.campaign || "",
    lendingCartLeadId: lead.id || "",
    tags: [
      "lendingcart-lead",
      "admin-contact",
      String(lead.source || "admin")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "admin",
    ].filter(Boolean),
  };
}

async function syncLeadModelToGhl(
  prisma,
  modelName,
  lead,
  buildPayload,
  { logger } = {},
) {
  if (!lead?.id) throw new Error("Lead is required");

  const model = prisma[modelName];
  if (!model) throw new Error(`Unknown model: ${modelName}`);

  if (!isGhlEnabled()) {
    return model.update({
      where: { id: lead.id },
      data: {
        ghlSyncStatus: "SKIPPED",
        ghlLastError: "GHL_ENABLED=false",
        ghlSyncedAt: null,
      },
    });
  }

  if (!ghlService.canSyncContacts()) {
    return model.update({
      where: { id: lead.id },
      data: {
        ghlSyncStatus: "FAILED",
        ghlLastError:
          "GHL contact sync requires GHL_API_KEY + GHL_LOCATION_ID",
        ghlSyncedAt: null,
      },
    });
  }

  await model.update({
    where: { id: lead.id },
    data: {
      ghlSyncStatus: "PENDING",
      ghlLastError: null,
    },
  });

  try {
    const result = await ghlService.upsertGhlContact(buildPayload(lead));
    return model.update({
      where: { id: lead.id },
      data: {
        ghlSyncStatus: "SYNCED",
        ghlContactId: result.ghlContactId || lead.ghlContactId || null,
        ghlSyncedAt: new Date(),
        ghlLastError: null,
      },
    });
  } catch (err) {
    const message = err.message || "GHL sync failed";
    if (logger?.error) {
      logger.error(
        { leadId: lead.id, message, modelName },
        "GHL lead sync failed",
      );
    } else {
      console.error("GHL lead sync failed:", message);
    }
    return model.update({
      where: { id: lead.id },
      data: {
        ghlSyncStatus: "FAILED",
        ghlLastError: String(message).slice(0, 1000),
      },
    });
  }
}

async function syncBookDemoLeadToGhl(prisma, lead, options = {}) {
  return syncLeadModelToGhl(
    prisma,
    "loanAiBookDemoLead",
    lead,
    toBookDemoGhlPayload,
    options,
  );
}

async function syncAdminManualLeadToGhl(prisma, lead, options = {}) {
  return syncLeadModelToGhl(
    prisma,
    "adminManualLead",
    lead,
    toAdminManualGhlPayload,
    options,
  );
}

function syncBookDemoLeadToGhlInBackground(prisma, lead, options = {}) {
  setImmediate(() => {
    syncBookDemoLeadToGhl(prisma, lead, options).catch((err) => {
      console.error("Background GHL sync error:", err.message);
    });
  });
}

function syncAdminManualLeadToGhlInBackground(prisma, lead, options = {}) {
  setImmediate(() => {
    syncAdminManualLeadToGhl(prisma, lead, options).catch((err) => {
      console.error("Background admin GHL sync error:", err.message);
    });
  });
}

module.exports = {
  syncBookDemoLeadToGhl,
  syncBookDemoLeadToGhlInBackground,
  syncAdminManualLeadToGhl,
  syncAdminManualLeadToGhlInBackground,
  toBookDemoGhlPayload,
  toAdminManualGhlPayload,
  toGhlContactPayload: toBookDemoGhlPayload,
};
