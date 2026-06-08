const { officerPreHandler, getUserId } = require("../../../services/loanOfficerAccess");

module.exports = async function loanOfficerPipelineStats(fastify) {
  fastify.get(
    "/pipeline-stats",
    { preHandler: officerPreHandler(fastify) },
    async (req, reply) => {
      try {
        const prisma = fastify.prisma;
        const userId = getUserId(req);
        const orgId = req.user.organizationId;

        const whereCondition = {
          brokerOrgId: orgId,
          brokerUserId: userId,
        };

        const applications = await prisma.applicationSubmission.findMany({
          where: {
            status: { not: "SUPERSEDED" },
            application: whereCondition,
          },
          include: {
            fields: { include: { builderField: true } },
            application: {
              select: {
                id: true,
                amountRequested: true,
                status: true,
                applicationLenders: { select: { status: true } },
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
          const parsedAmount = Number(String(rawAmount).replace(/[$,]/g, "").trim());
          return Number(sum || 0) + (isNaN(parsedAmount) ? 0 : parsedAmount);
        }, 0);

        const approved = applications.filter((s) =>
          s.application?.applicationLenders?.some((l) => l.status === "APPROVED"),
        ).length;

        const rejected = applications.filter(
          (s) =>
            s.application?.applicationLenders?.length > 0 &&
            s.application.applicationLenders.every((l) => l.status === "DECLINED"),
        ).length;

        const inReview = applications.filter(
          (s) =>
            s.application?.status === "IN_REVIEW" ||
            s.application?.applicationLenders?.some((l) => l.status === "IN_REVIEW"),
        ).length;

        const draft = applications.filter((s) => s.application?.status === "DRAFT").length;
        const submitted = applications.filter((s) => s.application?.status === "SUBMITTED").length;
        const clientPending = applications.filter(
          (s) => s.application?.status === "CLIENT_PENDING",
        ).length;
        const newApplications = applications.filter((s) => s.application?.status === "NEW").length;

        return reply.send({
          success: true,
          data: {
            totalVolume,
            totalApplications: applications.length,
            newApplications,
            submitted,
            clientPending,
            approved,
            rejected,
            inReview,
            draft,
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
