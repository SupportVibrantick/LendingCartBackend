const {
  formatInvoiceListRecord,
  buildInvoiceSummary,
  buildInvoiceListWhere,
  invoiceListInclude,
} = require("../../../utils/commission/commissionHelpers");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function listCommissionInvoices(fastify) {
  fastify.get(
    "/invoices",
    {
      schema: {
        tags: ["Broker -> Commissions"],
        summary: "List commission invoices for broker organization",
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
        if (!req.user?.organizationId) {
          return reply.code(403).send({ success: false, message: "Broker access only" });
        }

        const roles = req.user.roles || [];
        if (!roles.includes("BROKER_ADMIN")) {
          return reply.code(403).send({
            success: false,
            message: "Only broker admins can view invoices",
          });
        }

        const prisma = fastify.prisma;
        const brokerOrgId = req.user.organizationId;
        const status = String(req.query?.status || "ALL").toUpperCase();
        const search = String(req.query?.search || "").trim();
        const startDate = req.query?.startDate || null;
        const endDate = req.query?.endDate || null;
        const page = Math.max(1, Number(req.query?.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 10));
        const skip = (page - 1) * limit;

        const where = buildInvoiceListWhere({
          brokerOrgId,
          search,
          startDate,
          endDate,
          paymentStatus: status,
        });

        const [rows, total, allForSummary] = await Promise.all([
          prisma.commissionInvoice.findMany({
            where,
            include: invoiceListInclude,
            orderBy: [{ generatedAt: "desc" }, { createdAt: "desc" }],
            skip,
            take: limit,
          }),
          prisma.commissionInvoice.count({ where }),
          prisma.commissionInvoice.findMany({
            where: { brokerOrgId, status: { not: "VOID" } },
            include: invoiceListInclude,
          }),
        ]);

        const summary = buildInvoiceSummary(allForSummary);

        return reply.send({
          success: true,
          data: rows.map((row) => formatInvoiceListRecord(row)),
          summary,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
          },
        });
      } catch (error) {
        fastify.log.error({ error: error.message }, "List commission invoices failed");
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to list invoices",
        });
      }
    },
  );
};
