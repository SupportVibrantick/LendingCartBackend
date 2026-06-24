const {
  buildFeeAgreementPdfFilename,
  generateFeeAgreementPdfBuffer,
} = require("../../../services/feeAgreementPdfExport");

module.exports = async function downloadSubBrokerFeeAgreementPdf(fastify) {
  fastify.get(
    "/:loanId/fee-agreement/download-pdf",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],
      schema: {
        tags: ["Sub Broker → Fee Agreement"],
        summary: "Download signed fee agreement PDF",
        params: {
          type: "object",
          required: ["loanId"],
          properties: {
            loanId: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const prisma = fastify.prisma;
        const { loanId } = req.params;
        const userId = req.user.userId;

        const assignment = await prisma.subBrokerApplication.findFirst({
          where: {
            loanApplicationId: loanId,
            subBrokerId: userId,
          },
          select: { id: true },
        });

        if (!assignment) {
          return reply.code(403).send({
            ok: false,
            message: "Access denied",
          });
        }

        const agreement = await prisma.feeAgreement.findUnique({
          where: { loanApplicationId: loanId },
        });

        if (!agreement) {
          return reply.code(404).send({
            ok: false,
            message: "Fee agreement not found",
          });
        }

        const apiBase =
          process.env.API_PUBLIC_URL ||
          process.env.API_BASE_URL ||
          `${req.protocol}://${req.hostname}${req.socket?.localPort ? `:${req.socket.localPort}` : ""}`;

        const pdfBuffer = await generateFeeAgreementPdfBuffer(agreement, {
          apiBase,
        });

        const filename = buildFeeAgreementPdfFilename(agreement);

        return reply
          .header("Content-Type", "application/pdf")
          .header("Content-Disposition", `attachment; filename="${filename}"`)
          .send(pdfBuffer);
      } catch (error) {
        if (error.code === "NOT_SIGNED") {
          return reply.code(400).send({
            ok: false,
            message: error.message,
          });
        }

        if (error.code === "MISSING_HTML") {
          return reply.code(409).send({
            ok: false,
            message: error.message,
          });
        }

        if (error.code === "LIBREOFFICE_MISSING") {
          return reply.code(503).send({
            ok: false,
            message: "Server PDF converter unavailable",
            code: "LIBREOFFICE_MISSING",
          });
        }

        fastify.log.error(error, "Sub-broker fee agreement PDF download failed");

        return reply.code(500).send({
          ok: false,
          message: "Failed to generate PDF",
        });
      }
    },
  );
};
