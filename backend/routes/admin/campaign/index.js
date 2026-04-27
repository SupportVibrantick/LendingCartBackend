// Fastify route (correct)

module.exports = async function (fastify, opts) {
  const campaignController = require("../../../modules/campaign/campaign.controller");

  fastify.post("/create", campaignController.createCampaign);

  fastify.post("/add-recipients", campaignController.addRecipients);
};