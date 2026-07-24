/**
 * @param {import("fastify").FastifyInstance} fastify
 */

const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const { convertDocxToPdf } = require("../../../utils/pdf/convertDocxToPdf");
const { generateLoiPdf } = require("../../../services/loi/generateLoiPdf");
const {
  buildLoiTemplateData,
  normalizeLenderTerms,
} = require("../../../services/loi/buildLoiTemplateData");
const {
  resolveLenderLoiBranding,
} = require("../../../services/loi/resolveLoiBranding");
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
                "interestRate",
                "loanTerm",
                "monthlyPayment",
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
                amortization: { type: "string" },
                paymentFrequency: { type: "string" },
                interestOnly: { type: "boolean" },
                ltvPercent: { type: ["number", "null"] },
                ltcPercent: { type: ["number", "null"] },
                arvPercent: { type: ["number", "null"] },
                monthlyPayment: { type: ["number", "null"] },
                originationFeePercent: { type: "string" },
                exitFee: { type: "string" },
                processingFee: { type: "string" },
                underwritingFee: { type: "string" },
                legalFee: { type: "string" },
                appraisalRequired: { type: "string" },
                environmentalReport: { type: "string" },
                personalGuarantee: { type: "string" },
                prepaymentPenalty: { type: "string" },
                recourse: { type: "string" },
                requiredDocuments: {
                  type: "array",
                  minItems: 1,
                  items: { type: "string" },
                },
                closingConditions: {
                  type: "array",
                  items: { type: "string" },
                },
                specialConditions: {
                  type: "array",
                  items: { type: "string" },
                },
                expirationDate: { type: "string" },
              },
            },
            branding: {
              type: "object",
              properties: {
                brandName: { type: "string" },
                logoUrl: { type: "string" },
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
          !Number.isFinite(Number(lenderTerms.interestRate)) ||
          Number(lenderTerms.interestRate) <= 0
        ) {
          return reply.code(400).send({
            success: false,
            message: "Interest rate is required",
          });
        }

        if (!String(lenderTerms.loanTerm || "").trim()) {
          return reply.code(400).send({
            success: false,
            message: "Loan term is required",
          });
        }

        if (
          !Number.isFinite(Number(lenderTerms.monthlyPayment)) ||
          Number(lenderTerms.monthlyPayment) <= 0
        ) {
          return reply.code(400).send({
            success: false,
            message: "Monthly payment is required",
          });
        }

        const requiredDocuments = Array.isArray(lenderTerms.requiredDocuments)
          ? lenderTerms.requiredDocuments
              .map((item) => String(item || "").trim())
              .filter(Boolean)
          : Array.isArray(lenderTerms.closingConditions)
            ? lenderTerms.closingConditions
                .map((item) => String(item || "").trim())
                .filter(Boolean)
            : [];

        if (requiredDocuments.length === 0) {
          return reply.code(400).send({
            success: false,
            message: "At least one required document is needed",
          });
        }

        lenderTerms.requiredDocuments = requiredDocuments;
        lenderTerms.closingConditions = requiredDocuments;

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
            lender: {
              include: {
                lenderProfile: true,
              },
            },
            lenderProduct: {
              include: {
                loanProduct: {
                  select: {
                    code: true,
                    name: true,
                  },
                },
              },
            },
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
        let lenderBranding;
        try {
          lenderBranding = await resolveLenderLoiBranding(
            prisma,
            lenderOrgId,
            req.body?.branding,
            lenderRecord.lender?.name,
          );
        } catch (brandingError) {
          return reply.code(400).send({
            success: false,
            message:
              brandingError.message ||
              "Brand name and logo are required for LOI generation",
          });
        }

        const loiData = buildLoiTemplateData({
          submission,
          loanApplication: lenderRecord.loanApplication,
          lenderRecord,
          applicationLenderId,
          collaterals: lenderRecord.loanApplication?.collaterals || [],
          lenderTerms,
          lenderBranding,
        });

        const persistedLoiTerms = normalizeLenderTerms(lenderTerms);

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
        const loanApplicationId = lenderRecord.loanApplication.id;

        /* ===============================
           DB TRANSACTION
        =============================== */
        await prisma.applicationLender.update({
          where: { id: applicationLenderId },
          data: {
            loiUrl: fileUrl,
            loiTermsJson: persistedLoiTerms || lenderTerms,
            lastUpdatedAt: new Date(),
          },
        });

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
           RESPONSE
        =============================== */
        return reply.send({
          success: true,
          message:
            "LOI generated successfully. Review the term sheet, then send it to the broker when ready.",
          loiUrl: fileUrl,
          loiSentToBrokerAt: null,
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