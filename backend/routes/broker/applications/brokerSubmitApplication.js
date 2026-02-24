const fp = require("fastify-plugin");
const { randomUUID } = require("crypto");
const { logAudit } = require("../../../services/logger/auditLogger");

async function brokerSubmitApplication(fastify) {
  fastify.post(
    "/submit",
    {
      schema: {
        tags: ["Broker -> Applications"],
        summary: "Submit Loan Application from Broker Dashboard"
      }
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ================= AUTHORIZATION ================= */

        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only"
          });
        }

        const brokerOrgId = req.user.organizationId;

        /* ================= BODY VALIDATION ================= */

        const { applicationProductId, fields } = req.body;

        if (!applicationProductId || !Array.isArray(fields)) {
          return reply.code(400).send({
            success: false,
            message: "Invalid payload"
          });
        }

        /* ================= VALIDATE PRODUCT ================= */

        const brokerProduct =
          await prisma.brokerApplicationProduct.findFirst({
            where: {
              id: applicationProductId,
              isActive: true,
              brokerApplication: {
                isActive: true,
                brokerOrgId: brokerOrgId
              }
            },
            select: {
              id: true,
              loanProductCode: true,
              brokerApplication: {
                select: { brokerOrgId: true }
              }
            }
          });

        if (!brokerProduct) {
          return reply.code(404).send({
            success: false,
            message: "Invalid or unauthorized application product"
          });
        }

        /* ================= TRANSACTION ================= */

        const result = await prisma.$transaction(async (tx) => {
          // Required fields
          const emailField = fields.find(f => f.fieldKey === "email");
          const firstNameField = fields.find(f => f.fieldKey === "first_name");
          const lastNameField = fields.find(f => f.fieldKey === "last_name");

          if (!emailField?.value) {
            throw new Error("Email is required");
          }

          /* 1️⃣ Create Client */
          const client = await tx.client.create({
            data: {
              id: randomUUID(),
              legalName:
                `${firstNameField?.value || ""} ${lastNameField?.value || ""}`.trim() ||
                "Individual Applicant",
              entityType: "INDIVIDUAL",
              primaryBrokerOrgId: brokerOrgId
            }
          });

          /* 2️⃣ Create Client Contact */
          await tx.clientContact.create({
            data: {
              clientId: client.id,
              firstName: firstNameField?.value || "Applicant",
              lastName: lastNameField?.value || "",
              email: emailField.value,
              isPrimary: true
            }
          });

          /* 3️⃣ Create Loan Application */
          const loanApplication = await tx.loanApplication.create({
            data: {
              id: randomUUID(),
              applicationNumber: `APP-${Date.now()}`,
              brokerOrgId: brokerOrgId,
              clientId: client.id,
              loanProductCode: brokerProduct.loanProductCode,
              status: "SUBMITTED"
            }
          });

          /* 4️⃣ Create Submission */
          const submission = await tx.applicationSubmission.create({
            data: {
              applicationId: loanApplication.id,
              applicationProductId,
              status: "NEW"
            }
          });

          /* 5️⃣ Save Fields */
          const submissionFields = fields.map(f => ({
            submissionId: submission.id,
            fieldId: f.fieldId || null,
            fieldKey: f.fieldKey || null,
            value: f.value ?? null,
            source: f.fieldId ? "DYNAMIC" : "STATIC"
          }));

          if (submissionFields.length > 0) {
            await tx.applicationSubmissionField.createMany({
              data: submissionFields
            });
          }

          return { submission, loanApplication, client };
        });

        /* ================= AUDIT LOG ================= */

        await logAudit({
          prisma,
          req,
          dashboard: "BROKER",
          category: "APPLICATION",
          entityType: "LoanApplication",
          entityId: result.loanApplication.id,
          action: "SUBMIT_APPLICATION",
          newValue: {
            submissionId: result.submission.id
          }
        });

        /* ================= SUCCESS ================= */

        return reply.code(201).send({
          success: true,
          message: "Application submitted successfully",
          data: {
            submissionId: result.submission.id,
            applicationId: result.loanApplication.id
          }
        });

      } catch (error) {
        fastify.log.error({
          message: error.message,
          stack: error.stack
        });

        if (error.message === "Email is required") {
          return reply.code(400).send({
            success: false,
            message: error.message
          });
        }

        return reply.code(500).send({
          success: false,
          message: "Internal server error while submitting application"
        });
      }
    }
  );
}

module.exports = fp(brokerSubmitApplication);