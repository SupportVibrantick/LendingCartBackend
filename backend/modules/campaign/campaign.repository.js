// modules/campaign/campaign.repository.js

const prisma = require("../../prisma/client");

const createCampaign = (data) => {
  return prisma.campaign.create({ data });
};

// ✅ NEW
const addRecipients = async (campaignId, contactIds) => {
  const data = contactIds.map((contactId) => ({
    campaignId,
    contactId,
  }));

  return prisma.campaignRecipient.createMany({
    data,
    skipDuplicates: true,
  });
};

module.exports = {
  createCampaign,
  addRecipients,
};