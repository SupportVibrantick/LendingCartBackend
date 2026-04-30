const campaignController = require("../../../modules/campaign/campaign.controller");
const listRoute = require("./list"); 

module.exports = async function (fastify, opts) {
  fastify.post("/send", campaignController.sendCampaign);
  fastify.patch("/:id/stop", campaignController.stopCampaign);
  fastify.register(listRoute, { prefix: "/list" });
};