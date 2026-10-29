const listCommissions = require("./listCommissions");
const listInvoices = require("./listInvoices");
const getLoanCommissions = require("./getLoanCommissions");
const recordPayout = require("./recordPayout");
const sendAchPayout = require("./sendAchPayout");
const getCommissionSummary = require("./getCommissionSummary");
const generateInvoice = require("./generateInvoice");
const downloadInvoice = require("./downloadInvoice");
const getCommissionHistory = require("./getCommissionHistory");
const getOrgBanking = require("./getOrgBanking");
const upsertOrgBanking = require("./upsertOrgBanking");

async function brokerCommissionRoutes(fastify) {
  fastify.register(getOrgBanking);
  fastify.register(upsertOrgBanking);
  fastify.register(listCommissions);
  fastify.register(listInvoices);
  fastify.register(getCommissionSummary);
  fastify.register(getLoanCommissions);
  fastify.register(generateInvoice);
  fastify.register(downloadInvoice);
  fastify.register(getCommissionHistory);
  fastify.register(sendAchPayout);
  fastify.register(recordPayout);
}

module.exports = brokerCommissionRoutes;
