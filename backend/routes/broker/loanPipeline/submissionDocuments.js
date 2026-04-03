/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function submissionDocuments(fastify) {
  fastify.get("/submissions/:submissionId/documents", async (req, reply) => {
    try {
      /* ===============================
         AUTH CHECK
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

      /* ===============================
         PAGINATION
      =============================== */
      const { page = 1, limit = 10, search = "" } = req.query;

      const pageNumber = Math.max(parseInt(page) || 1, 1);
      const pageSize = Math.min(parseInt(limit) || 10, 50);
      const skip = (pageNumber - 1) * pageSize;

      /* ===============================
         FETCH SUBMISSION
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

      /* ===============================
         BUILD WHERE (SEARCH SUPPORT)
      =============================== */
      const whereCondition = {
        loanApplicationId,
        ...(search && {
          documentType: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        }),
      };

      /* ===============================
         TOTAL COUNT
      =============================== */
      const totalCount =
        await fastify.prisma.applicationDocumentRequirement.count({
          where: whereCondition,
        });

      /* ===============================
         FETCH DOCUMENTS
      =============================== */
      const documentRequirements =
        await fastify.prisma.applicationDocumentRequirement.findMany({
          where: whereCondition,
          skip,
          take: pageSize,
          include: {
            documentType: true,
            uploads: {
              orderBy: {
                uploadedAt: "desc",
              },
            },
          },
        });

      /* ===============================
         FORMAT RESPONSE
      =============================== */
      const documents = documentRequirements.map((d) => {
        const uploadedCount = d.uploads.length;

        return {
          requirementId: d.id,
          documentTypeId: d.documentTypeId,
          documentName: d.documentType?.name ?? null,
          source: d.source,
          isRequired: d.isRequired,
          status: d.status,
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

      /* ===============================
         RESPONSE
      =============================== */
      return reply.send({
        success: true,
        data: {
          submissionId: submission.id,
          loanApplicationId,
          documentsRequested: pendingCount > 0,
          pendingDocumentsCount: pendingCount,

          pagination: {
            page: pageNumber,
            limit: pageSize,
            total: totalCount,
            totalPages: Math.ceil(totalCount / pageSize),
          },

          documents,
        },
      });

    } catch (error) {
      fastify.log.error({
        error: error.message,
        route: "submission-documents",
      });

      return reply.code(500).send({
        success: false,
        message: "Server error while fetching documents",
      });
    }
  });
};