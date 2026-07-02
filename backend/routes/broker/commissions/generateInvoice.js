const { formatCommissionRecord } = require("../../../utils/commissionHelpers");
const { generateCommissionInvoice } = require("../../../services/commission/generateCommissionInvoice");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function generateCommissionInvoiceRoute(fastify) {
  fastify.post(
    "/:commissionId/invoices",
    {
      schema: {
        tags: ["Broker -> Commissions"],
        summary: "Generate a commission invoice PDF",
        params: {
          type: "object",
          required: ["commissionId"],
          properties: {
            commissionId: { type: "string", minLength: 1 },
          },
        },
        body: {
          type: "object",
          properties: {
            paymentInstructions: { type: "string" },
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
        const userId = req.user.id || req.user.userId;
        const isAdmin = roles.includes("BROKER_ADMIN");

        const prisma = fastify.prisma;
        const commissionId = String(req.params.commissionId || "").trim();

        const commission = await prisma.dealCommission.findFirst({
          where: {
            id: commissionId,
            brokerOrgId: req.user.organizationId,
            status: "CALCULATED",
          },
        });

        if (!commission) {
          return reply.code(404).send({
            success: false,
            message: "Commission record not found",
          });
        }

        if (!isAdmin && commission.recipientUserId !== userId) {
          return reply.code(403).send({
            success: false,
            message: "You can only generate invoices for your own commissions",
          });
        }

        const invoice = await generateCommissionInvoice(prisma, {
          dealCommissionId: commissionId,
          brokerOrgId: req.user.organizationId,
          generatedByUserId: userId,
          paymentInstructions: req.body?.paymentInstructions || null,
        });

        const row = await prisma.dealCommission.findUnique({
          where: { id: commissionId },
          include: {
            recipientUser: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            loanApplication: {
              select: {
                applicationNumber: true,
                fundedAt: true,
                client: { select: { legalName: true } },
              },
            },
            invoices: { orderBy: { generatedAt: "desc" }, take: 5 },
            payouts: {
              where: { status: "COMPLETED" },
              orderBy: { paidAt: "desc" },
              include: {
                paidByUser: {
                  select: { id: true, firstName: true, lastName: true, email: true },
                },
              },
            },
          },
        });

        return reply.send({
          success: true,
          message: "Commission invoice generated",
          data: {
            invoice,
            commission: formatCommissionRecord(row),
          },
        });
      } catch (error) {
        fastify.log.error({ error: error.message }, "Generate commission invoice failed");
        return reply.code(400).send({
          success: false,
          message: error.message || "Failed to generate commission invoice",
        });
      }
    },
  );
};
