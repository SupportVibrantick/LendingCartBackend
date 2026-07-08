const { formatCommissionRecord } = require("../../../utils/commission/commissionHelpers");
const { commissionInclude } = require("../../../utils/commission/commissionQueryHelpers");
const {
  recordCommissionPayout,
  ALLOWED_PAYMENT_METHODS,
} = require("../../../services/commission/recordCommissionPayout");

async function handleRecordPayout(req, reply, fastify) {
  if (!req.user?.organizationId) {
    return reply.code(403).send({ success: false, message: "Broker access only" });
  }

  const roles = req.user.roles || [];
  if (!roles.includes("BROKER_ADMIN")) {
    return reply.code(403).send({
      success: false,
      message: "Only broker admins can record commission payouts",
    });
  }

  const prisma = fastify.prisma;
  const commissionId = String(req.params.commissionId || "").trim();
  const userId = req.user.id || req.user.userId;

  const payout = await recordCommissionPayout(prisma, {
    dealCommissionId: commissionId,
    brokerOrgId: req.user.organizationId,
    paidByUserId: userId,
    paymentMethod: req.body?.paymentMethod || "MANUAL",
    paymentReference: req.body?.paymentReference || null,
    notes: req.body?.notes || null,
    commissionInvoiceId: req.body?.commissionInvoiceId || null,
    amount: req.body?.amount ?? null,
  });

  const row = await prisma.dealCommission.findUnique({
    where: { id: commissionId },
    include: commissionInclude,
  });

  return reply.send({
    success: true,
    message: "Commission payout recorded",
    data: {
      payout,
      commission: formatCommissionRecord(row),
    },
  });
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function recordPayoutRoute(fastify) {
  fastify.post(
    "/:commissionId/payouts",
    {
      schema: {
        tags: ["Broker -> Commissions"],
        summary: "Record a manual commission payout",
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
            paymentMethod: {
              type: "string",
              enum: [...ALLOWED_PAYMENT_METHODS],
            },
            paymentReference: { type: "string" },
            notes: { type: "string" },
            commissionInvoiceId: { type: "string" },
            amount: { type: "number" },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        return await handleRecordPayout(req, reply, fastify);
      } catch (error) {
        fastify.log.error({ error: error.message }, "Record commission payout failed");
        return reply.code(400).send({
          success: false,
          message: error.message || "Failed to record commission payout",
        });
      }
    },
  );

  fastify.post(
    "/:commissionId/mark-paid",
    {
      schema: {
        tags: ["Broker -> Commissions"],
        summary: "Legacy alias for recording a manual commission payout",
        body: {
          type: "object",
          properties: {
            notes: { type: "string" },
            paymentMethod: { type: "string" },
            paymentReference: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        req.body = {
          ...(req.body || {}),
          paymentMethod: req.body?.paymentMethod || "MANUAL",
          notes: req.body?.notes || null,
        };
        return await handleRecordPayout(req, reply, fastify);
      } catch (error) {
        fastify.log.error({ error: error.message }, "Mark commission paid failed");
        return reply.code(400).send({
          success: false,
          message: error.message || "Failed to mark commission as paid",
        });
      }
    },
  );
};
