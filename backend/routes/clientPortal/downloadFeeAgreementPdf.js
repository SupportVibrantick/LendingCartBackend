const jwt = require("jsonwebtoken");
const {
  buildFeeAgreementPdfFilename,
  generateFeeAgreementPdfBuffer,
} = require("../../services/feeAgreementPdfExport");

module.exports = async function downloadClientFeeAgreementPdf(fastify) {
  fastify.get(
    "/applications/:id/fee-agreement/download-pdf",
    {
      schema: {
        tags: ["Client → Fee Agreement"],
        summary: "Download signed fee agreement PDF",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return reply.code(401).send({
            ok: false,
            message: "Unauthorized",
          });
        }

        const token = authHeader.split(" ")[1];

        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
          return reply.code(401).send({
            ok: false,
            message: "Invalid token",
          });
        }

        if (!decoded.clientId || decoded.role !== "CLIENT") {
          return reply.code(403).send({
            ok: false,
            message: "Client access only",
          });
        }

        const { id: applicationId } = req.params;

        const loanApplication = await prisma.loanApplication.findFirst({
          where: {
            id: applicationId,
            clientId: decoded.clientId,
          },
        });

        if (!loanApplication) {
          return reply.code(404).send({
            ok: false,
            message: "Application not found",
          });
        }

        const agreement = await prisma.feeAgreement.findUnique({
          where: { loanApplicationId: applicationId },
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

        fastify.log.error(error, "Client fee agreement PDF download failed");

        return reply.code(500).send({
          ok: false,
          message: "Failed to generate PDF",
        });
      }
    },
  );
};
