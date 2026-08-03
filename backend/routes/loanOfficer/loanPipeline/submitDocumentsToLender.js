const {
  filterRequirementIdsForLender,
} = require("../../../utils/lender/filterDocumentRequirementsForLender");
const {
  canLenderReceiveDocuments,
  getLenderDocumentDeliveryBlockMessage,
} = require("../../../utils/lender/lenderDocumentDelivery");
const {
  applyDocumentSendStatusUpdates,
} = require("../../../services/documents/applyDocumentSendStatusUpdates");
const { extraOfficerPermission } = require("../../../services/broker/loanOfficerAccess");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function submitDocumentsToLender(fastify) {
  fastify.post(
    "/submissions/:submissionId/documents/submit",
    { preHandler: extraOfficerPermission(fastify, "SUBMIT_TO_LENDERS") },
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

        const userId = req.user.id || req.user.userId;
        if (submission.application.brokerUserId !== userId) {
          return reply.code(403).send({
            success: false,
            message: "Access denied - not assigned to you",
          });
        }

        const loanApplicationId = submission.application.id;

        let totalSubmitted = 0;
        const results = [];
        const successfulApplicationLenderIds = [];

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

          if (!canLenderReceiveDocuments(lender.status)) {
            results.push({
              lenderId: applicationLenderId,
              success: false,
              message: getLenderDocumentDeliveryBlockMessage(lender.status),
              blockedByStatus: lender.status,
            });
            continue;
          }

          /* VALIDATE + FILTER REQUIREMENTS PER LENDER */
          let filteredRequirementIds = requirementIds;
          let skippedCount = 0;

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

            const filterResult = await filterRequirementIdsForLender(
              fastify.prisma,
              {
                loanApplicationId,
                applicationLenderId,
                requirementIds,
              },
            );

            filteredRequirementIds = filterResult.allowedIds;
            skippedCount = filterResult.skippedIds.length;

            if (filteredRequirementIds.length === 0) {
              results.push({
                lenderId: applicationLenderId,
                success: false,
                message: "No eligible documents for this lender",
                skippedCount,
              });
              continue;
            }
          }

          /* BUILD FILTER */
          let uploadFilter = { loanApplicationId };

          if (filteredRequirementIds && filteredRequirementIds.length > 0) {
            uploadFilter.documentRequirementId = {
              in: filteredRequirementIds,
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

          await fastify.prisma.subBrokerSubmission.updateMany({
            where: {
              documentUploadId: { in: uploadIds },
              status: { in: ["PENDING", "REVIEWED"] },
            },
            data: {
              status: "SENT_TO_LENDER",
              sentToLenderAt: new Date(),
            },
          });

          totalSubmitted += uploadIds.length;
          successfulApplicationLenderIds.push(applicationLenderId);

          results.push({
            lenderId: applicationLenderId,
            success: true,
            submittedCount: uploadIds.length,
            skippedCount,
          });
        }

        if (successfulApplicationLenderIds.length > 0) {
          await applyDocumentSendStatusUpdates(fastify.prisma, {
            loanApplicationId,
            applicationLenderIds: successfulApplicationLenderIds,
          });
        }

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