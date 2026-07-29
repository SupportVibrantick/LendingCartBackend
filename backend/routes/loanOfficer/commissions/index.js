const { officerPreHandler } = require("../../../services/broker/loanOfficerAccess");
const listCommissions = require("./listCommissions");
const listInvoices = require("./listInvoices");
const getLoanCommissions = require("./getLoanCommissions");
const getCommissionSummary = require("./getCommissionSummary");
const generateInvoice = require("../../broker/commissions/generateInvoice");
const downloadInvoice = require("../../broker/commissions/downloadInvoice");
const getCommissionHistory = require("../../broker/commissions/getCommissionHistory");

async function loanOfficerCommissionRoutes(fastify) {
  await fastify.register(listCommissions);
  await fastify.register(listInvoices);
  await fastify.register(getLoanCommissions);
  await fastify.register(getCommissionSummary);

  await fastify.register(async function securedCommissionActions(instance) {
    for (const handler of officerPreHandler(fastify)) {
      instance.addHook("preHandler", handler);
    }

    await instance.register(generateInvoice);
    await instance.register(downloadInvoice);
    await instance.register(getCommissionHistory);
  });
}

module.exports = loanOfficerCommissionRoutes;
