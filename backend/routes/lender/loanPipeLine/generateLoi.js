/**
 * @param {import("fastify").FastifyInstance} fastify
 */

const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const { convertDocxToPdf } = require("../../../utils/pdf/convertDocxToPdf");
const { generateLoiPdf } = require("../../../services/loi/generateLoiPdf");
const { buildLoiTemplateData } = require("../../../services/loi/buildLoiTemplateData");
const { logAudit } = require("../../../services/logger/auditLogger");
const {
  resolveLatestActiveSubmission,
} = require("../../../utils/applications/clientPortalSubmission");

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
            applicationLenderId: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["lenderTerms"],
          properties: {
            lenderTerms: {
              type: "object",
              required: [
                "approvedAmount",
                "interestRateType",
                "loanTerm",
                "amortization",
                "paymentFrequency",
                "originationFeePercent",
                "expirationDate",
                "closingConditions",
              ],
              properties: {
                approvedAmount: { type: "number", exclusiveMinimum: 0 },
                interestRateType: {
                  type: "string",
                  enum: ["FIXED", "VARIABLE"],
                },
                interestRate: { type: ["number", "null"] },
                interestRateDisplay: { type: "string" },
                variableRateIndex: { type: ["string", "null"] },
                variableRateSpread: { type: ["number", "null"] },
                loanTerm: { type: "string", minLength: 1 },
                amortization: { type: "string", minLength: 1 },
                paymentFrequency: { type: "string", minLength: 1 },
                originationFeePercent: { type: "string", minLength: 1 },
                exitFee: { type: "string" },
                processingFee: { type: "string" },
                underwritingFee: { type: "string" },
                legalFee: { type: "string" },
                appraisalRequired: { type: "string" },
                environmentalReport: { type: "string" },
                personalGuarantee: { type: "string" },
                prepaymentPenalty: { type: "string" },
                recourse: { type: "string" },
                closingConditions: {
                  type: "array",
                  minItems: 1,
                  items: { type: "string" },
                },
                specialConditions: {
                  type: "array",
                  items: { type: "string" },
                },
                expirationDate: { type: "string", minLength: 1 },
              },
            },
          },
        },
      },
    },

    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ===============================
           AUTHORIZATION
        =============================== */
        if (
          !req.user ||
          req.user.orgType !== "LENDER" ||
          !req.user.organizationId
        ) {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const { applicationLenderId } = req.params;
        const lenderTerms = req.body?.lenderTerms;

        if (!applicationLenderId) {
          return reply.code(400).send({
            success: false,
            message: "ApplicationLenderId is required",
          });
        }

        if (!lenderTerms || typeof lenderTerms !== "object") {
          return reply.code(400).send({
            success: false,
            message: "Lender underwriting terms are required",
          });
        }

        if (
          !Number.isFinite(Number(lenderTerms.approvedAmount)) ||
          Number(lenderTerms.approvedAmount) <= 0
        ) {
          return reply.code(400).send({
            success: false,
            message: "Approved amount is required",
          });
        }

        if (
          !Array.isArray(lenderTerms.closingConditions) ||
          lenderTerms.closingConditions.length === 0
        ) {
          return reply.code(400).send({
            success: false,
            message: "At least one closing condition is required",
          });
        }

        /* ===============================
           FETCH APPLICATION
        =============================== */
        const lenderRecord = await prisma.applicationLender.findFirst({
          where: {
            id: applicationLenderId,
            lenderOrgId,
          },
          include: {
            loanApplication: {
              include: {
                client: {
                  include: {
                    contacts: {
                      where: { isPrimary: true },
                      take: 1,
                    },
                  },
                },
                brokerOrg: true,
                brokerUser: {
                  include: {
                    brokerProfile: true,
                  },
                },
                collaterals: true,
                submissions: {
                  where: { status: { not: "SUPERSEDED" } },
                  include: {
                    fields: {
                      include: {
                        builderField: true,
                      },
                    },
                  },
                  orderBy: { createdAt: "desc" },
                },
              },
            },
            lender: true,
            lenderProduct: true,
            lenderReviews: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: {
                conditions: true,
              },
            },
          },
        });

        if (!lenderRecord) {
          return reply.code(404).send({
            success: false,
            message: "Application not found",
          });
        }

        if (lenderRecord.loiUrl) {
          return reply.code(400).send({
            success: false,
            message: "LOI already generated",
            status: "ALREADY_GENERATED",
            loiUrl: lenderRecord.loiUrl,
          });
        }

        const submission = resolveLatestActiveSubmission(
          lenderRecord.loanApplication?.submissions || [],
        );

        if (!submission) {
          return reply.code(400).send({
            success: false,
            message: "Submission not found",
          });
        }

        /* ===============================
           MAP FORM FIELDS + TEMPLATE DATA
        =============================== */
        const loiData = buildLoiTemplateData({
          submission,
          loanApplication: lenderRecord.loanApplication,
          lenderRecord,
          applicationLenderId,
          collaterals: lenderRecord.loanApplication?.collaterals || [],
          lenderTerms,
        });

        /* ===============================
           GENERATE PDF
           Default: styled term sheet template.
           Custom lender DOCX only when uploaded.
        =============================== */
        let pdfBuffer;
        let generatedVia = "styled-term-sheet";

        const lenderTemplate = await prisma.lenderLoiTemplate.findUnique({
          where: { lenderOrgId },
        });

        const customTemplatePath = lenderTemplate?.fileUrl
          ? path.join(
              process.cwd(),
              "public",
              lenderTemplate.fileUrl.replace(/^\/+/, ""),
            )
          : null;

        const hasCustomTemplate =
          customTemplatePath && fs.existsSync(customTemplatePath);

        if (hasCustomTemplate) {
          try {
            const templateBuffer = fs.readFileSync(customTemplatePath);
            const zip = new PizZip(templateBuffer);
            const doc = new Docxtemplater(zip, {
              paragraphLoop: true,
              linebreaks: true,
              nullGetter: () => "—",
            });

            doc.setData(loiData);
            doc.render();

            const docxBuffer = doc.getZip().generate({
              type: "nodebuffer",
              compression: "DEFLATE",
            });

            pdfBuffer = await convertDocxToPdf(docxBuffer);
            generatedVia = "custom-docx-template";
          } catch (err) {
            fastify.log.warn(
              { error: err.message, code: err.code },
              "Custom LOI template failed, using styled term sheet",
            );
          }
        }

        if (!pdfBuffer) {
          try {
            pdfBuffer = await generateLoiPdf(loiData);
          } catch (pdfErr) {
            fastify.log.error("Styled LOI PDF error:", pdfErr);

            return reply.code(500).send({
              success: false,
              message: "Failed to generate LOI PDF",
            });
          }
        }

        /* ===============================
           SAVE FILE
        =============================== */
        const outputDir = path.join(
          process.cwd(),
          "public",
          "lender",
          "LOI"
        );

        try {
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
        } catch (err) {
          fastify.log.error("Directory creation error:", err);

          return reply.code(500).send({
            success: false,
            message: "Failed creating LOI directory",
          });
        }

        const fileName = `loi-${applicationLenderId}-${Date.now()}.pdf`;
        const filePath = path.join(outputDir, fileName);

        try {
          fs.writeFileSync(filePath, pdfBuffer);
        } catch (err) {
          fastify.log.error("File save error:", err);

          return reply.code(500).send({
            success: false,
            message: "Failed saving LOI file",
          });
        }

        const fileUrl = `/lender/LOI/${fileName}`;
        const brokerOrgId = lenderRecord.loanApplication.brokerOrgId;

        /* ===============================
           DB TRANSACTION
        =============================== */
        const [, notification] = await prisma.$transaction([
          prisma.applicationLender.update({
            where: { id: applicationLenderId },
            data: { loiUrl: fileUrl },
          }),

          prisma.notification.create({
            data: {
              eventType: "LOI_GENERATED",
              category: "LOI",
              channel: "IN_APP",
              status: "QUEUED",
              recipientType: "BROKER",
              recipientOrgId: brokerOrgId,
              subject: "New LOI Received",
              body: `LOI generated by ${lenderRecord.lender?.name || "Lender"} for application ${lenderRecord.loanApplication.applicationNumber}`,
              metadata: {
                applicationId:
                  lenderRecord.loanApplication.id,
                applicationNumber:
                  lenderRecord.loanApplication.applicationNumber,
                applicationLenderId: lenderRecord.id,
                lenderName:
                  lenderRecord.lender?.name || "Lender",
                loiPath: fileUrl,
              },
              sentAt: new Date(),
            },
          }),
        ]);

        /* ===============================
           AUDIT LOG
        =============================== */
        await logAudit({
          prisma,
          req,
          dashboard: "LENDER",
          category: "LOI",
          entityType: "ApplicationLender",
          entityId: applicationLenderId,
          action: "GENERATE_LOI",
          newValue: { loiUrl: fileUrl, generatedVia },
        });

        /* ===============================
           SOCKET
        =============================== */
        try {
          const { emitBrokerNotification } = require("../../../services/notifications/notificationRealtime");
          emitBrokerNotification(fastify.io, brokerOrgId, notification);
        } catch (e) {
          fastify.log.warn("Socket emit failed:", e);
        }

        /* ===============================
           RESPONSE
        =============================== */
        return reply.send({
          success: true,
          message: "LOI generated successfully",
          loiUrl: fileUrl,
        });

      } catch (error) {
        fastify.log.error("Unhandled error:", error);

        return reply.code(500).send({
          success: false,
          message: error.message,
        });
      }
    }
  );
}

module.exports = generateLoiRoute;