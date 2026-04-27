// modules/campaign/campaign.validator.js

const validateCreateCampaign = (body) => {
  const { name, subject, content } = body;

  if (!name || !subject || !content) {
    throw new Error("Name, subject, and content are required");
  }
};

module.exports = {
  validateCreateCampaign,
};