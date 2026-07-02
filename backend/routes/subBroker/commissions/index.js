const listCommissions = require("./listCommissions");
const listInvoices = require("./listInvoices");
const getLoanCommissions = require("./getLoanCommissions");
const getCommissionSummary = require("./getCommissionSummary");
const generateInvoice = require("../../broker/commissions/generateInvoice");
const downloadInvoice = require("../../broker/commissions/downloadInvoice");
const getCommissionHistory = require("../../broker/commissions/getCommissionHistory");

async function subBrokerCommissionRoutes(fastify) {
  fastify.register(listCommissions);
  fastify.register(listInvoices);
  fastify.register(getLoanCommissions);
  fastify.register(getCommissionSummary);

  fastify.register(async function securedCommissionActions(instance) {
    instance.addHook("preHandler", fastify.authenticate);
    instance.addHook("preHandler", fastify.requireRole(["SUB_BROKER"]));
    instance.register(generateInvoice);
    instance.register(downloadInvoice);
    instance.register(getCommissionHistory);
  });
}

module.exports = subBrokerCommissionRoutes;
