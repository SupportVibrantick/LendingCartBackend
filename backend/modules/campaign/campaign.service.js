// modules/campaign/campaign.service.js

const campaignRepo = require("./campaign.repository");

const createCampaign = async (payload, user) => {
  const { name, subject, content, scheduledAt } = payload;

  return campaignRepo.createCampaign({
    name,
    subject,
    content,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    orgId: user.organizationId,
    createdById: user.id,
  });
};

// ✅ NEW
const addRecipients = async (payload, user) => {
  const { campaignId, contactIds } = payload;

  if (!campaignId || !contactIds?.length) {
    throw new Error("campaignId and contactIds required");
  }

  // 🔐 ensure campaign belongs to same org
  // (IMPORTANT for security)
  // You can enhance later with proper check

  return campaignRepo.addRecipients(campaignId, contactIds);
};

module.exports = {
  createCampaign,
  addRecipients,
};