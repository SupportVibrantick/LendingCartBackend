const listCommissions = require("./listCommissions");
const listInvoices = require("./listInvoices");
const getLoanCommissions = require("./getLoanCommissions");
const recordPayout = require("./recordPayout");
const getCommissionSummary = require("./getCommissionSummary");
const generateInvoice = require("./generateInvoice");
const downloadInvoice = require("./downloadInvoice");
const getCommissionHistory = require("./getCommissionHistory");

async function brokerCommissionRoutes(fastify) {
  fastify.register(listCommissions);
  fastify.register(listInvoices);
  fastify.register(getCommissionSummary);
  fastify.register(getLoanCommissions);
  fastify.register(generateInvoice);
  fastify.register(downloadInvoice);
  fastify.register(getCommissionHistory);
  fastify.register(recordPayout);
}

module.exports = brokerCommissionRoutes;
