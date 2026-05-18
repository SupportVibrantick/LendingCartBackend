/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function skipSubBrokerSubmission(
  fastify,
) {
  fastify.post(
    "/sub-broker-submissions/:submissionId/skip",
    async (req, reply) => {
      try {
        /* ===============================
           AUTH CHECK
        =============================== */
        if (
          !req.user ||
          req.user.orgType !== "BROKER"
        ) {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerUserId =
          req.user.userId;

        const brokerOrgId =
          req.user.organizationId;

        if (!brokerOrgId) {
          return reply.code(403).send({
            success: false,
            message:
              "Broker context not resolved",
          });
        }

        /* ===============================
           PARAMS + BODY
        =============================== */
        const { submissionId } =
          req.params;

          if (!submissionId) {
  return reply.code(400).send({
    success: false,
    message: "Submission ID missing",
  });
}

        const { reason } = req.body || {};

        if (!reason?.trim()) {
          return reply.code(400).send({
            success: false,
            message:
              "Skip reason is required",
          });
        }

        /* ===============================
           FIND SUBMISSION
        =============================== */
        const submission =
          await fastify.prisma.subBrokerSubmission.findUnique(
            {
              where: {
                id: submissionId,
              },

              include: {
                loanApplication: true,
                documentUpload: true,
              },
            },
          );

        if (!submission) {
          return reply.code(404).send({
            success: false,
            message:
              "Submission not found",
          });
        }

        /* ===============================
           ACCESS CHECK
        =============================== */
        if (
          submission.loanApplication
            ?.brokerOrgId !==
          brokerOrgId
        ) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        /* ===============================
           ALREADY SKIPPED
        =============================== */
        if (
          submission.status ===
          "SKIPPED"
        ) {
          return reply.code(400).send({
            success: false,
            message:
              "Document already skipped",
          });
        }

        /* ===============================
           UPDATE SUBMISSION
        =============================== */
        const updatedSubmission =
          await fastify.prisma.subBrokerSubmission.update(
            {
              where: {
                id: submissionId,
              },

              data: {
                status: "SKIPPED",

                skipReason:
                  reason.trim(),

                reviewedAt: new Date(),

                reviewedById:
                  brokerUserId,
              },
            },
          );

        /* ===============================
           UPDATE DOCUMENT REQUIREMENT
        =============================== */
        if (
          submission.documentRequirementId
        ) {
          await fastify.prisma.applicationDocumentRequirement.update(
            {
              where: {
                id: submission.documentRequirementId,
              },

              data: {
                status: "SKIPPED",
              },
            },
          );
        }

        /* ===============================
           RESPONSE
        =============================== */
        return reply.send({
          success: true,
          message:
            "Document skipped successfully",

          data: updatedSubmission,
        });
      } catch (error) {
        fastify.log.error({
          error: error.message,
          stack: error.stack,
          route:
            "skip-sub-broker-submission",
        });

        return reply.code(500).send({
          success: false,
          message:
           error.message,
        });
      }
    },
  );
};