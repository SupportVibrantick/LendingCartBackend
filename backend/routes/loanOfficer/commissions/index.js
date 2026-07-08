const { officerPreHandler } = require("../../../services/broker/loanOfficerAccess");
const listCommissions = require("./listCommissions");
const listInvoices = require("./listInvoices");
const getLoanCommissions = require("./getLoanCommissions");
const getCommissionSummary = require("./getCommissionSummary");
const generateInvoice = require("../../broker/commissions/generateInvoice");
const downloadInvoice = require("../../broker/commissions/downloadInvoice");
const getCommissionHistory = require("../../broker/commissions/getCommissionHistory");

async function loanOfficerCommissionRoutes(fastify) {
  fastify.register(listCommissions);
  fastify.register(listInvoices);
  fastify.register(getLoanCommissions);
  fastify.register(getCommissionSummary);

  fastify.register(async function securedCommissionActions(instance) {
    for (const handler of officerPreHandler(fastify)) {
      instance.addHook("preHandler", handler);
    }
    instance.register(generateInvoice);
    instance.register(downloadInvoice);
    instance.register(getCommissionHistory);
  });
}

module.exports = loanOfficerCommissionRoutes;
