/**
 * @param {import("fastify").FastifyInstance} fastify
 */

const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const libre = require("libreoffice-convert");
const util = require("util");

const convertAsync = util.promisify(libre.convert);
const { loadDocxTemplate } = require("../../../utils/loadDocxTemplate");

async function generateLoiRoute(fastify) {

  fastify.post(
    "/:applicationLenderId/generate-loi",
    {
      schema: {
        tags: ["Lender -> Loan Pipeline"],
        summary: "Generate LOI document",
        params: {
          type: "object",
          required: ["applicationLenderId"],
          properties: {
            applicationLenderId: { type: "string" }
          }
        }
      }
    },

    async (req, reply) => {

      const prisma = fastify.prisma;

      try {

        // =========================
        // AUTH CHECK
        // =========================

        if (
          !req.user ||
          req.user.orgType !== "LENDER" ||
          !req.user.organizationId
        ) {
          return reply.code(403).send({
            success: false,
            message: "Lender access only"
          });
        }

        const lenderOrgId = req.user.organizationId;
        const { applicationLenderId } = req.params;

        // =========================
        // FETCH APPLICATION
        // =========================

        const lenderRecord = await prisma.applicationLender.findFirst({
          where: {
            id: applicationLenderId,
            lenderOrgId
          },
          include: {
            loanApplication: {
              include: {
                submissions: {
                  include: { fields: true },
                  orderBy: { createdAt: "desc" },
                  take: 1
                }
              }
            },
            lender: true,
            lenderReviews: {
              orderBy: { createdAt: "desc" },
              take: 1
            }
          }
        });

        if (!lenderRecord) {
          return reply.code(404).send({
            success: false,
            message: "Application not found"
          });
        }

        const submission = lenderRecord.loanApplication.submissions?.[0];

        if (!submission) {
          return reply.code(400).send({
            success: false,
            message: "Submission not found"
          });
        }

        // =========================
        // MAP FORM FIELDS
        // =========================

        const fieldMap = {};

        for (const field of submission.fields || []) {

          if (!field?.fieldKey) continue;

          fieldMap[field.fieldKey] =
            typeof field.value === "object"
              ? JSON.stringify(field.value)
              : String(field.value ?? "");
        }

        // =========================
        // LOAD DOCX TEMPLATE
        // =========================

        let templateBuffer;

        try {
          templateBuffer = loadDocxTemplate("lender/loi/loi-template");
        } catch (err) {

          fastify.log.error(err);

          return reply.code(500).send({
            success: false,
            message: "LOI template not found"
          });
        }

        // =========================
        // INIT DOCXTEMPLATER
        // =========================

        const zip = new PizZip(templateBuffer);

        const doc = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true
        });

        const review = lenderRecord.lenderReviews?.[0];

        // =========================
        // TEMPLATE VARIABLES
        // =========================

        doc.setData({

          ...fieldMap,

          applicationId: lenderRecord.loanApplication.id,
          applicationNumber: lenderRecord.loanApplication.applicationNumber,

          lenderName: lenderRecord.lender?.name || "",
          status: lenderRecord.status,

          approvedAmount: review?.approvedAmount || "",
          interestRate: review?.interestRate || "",
          notes: review?.notes || "",

          date: new Date().toLocaleDateString()

        });

        // =========================
        // RENDER DOCUMENT
        // =========================

        try {
          doc.render();
        } catch (err) {

          fastify.log.error(err);

          return reply.code(500).send({
            success: false,
            message: "Template rendering failed"
          });
        }

        // =========================
        // GENERATE DOCX BUFFER
        // =========================

        const docxBuffer = doc.getZip().generate({
          type: "nodebuffer",
          compression: "DEFLATE"
        });

        // =========================
        // CONVERT DOCX -> PDF
        // =========================

        let pdfBuffer;

        try {
          pdfBuffer = await convertAsync(docxBuffer, ".pdf", undefined);
        } catch (err) {

          fastify.log.error(err);

          return reply.code(500).send({
            success: false,
            message: "PDF conversion failed"
          });
        }

        // =========================
        // SAVE PDF FILE
        // =========================

        const outputDir = path.join(
          process.cwd(),
          "public",
          "lender",
          "LOI"
        );

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const fileName = `loi-${applicationLenderId}-${Date.now()}.pdf`;

        const filePath = path.join(outputDir, fileName);

        fs.writeFileSync(filePath, pdfBuffer);

        const fileUrl = `/lender/LOI/${fileName}`;

        // =========================
        // SAVE URL IN DB
        // =========================

        await prisma.applicationLender.update({
          where: { id: applicationLenderId },
          data: { loiUrl: fileUrl }
        });

        // =========================
        // RESPONSE
        // =========================

        return reply.send({
          success: true,
          message: "LOI generated successfully",
          loiUrl: fileUrl
        });

      } catch (error) {

        fastify.log.error(error);

        return reply.code(500).send({
          success: false,
          message: "Unexpected server error"
        });

      }

    }
  );
}

module.exports = generateLoiRoute;