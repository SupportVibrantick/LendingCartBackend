const { officerPreHandler, getUserId } = require("../../../services/loanOfficerAccess");
const {
  fetchCommissionInvoiceList,
} = require("../../../services/commission/listCommissionInvoices");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function listLoanOfficerInvoices(fastify) {
  fastify.get(
    "/invoices",
    {
      preHandler: officerPreHandler(fastify),
      schema: {
        tags: ["Loan Officer -> Commissions"],
        summary: "List commission invoices for the logged-in loan officer",
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
        const userId = getUserId(req);
        const brokerOrgId = req.user.organizationId;

        const result = await fetchCommissionInvoiceList(prisma, {
          brokerOrgId,
          recipientUserId: userId,
          recipientRole: "LOAN_OFFICER",
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
        fastify.log.error({ error: error.message }, "LO list invoices failed");
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to list invoices",
        });
      }
    },
  );
};
