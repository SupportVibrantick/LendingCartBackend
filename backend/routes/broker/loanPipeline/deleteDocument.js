const fs = require("fs");
const path = require("path");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function deleteDocument(fastify) {
  fastify.delete(
    "/submissions/:submissionId/documents/:uploadId/delete",
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
        const { submissionId, uploadId } = req.params;

        if (!brokerOrgId) {
          return reply.code(403).send({
            success: false,
            message: "Broker context not resolved",
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

        /* ===============================
           FETCH UPLOAD
        =============================== */
        const upload =
          await fastify.prisma.applicationDocumentUpload.findUnique({
            where: { id: uploadId },
          });

        if (!upload) {
          return reply.code(404).send({
            success: false,
            message: "Document not found",
          });
        }

        /* ===============================
           VALIDATE BELONGS TO LOAN
        =============================== */
        if (upload.loanApplicationId !== submission.application.id) {
          return reply.code(400).send({
            success: false,
            message: "Document does not belong to this submission",
          });
        }

        /* ===============================
           PREVENT DELETE IF SUBMITTED
        =============================== */
        if (upload.isSubmittedToLender) {
          return reply.code(400).send({
            success: false,
            message: "Cannot delete document after submission",
          });
        }

        const requirementId = upload.documentRequirementId;

        /* ===============================
           DELETE FILE FROM DISK
        =============================== */
        if (upload.fileUrl) {
          const filePath = path.join(
            process.cwd(),
            upload.fileUrl
          );

          try {
            if (fs.existsSync(filePath)) {
              await fs.promises.unlink(filePath);
            }
          } catch (err) {
            fastify.log.warn({
              error: err.message,
              filePath,
            });
          }
        }

        /* ===============================
           DELETE FROM DB + UPDATE STATUS
        =============================== */
        await fastify.prisma.$transaction(async (tx) => {
          // delete upload
          await tx.applicationDocumentUpload.delete({
            where: { id: uploadId },
          });

          // count remaining uploads
          const remaining =
            await tx.applicationDocumentUpload.count({
              where: { documentRequirementId: requirementId },
            });

          // update requirement status
          let newStatus = "PENDING";

          if (remaining > 0) {
            newStatus = "PARTIAL";
          }

          await tx.applicationDocumentRequirement.update({
            where: { id: requirementId },
            data: { status: newStatus },
          });
        });

        /* ===============================
           RESPONSE
        =============================== */
        return reply.send({
          success: true,
          message: "Document deleted successfully",
        });

      } catch (error) {
        fastify.log.error({
          error: error.message,
          route: "delete-document",
        });

        return reply.code(500).send({
          success: false,
          message: "Failed to delete document",
        });
      }
    }
  );
};