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
        const { lenders, applicationLenderId, requirementIds } = req.body || {};

        /* ===============================
           SUPPORT OLD + NEW FORMAT
        =============================== */
        let lenderList = [];

        if (Array.isArray(lenders) && lenders.length > 0) {
          lenderList = lenders;
        } else if (applicationLenderId) {
          // backward compatibility
          lenderList = [{ applicationLenderId, requirementIds }];
        } else {
          return reply.code(400).send({
            success: false,
            message: "Provide lenders array or applicationLenderId",
          });
        }

        /* ===============================
           FETCH SUBMISSION + OWNERSHIP
        =============================== */
        const submission =
          await fastify.prisma.applicationSubmission.findUnique({
            where: { id: submissionId },
            include: { application: true },
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

        let totalSubmitted = 0;
        const results = [];

        /* ===============================
           PROCESS EACH LENDER
        =============================== */
        for (const lenderItem of lenderList) {
          const { applicationLenderId, requirementIds } = lenderItem;

          if (!applicationLenderId || typeof applicationLenderId !== "string") {
            results.push({
              lenderId: applicationLenderId,
              success: false,
              message: "Invalid lenderId",
            });
            continue;
          }

          /* VALIDATE LENDER */
          const lender =
            await fastify.prisma.applicationLender.findUnique({
              where: { id: applicationLenderId },
            });

          if (!lender || lender.loanApplicationId !== loanApplicationId) {
            results.push({
              lenderId: applicationLenderId,
              success: false,
              message: "Invalid lender for this application",
            });
            continue;
          }

          /* VALIDATE REQUIREMENTS */
          if (requirementIds && requirementIds.length > 0) {
            if (
              !Array.isArray(requirementIds) ||
              requirementIds.some((id) => typeof id !== "string")
            ) {
              results.push({
                lenderId: applicationLenderId,
                success: false,
                message: "Invalid requirementIds format",
              });
              continue;
            }

            const validRequirements =
              await fastify.prisma.applicationDocumentRequirement.findMany({
                where: {
                  id: { in: requirementIds },
                  loanApplicationId,
                },
                select: { id: true },
              });

            if (validRequirements.length !== requirementIds.length) {
              results.push({
                lenderId: applicationLenderId,
                success: false,
                message: "Invalid requirementIds for this application",
              });
              continue;
            }
          }

          /* BUILD FILTER */
          let uploadFilter = { loanApplicationId };

          if (requirementIds && requirementIds.length > 0) {
            uploadFilter.documentRequirementId = {
              in: requirementIds,
            };
          }

          /* FETCH UPLOADS */
          const uploads =
            await fastify.prisma.applicationDocumentUpload.findMany({
              where: uploadFilter,
              select: { id: true },
            });

          if (!uploads || uploads.length === 0) {
            results.push({
              lenderId: applicationLenderId,
              success: false,
              message: "No documents available",
            });
            continue;
          }

          const uploadIds = uploads.map((u) => u.id);

          /* CREATE SUBMISSION */
          const submissionData = uploadIds.map((docId) => ({
            documentUploadId: docId,
            applicationLenderId,
          }));

          await fastify.prisma.applicationDocumentSubmission.createMany({
            data: submissionData,
            skipDuplicates: true,
          });

          totalSubmitted += uploadIds.length;

          /* UPDATE LENDER */
          try {
            await fastify.prisma.applicationLender.update({
              where: { id: applicationLenderId },
              data: {
                status: "IN_REVIEW",
                sentAt: new Date(),
              },
            });
          } catch {}

          results.push({
            lenderId: applicationLenderId,
            success: true,
            submittedCount: uploadIds.length,
          });
        }

        /* UPDATE APPLICATION */
        try {
          await fastify.prisma.loanApplication.update({
            where: { id: loanApplicationId },
            data: { status: "IN_REVIEW" },
          });
        } catch {}

        /* ===============================
           RESPONSE
        =============================== */
        return reply.send({
          success: true,
          message: "Documents processed for multiple lenders",
          totalSubmitted,
          results,
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