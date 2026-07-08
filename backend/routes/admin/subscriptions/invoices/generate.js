const { adminLogs } = require("../../../../services/logger/contextLogger");
const { generateInvoiceSchema } = require("../../../../schemas/admin/subscriptions/assign.schema");
const { generateInvoice } = require("../../../../services/subscription/subscriptionBilling");

async function generateInvoiceRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Admin -> Subscriptions"],
        summary: "Generate subscription invoice",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      try {
        const parsed = generateInvoiceSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        const invoice = await generateInvoice(prisma, parsed.data.organizationSubscriptionId, {
          notes: parsed.data.notes,
        });

        adminLogs.info("Subscription invoice generated", {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
        });

        return reply.status(201).send({
          success: true,
          message: "Invoice generated successfully",
          data: invoice,
        });
      } catch (error) {
        if (error.statusCode) {
          return reply.status(error.statusCode).send({
            success: false,
            message: error.message,
          });
        }
        adminLogs.error("Generate invoice failed", error);
        return reply.status(500).send({
          success: false,
          message: "Failed to generate invoice",
        });
      }
    },
  );
}

module.exports = generateInvoiceRoutes;
