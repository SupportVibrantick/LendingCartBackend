/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function submissionDocuments(fastify) {
  fastify.get("/submissions/:submissionId/documents", async (req, reply) => {
    // ===============================
    // BROKER AUTH GUARD
    // ===============================
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

    // ===============================
    // FETCH SUBMISSION SECURELY
    // ===============================
    const submission =
      await fastify.prisma.applicationSubmission.findUnique({
        where: { id: submissionId },
        include: {
          application: {
            include: {
              documentRequirements: {
                include: {
                  documentType: true,
                  uploads: true,
                },
              },
            },
          },
        },
      });

    if (!submission) {
      return reply.code(404).send({
        success: false,
        message: "Submission not found",
      });
    }

    // ===============================
    // ENSURE BROKER OWNS THIS LOAN
    // ===============================
    if (submission.application.brokerOrgId !== brokerOrgId) {
      return reply.code(403).send({
        success: false,
        message: "Access denied for this loan",
      });
    }

    const documents = submission.application.documentRequirements.map((d) => {
      const uploadedCount = d.uploads.length;

      return {
        requirementId: d.id,
        documentTypeId: d.documentTypeId,
        documentName: d.documentType?.name ?? null,
        source: d.source, // PRODUCT_DEFAULT / LENDER_DEFAULT / LENDER_ADDED
        isRequired: d.isRequired,
        status: d.status, // PENDING / PARTIAL / COMPLETE
        uploadedCount,
        uploadedFiles: d.uploads.map((u) => ({
          uploadId: u.id,
          fileName: u.fileName,
          fileUrl: u.fileUrl,
          fileMimeType: u.fileMimeType,
          uploadedAt: u.uploadedAt,
        })),
      };
    });

    const pendingCount = documents.filter(
      (doc) => doc.status === "PENDING"
    ).length;

    // ===============================
    //  RESPONSE
    // ===============================
    return reply.send({
      success: true,
      data: {
        submissionId: submission.id,
        loanApplicationId: submission.application.id,
        documentsRequested: pendingCount > 0,
        pendingDocumentsCount: pendingCount,
        documents,
      },
    });
  });
};