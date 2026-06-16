/**
 * @param {import("fastify").FastifyInstance} fastify
 */

const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const { loadDocxTemplate } = require("../../../utils/loadDocxTemplate");
const { convertDocxToPdf } = require("../../../utils/convertDocxToPdf");
const { generateLoiPdf } = require("../../../services/generateLoiPdf");
const { buildLoiTemplateData } = require("../../../services/buildLoiTemplateData");
const { logAudit } = require("../../../services/logger/auditLogger");

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

        if (!applicationLenderId) {
          return reply.code(400).send({
            success: false,
            message: "ApplicationLenderId is required",
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
                submissions: {
                  include: {
                    fields: {
                      include: {
                        builderField: true,
                      },
                    },
                  },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
              },
            },
            lender: true,
            lenderReviews: {
              orderBy: { createdAt: "desc" },
              take: 1,
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

        const submission = lenderRecord.loanApplication?.submissions?.[0];

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
        });

        /* ===============================
           LOAD TEMPLATE (DYNAMIC + FALLBACK)
        =============================== */
        let templateBuffer;

        try {
          const lenderTemplate = await prisma.lenderLoiTemplate.findUnique({
            where: { lenderOrgId },
          });

          if (lenderTemplate?.fileUrl) {
            const fullPath = path.join(
              process.cwd(),
              "public",
              lenderTemplate.fileUrl.replace(/^\/+/, "")
            );

            if (!fs.existsSync(fullPath)) {
              fastify.log.warn(
                `Template missing on disk, fallback used: ${fullPath}`
              );
              templateBuffer = loadDocxTemplate(
                "lender/loi/loi-template"
              );
            } else {
              templateBuffer = fs.readFileSync(fullPath);
            }
          } else {
            templateBuffer = loadDocxTemplate(
              "lender/loi/loi-template"
            );
          }
        } catch (err) {
          fastify.log.error("Template load error:", err);

          return reply.code(500).send({
            success: false,
            message: "Failed to load LOI template",
          });
        }

        /* ===============================
           GENERATE DOCX
        =============================== */
        let docxBuffer;

        try {
          const zip = new PizZip(templateBuffer);

          const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            nullGetter: () => "—",
          });

          doc.setData(loiData);

          doc.render();

          docxBuffer = doc.getZip().generate({
            type: "nodebuffer",
            compression: "DEFLATE",
          });
        } catch (err) {
          fastify.log.error("Docx render error:", err);

          return reply.code(500).send({
            success: false,
            message: "Template rendering failed. Check placeholders.",
          });
        }

        /* ===============================
           CONVERT TO PDF
        =============================== */
        const review = lenderRecord.lenderReviews?.[0];
        const loiDate = loiData.date;
        let pdfBuffer;
        let generatedVia = "docx-template";

        try {
          pdfBuffer = await convertDocxToPdf(docxBuffer);
        } catch (err) {
          fastify.log.warn(
            { error: err.message, code: err.code },
            "LibreOffice conversion unavailable, using PDFKit fallback",
          );

          try {
            pdfBuffer = await generateLoiPdf({
              applicationNumber: loiData.applicationNumber,
              lenderName: loiData.lenderName,
              approvedAmount: review?.approvedAmount || "",
              interestRate: review?.interestRate || "",
              notes: loiData.notes,
              date: loiDate,
              fieldMap: loiData,
            });
            generatedVia = "pdfkit-fallback";
          } catch (fallbackErr) {
            fastify.log.error("PDF fallback error:", fallbackErr);

            return reply.code(500).send({
              success: false,
              message:
                err.code === "LIBREOFFICE_MISSING"
                  ? "PDF conversion failed. Install LibreOffice or retry after server restart."
                  : "PDF conversion failed",
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
          const { emitBrokerNotification } = require("../../../services/notificationRealtime");
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