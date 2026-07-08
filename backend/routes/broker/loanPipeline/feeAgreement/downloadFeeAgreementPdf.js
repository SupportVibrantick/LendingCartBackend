const {
  buildFeeAgreementPdfFilename,
  generateFeeAgreementPdfBuffer,
} = require("../../../../services/feeAgreement/feeAgreementPdfExport");

module.exports = async function downloadFeeAgreementPdf(fastify) {
  fastify.get(
    "/:loanId/fee-agreement/download-pdf",
    {
      schema: {
        tags: ["Loan Pipeline → Fee Agreement"],
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
        if (!req.user) {
          return reply.code(401).send({
            ok: false,
            message: "Unauthorized",
          });
        }

        const prisma = fastify.prisma;
        const { loanId } = req.params;

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

        fastify.log.error(error, "Fee agreement PDF download failed");

        return reply.code(500).send({
          ok: false,
          message: "Failed to generate PDF",
        });
      }
    },
  );
};
