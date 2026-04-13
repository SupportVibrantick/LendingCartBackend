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
        const { requirementIds, applicationLenderId } = req.body || {};

        /* ===============================
           VALIDATE BODY
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

        if (!applicationLenderId || typeof applicationLenderId !== "string") {
          return reply.code(400).send({
            success: false,
            message: "applicationLenderId is required",
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
           VALIDATE LENDER
        =============================== */
        const lender =
          await fastify.prisma.applicationLender.findUnique({
            where: { id: applicationLenderId },
          });

        if (!lender || lender.loanApplicationId !== loanApplicationId) {
          return reply.code(400).send({
            success: false,
            message: "Invalid lender for this application",
          });
        }

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
           BUILD FILTER
        =============================== */
        let uploadFilter = {
          loanApplicationId,
        };

        if (requirementIds && requirementIds.length > 0) {
          uploadFilter.documentRequirementId = {
            in: requirementIds,
          };
        }

        /* ===============================
           FETCH UPLOADS
        =============================== */
        const uploads =
          await fastify.prisma.applicationDocumentUpload.findMany({
            where: uploadFilter,
            select: { id: true },
          });

        if (!uploads || uploads.length === 0) {
          return reply.code(400).send({
            success: false,
            message:
              requirementIds && requirementIds.length > 0
                ? "No documents available for selected requirements"
                : "No documents available to submit",
          });
        }

        const uploadIds = uploads.map((u) => u.id);

        /* ===============================
           CREATE DOCUMENT → LENDER MAPPING
        =============================== */
        const submissionData = uploadIds.map((docId) => ({
          documentUploadId: docId,
          applicationLenderId,
        }));

        await fastify.prisma.applicationDocumentSubmission.createMany({
          data: submissionData,
          skipDuplicates: true,
        });

        /* ===============================
           UPDATE LENDER STATUS (OPTIONAL)
        =============================== */
        try {
          await fastify.prisma.applicationLender.update({
            where: { id: applicationLenderId },
            data: {
              status: "IN_REVIEW",
              sentAt: new Date(),
            },
          });
        } catch (err) {
          fastify.log.warn({
            error: err.message,
            message: "Failed to update lender status",
          });
        }

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
          message: "Documents submitted to selected lender successfully",
          submittedCount: uploadIds.length,
          lenderId: applicationLenderId,
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