/**
 * @param {import("fastify").FastifyInstance} fastify
 */

const {
  countBrokerPipelineStats,
} = require("../../../utils/applications/resolveApplicationStatus");

module.exports = async function loanPipelineStatsApi(fastify) {
  fastify.get(
    "/pipeline-stats",
    {
      preHandler: fastify.authenticate,
    },

    async (req, reply) => {
      try {
        const prisma = fastify.prisma;

        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const userId = req.user.id || req.user.userId;
        const orgId = req.user.organizationId;
        const roles = req.user.roles || [];

        const isAdmin = roles.includes("BROKER_ADMIN");
        const isOfficer = roles.includes("BROKER_OFFICER");
        const isSubBroker = roles.includes("SUB_BROKER");

        if (!isAdmin && !isOfficer && !isSubBroker) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        const whereCondition = {
          brokerOrgId: orgId,

          ...(isOfficer && {
            brokerUserId: userId,
          }),

          ...(isSubBroker && {
            subBrokerAssignments: {
              some: {
                subBrokerId: userId,
              },
            },
          }),
        };

        const applications = await prisma.applicationSubmission.findMany({
          where: {
            status: {
              not: "SUPERSEDED",
            },
            application: whereCondition,
          },
          include: {
            fields: {
              include: {
                builderField: true,
              },
            },
            application: {
              select: {
                id: true,
                amountRequested: true,
                status: true,
                applicationLenders: {
                  select: {
                    status: true,
                  },
                },
              },
            },
          },
        });

        const totalVolume = applications.reduce((sum, submission) => {
          const amountField = submission.fields.find(
            (f) =>
              f.builderField?.fieldKey === "amountRequested" ||
              f.builderField?.fieldKey === "loan_amount" ||
              f.fieldKey === "amountRequested" ||
              f.fieldKey === "loan_amount",
          );

          const rawAmount =
            amountField?.value || submission.application?.amountRequested || 0;

          const parsedAmount = Number(
            String(rawAmount).replace(/[$,]/g, "").trim(),
          );

          const amount = Number.isNaN(parsedAmount) ? 0 : parsedAmount;
          return Number(sum || 0) + Number(amount || 0);
        }, 0);

        const statusCounts = countBrokerPipelineStats(applications);

        return reply.send({
          success: true,
          data: {
            totalVolume,
            totalApplications: applications.length,
            newApplications: statusCounts.newApplications,
            submitted: statusCounts.submitted,
            clientPending: statusCounts.clientPending,
            approved: statusCounts.approved,
            rejected: statusCounts.rejected,
            inReview: statusCounts.inReview,
            draft: statusCounts.draft,
            funded: statusCounts.funded,
          },
        });
      } catch (error) {
        req.log.error(error);

        return reply.code(500).send({
          success: false,
          message: "Failed to fetch pipeline stats",
          error: error.message,
        });
      }
    },
  );
};
