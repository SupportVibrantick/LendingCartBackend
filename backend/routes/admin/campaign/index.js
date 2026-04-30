module.exports = async function (fastify, opts) {
  const campaignController = require("../../../modules/campaign/campaign.controller");

  fastify.post("/send", campaignController.sendCampaign);
  fastify.get("/list", require("./list"));
};