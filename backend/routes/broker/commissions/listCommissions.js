const {
  formatCommissionRecord,
  buildMonthlySummary,
} = require("../../../utils/commissionHelpers");
const {
  commissionInclude,
  buildCommissionListWhere,
} = require("../../../utils/commissionQueryHelpers");
const { derivePayoutStatus } = require("../../../services/commission/recordCommissionPayout");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function listCommissions(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Broker -> Commissions"],
        summary: "List deal commissions for broker organization",
        querystring: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["PENDING", "UNPAID", "PAID", "ALL"] },
            role: {
              type: "string",
              enum: ["LOAN_OFFICER", "CO_BROKER", "BROKER"],
            },
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
            message: "Only broker admins can manage commissions",
          });
        }

        const prisma = fastify.prisma;
        const brokerOrgId = req.user.organizationId;
        const status = String(req.query?.status || "ALL").toUpperCase();
        const role = req.query?.role ? String(req.query.role).toUpperCase() : null;
        const page = Math.max(1, Number(req.query?.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 20));
        const skip = (page - 1) * limit;

        const where = buildCommissionListWhere({ brokerOrgId, status, role });

        const [rows, total, allForSummary] = await Promise.all([
          prisma.dealCommission.findMany({
            where,
            include: commissionInclude,
            orderBy: [{ calculatedAt: "desc" }, { createdAt: "desc" }],
            skip,
            take: limit,
          }),
          prisma.dealCommission.count({ where }),
          prisma.dealCommission.findMany({
            where: { brokerOrgId, status: "CALCULATED" },
            include: {
              payouts: {
                where: { status: "COMPLETED" },
                select: { amount: true, paidAt: true, status: true },
              },
            },
          }),
        ]);

        const summaryRows = allForSummary.map((row) => ({
          commissionAmount: row.commissionAmount,
          calculatedAt: row.calculatedAt,
          paidAt: row.payouts?.[0]?.paidAt || null,
          payoutStatus: derivePayoutStatus(row.commissionAmount, row.payouts),
          status: derivePayoutStatus(row.commissionAmount, row.payouts),
        }));

        const summary = buildMonthlySummary(summaryRows, 6);

        return reply.send({
          success: true,
          data: rows.map((row) => formatCommissionRecord(row)),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
          },
          summary,
        });
      } catch (error) {
        fastify.log.error({ error: error.message }, "List commissions failed");
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to list commissions",
        });
      }
    },
  );
};

module.exports.commissionInclude = commissionInclude;
