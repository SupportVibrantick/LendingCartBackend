const {
  countBrokerPipelineStats,
} = require("../../../utils/resolveApplicationStatus");

module.exports = async function subBrokerPipelineStats(fastify) {
  fastify.get(
    "/pipeline-stats",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],
      schema: {
        tags: ["Sub Broker -> Loan Pipeline"],
        summary: "Pipeline stats for assigned co-broker applications",
      },
    },
    async (req, reply) => {
      try {
        const prisma = fastify.prisma;
        const userId = req.user.userId;
        const orgId = req.user.organizationId;

        const applications = await prisma.applicationSubmission.findMany({
          where: {
            status: { not: "SUPERSEDED" },
            application: {
              brokerOrgId: orgId,
              subBrokerAssignments: {
                some: { subBrokerId: userId },
              },
            },
          },
          include: {
            fields: {
              include: { builderField: true },
            },
            application: {
              select: {
                id: true,
                amountRequested: true,
                status: true,
                applicationLenders: {
                  select: { status: true },
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
          },
        });
      } catch (error) {
        req.log.error(error);

        return reply.code(500).send({
          success: false,
          message: "Failed to fetch pipeline stats",
        });
      }
    },
  );
};
