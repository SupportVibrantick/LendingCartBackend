const {
  fetchCommissionInvoiceList,
} = require("../../../services/commission/listCommissionInvoices");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function listSubBrokerInvoices(fastify) {
  fastify.get(
    "/invoices",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],
      schema: {
        tags: ["Sub Broker -> Commissions"],
        summary: "List commission invoices for the logged-in co-broker",
        querystring: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: [
                "ALL",
                "DRAFT",
                "DUE",
                "UNPAID",
                "PENDING",
                "RECEIVED",
                "PAID",
                "OVERDUE",
              ],
            },
            search: { type: "string" },
            startDate: { type: "string" },
            endDate: { type: "string" },
            page: { type: "integer", minimum: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100 },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const prisma = fastify.prisma;
        const userId = req.user.userId || req.user.id;
        const brokerOrgId = req.user.organizationId;

        const result = await fetchCommissionInvoiceList(prisma, {
          brokerOrgId,
          recipientUserId: userId,
          recipientRole: "CO_BROKER",
          status: String(req.query?.status || "ALL").toUpperCase(),
          search: String(req.query?.search || "").trim(),
          startDate: req.query?.startDate || null,
          endDate: req.query?.endDate || null,
          page: req.query?.page,
          limit: req.query?.limit,
        });

        return reply.send({
          success: true,
          ...result,
        });
      } catch (error) {
        fastify.log.error({ error: error.message }, "Co-broker list invoices failed");
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to list invoices",
        });
      }
    },
  );
};
