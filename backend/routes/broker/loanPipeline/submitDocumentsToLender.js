/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function submitDocumentsToLender(fastify) {
  fastify.post(
    "/submissions/:submissionId/documents/submit",
    async (req, reply) => {
      try {
        /* ===============================
           AUTH CHECK (BROKER ONLY)
        =============================== */
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = req.user.organizationId;

        if (!brokerOrgId) {
          return reply.code(403).send({
            success: false,
            message: "Broker context not resolved",
          });
        }

        const { submissionId } = req.params;
        const { requirementIds } = req.body || {};

        /* ===============================
           VALIDATE BODY (OPTIONAL)
        =============================== */
        if (
          requirementIds &&
          (!Array.isArray(requirementIds) ||
            requirementIds.some((id) => typeof id !== "string"))
        ) {
          return reply.code(400).send({
            success: false,
            message: "requirementIds must be an array of strings",
          });
        }

        /* ===============================
           FETCH SUBMISSION + OWNERSHIP
        =============================== */
        const submission =
          await fastify.prisma.applicationSubmission.findUnique({
            where: { id: submissionId },
            include: {
              application: true,
            },
          });

        if (!submission) {
          return reply.code(404).send({
            success: false,
            message: "Submission not found",
          });
        }

        if (submission.application.brokerOrgId !== brokerOrgId) {
          return reply.code(403).send({
            success: false,
            message: "Access denied for this loan",
          });
        }

        const loanApplicationId = submission.application.id;

        /* ===============================
           VALIDATE REQUIREMENTS (IF PROVIDED)
        =============================== */
        if (requirementIds && requirementIds.length > 0) {
          const validRequirements =
            await fastify.prisma.applicationDocumentRequirement.findMany({
              where: {
                id: { in: requirementIds },
                loanApplicationId,
              },
              select: { id: true },
            });

          if (validRequirements.length !== requirementIds.length) {
            return reply.code(400).send({
              success: false,
              message:
                "One or more requirementIds are invalid for this application",
            });
          }
        }

        /* ===============================
           BUILD FILTER (CORE LOGIC)
        =============================== */
        let uploadFilter = {
          loanApplicationId,
          isSubmittedToLender: false,
        };

        // 🔥 SELECTIVE SUPPORT
        if (requirementIds && requirementIds.length > 0) {
          uploadFilter.documentRequirementId = {
            in: requirementIds,
          };
        }

        /* ===============================
           FETCH UNSUBMITTED UPLOADS
        =============================== */
        const uploads =
          await fastify.prisma.applicationDocumentUpload.findMany({
            where: uploadFilter,
          });

        if (!uploads || uploads.length === 0) {
          return reply.code(400).send({
            success: false,
            message:
              requirementIds && requirementIds.length > 0
                ? "No documents available to submit for selected requirements"
                : "No documents available to submit",
          });
        }

        /* ===============================
           UPDATE DOCUMENTS → SUBMITTED
        =============================== */
        const uploadIds = uploads.map((u) => u.id);

        await fastify.prisma.applicationDocumentUpload.updateMany({
          where: {
            id: { in: uploadIds },
          },
          data: {
            isSubmittedToLender: true,
            submittedAt: new Date(),
          },
        });

        /* ===============================
           OPTIONAL: UPDATE APPLICATION STATUS
        =============================== */
        try {
          await fastify.prisma.loanApplication.update({
            where: { id: loanApplicationId },
            data: {
              status: "IN_REVIEW",
            },
          });
        } catch (err) {
          // do not fail request if this fails
          fastify.log.warn({
            error: err.message,
            message: "Failed to update loan status",
          });
        }

        /* ===============================
           RESPONSE
        =============================== */
        return reply.send({
          success: true,
          message: "Documents submitted to lender successfully",
          submittedCount: uploadIds.length,
          mode:
            requirementIds && requirementIds.length > 0
              ? "SELECTIVE"
              : "ALL",
        });

      } catch (error) {
        fastify.log.error({
          error: error.message,
          route: "submit-documents",
        });

        return reply.code(500).send({
          success: false,
          message: "Failed to submit documents",
        });
      }
    }
  );
};