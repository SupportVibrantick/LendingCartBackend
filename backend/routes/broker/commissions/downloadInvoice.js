const fs = require("fs");
const { logCommissionAuditEvent } = require("../../../services/commission/auditCommissionEvent");
const { ensureCommissionInvoicePdf } = require("../../../services/commission/generateCommissionInvoice");
/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function downloadCommissionInvoiceRoute(fastify) {
  fastify.get(
    "/invoices/:invoiceId/pdf",
    {
      schema: {
        tags: ["Broker -> Commissions"],
        summary: "Download commission invoice PDF",
        params: {
          type: "object",
          required: ["invoiceId"],
          properties: {
            invoiceId: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        if (!req.user?.organizationId) {
          return reply.code(403).send({ success: false, message: "Broker access only" });
        }

        const prisma = fastify.prisma;
        const invoiceId = String(req.params.invoiceId || "").trim();
        const userId = req.user.id || req.user.userId;
        const roles = req.user.roles || [];
        const isAdmin = roles.includes("BROKER_ADMIN");

        const invoice = await prisma.commissionInvoice.findFirst({
          where: {
            id: invoiceId,
            brokerOrgId: req.user.organizationId,
          },
          include: {
            dealCommission: {
              select: {
                id: true,
                recipientUserId: true,
                loanApplicationId: true,
              },
            },
          },
        });

        if (!invoice) {
          return reply.code(404).send({
            success: false,
            message: "Invoice not found",
          });
        }

        if (
          !isAdmin &&
          invoice.dealCommission?.recipientUserId !== userId
        ) {
          return reply.code(403).send({
            success: false,
            message: "You do not have access to this invoice",
          });
        }

        let filePath;
        try {
          ({ filePath } = await ensureCommissionInvoicePdf(prisma, invoice));
        } catch (pdfError) {
          fastify.log.error(
            { error: pdfError.message, invoiceId },
            "Ensure commission invoice PDF failed",
          );
          return reply.code(404).send({
            success: false,
            message: pdfError.message || "Invoice PDF is not available",
          });
        }

        if (!filePath || !fs.existsSync(filePath)) {
          return reply.code(404).send({
            success: false,
            message: "Invoice PDF file not found",
          });
        }

        await prisma.commissionInvoice.update({
          where: { id: invoice.id },
          data: {
            downloadedAt: new Date(),
            status: invoice.status === "GENERATED" ? "VIEWED" : invoice.status,
            viewedAt: invoice.viewedAt || new Date(),
          },
        });

        await logCommissionAuditEvent(prisma, {
          brokerOrgId: invoice.brokerOrgId,
          loanApplicationId: invoice.loanApplicationId,
          dealCommissionId: invoice.dealCommissionId,
          commissionInvoiceId: invoice.id,
          eventType: "INVOICE_DOWNLOADED",
          actorUserId: userId,
          metadata: {
            invoiceNumber: invoice.invoiceNumber,
          },
        });

        const fileName = `${invoice.invoiceNumber}.pdf`;
        return reply
          .header("Content-Type", "application/pdf")
          .header("Content-Disposition", `attachment; filename="${fileName}"`)
          .send(fs.createReadStream(filePath));
      } catch (error) {
        fastify.log.error({ error: error.message }, "Download commission invoice failed");
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to download invoice",
        });
      }
    },
  );
};
