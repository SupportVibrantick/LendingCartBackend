// broker/applications/assignLoanOfficer.js

const fp = require("fastify-plugin");
const { logAudit } = require("../../../services/logger/auditLogger");

async function assignLoanOfficer(fastify) {
  fastify.patch(
    "/:id/assign",
    {
      schema: {
        tags: ["Broker -> Applications"],
        summary: "Assign Loan Officer to Application"
      }
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ================= AUTH ================= */

        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only"
          });
        }

        if (!req.user.roles?.includes("BROKER_ADMIN")) {
          return reply.code(403).send({
            success: false,
            message: "Only Broker Admin can assign loan officer"
          });
        }

        const brokerOrgId = req.user.organizationId;
        const applicationId = req.params.id;
        const { loanOfficerId } = req.body;

        if (!loanOfficerId) {
          return reply.code(400).send({
            success: false,
            message: "loanOfficerId is required"
          });
        }

        /* ================= VALIDATE APPLICATION ================= */

        const application = await prisma.loanApplication.findFirst({
          where: {
            id: applicationId,
            brokerOrgId: brokerOrgId
          }
        });

        if (!application) {
          return reply.code(404).send({
            success: false,
            message: "Application not found"
          });
        }

        /* ================= VALIDATE LOAN OFFICER ================= */

        const officer = await prisma.userAccount.findFirst({
          where: {
            id: loanOfficerId,
            organizationId: brokerOrgId,
            roles: {
              some: {
                role: {
                  name: "BROKER_OFFICER"
                }
              }
            }
          }
        });

        if (!officer) {
          return reply.code(400).send({
            success: false,
            message: "Invalid loan officer"
          });
        }

        /* ================= UPDATE ================= */

        const updatedApplication = await prisma.loanApplication.update({
          where: { id: applicationId },
          data: {
            brokerUserId: loanOfficerId
          }
        });

        /* ================= AUDIT LOG ================= */

        await logAudit({
          prisma,
          req,
          dashboard: "BROKER",
          category: "APPLICATION",
          entityType: "LoanApplication",
          entityId: applicationId,
          action: "ASSIGN_LOAN_OFFICER",
          newValue: {
            loanOfficerId
          }
        });

        /* ================= SUCCESS ================= */

        return reply.code(200).send({
          success: true,
          message: "Loan officer assigned successfully",
          data: {
            applicationId: updatedApplication.id,
            loanOfficerId: updatedApplication.brokerUserId
          }
        });

      } catch (error) {
        fastify.log.error({
          error: error.message,
          stack: error.stack
        });

        return reply.code(500).send({
          success: false,
          message: "Internal server error"
        });
      }
    }
  );
}

module.exports = fp(assignLoanOfficer);