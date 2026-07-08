const { adminLogs } = require("../../../../services/logger/contextLogger");
const { markInvoicePaidSchema } = require("../../../../schemas/admin/subscriptions/assign.schema");
const { markInvoicePaid } = require("../../../../services/subscription/subscriptionBilling");

async function markPaidRoutes(fastify) {
  fastify.patch(
    "/",
    {
      schema: {
        tags: ["Admin -> Subscriptions"],
        summary: "Mark subscription invoice as paid",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      try {
        const parsed = markInvoicePaidSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        const invoice = await markInvoicePaid(prisma, parsed.data.id);

        adminLogs.info("Subscription invoice marked paid", { invoiceId: invoice.id });

        return reply.send({
          success: true,
          message: "Invoice marked as paid",
          data: invoice,
        });
      } catch (error) {
        if (error.statusCode) {
          return reply.status(error.statusCode).send({
            success: false,
            message: error.message,
          });
        }
        adminLogs.error("Mark invoice paid failed", error);
        return reply.status(500).send({
          success: false,
          message: "Failed to mark invoice as paid",
        });
      }
    },
  );
}

module.exports = markPaidRoutes;
