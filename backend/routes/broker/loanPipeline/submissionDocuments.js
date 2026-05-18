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
      const submission = await fastify.prisma.applicationSubmission.findUnique({
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
         FETCH LENDER REQUESTS (IMPROVED)
      =============================== */
      const lenderRequests =
        await fastify.prisma.lenderDocumentRequest.findMany({
          where: {
            loanApplicationId,
          },
          include: {
            applicationLender: {
              include: {
                lender: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        });

      const lenderMap = new Map();

      for (const reqItem of lenderRequests) {
        const docId = reqItem.documentTypeId;

        if (!lenderMap.has(docId)) {
          lenderMap.set(docId, []);
        }

        lenderMap.get(docId).push({
          lenderId: reqItem.applicationLender?.lender?.id || null,
          lenderName: reqItem.applicationLender?.lender?.name || null,
          applicationLenderId: reqItem.applicationLenderId,
        });
      }

      /* ===============================
         BUILD WHERE (SEARCH SUPPORT)
      =============================== */
      const whereCondition = {
        loanApplicationId,

        OR: [
          {
            source: "BROKER_ADDED",
          },

          {
            source: "SUB_BROKER_ADDED",
            isSentToBroker: true,
          },
        ],

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

  include: {
    subBrokerSubmissions: true,
  },
},
          },
        });

      /* ===============================
         FORMAT RESPONSE
      =============================== */
      const documents = documentRequirements.map((d) => {
const matchedSubmission =
  d.uploads.find(
    (u) =>
      u.subBrokerSubmissions
        ?.length,
  );
        const uploadedCount = d.uploads.length;
        const requestedBy = lenderMap.get(d.documentTypeId) || [];

        return {
          requirementId: d.id,
          documentTypeId: d.documentTypeId,
          documentName: d.documentType?.name ?? null,
          source: d.source,
          isRequired: d.isRequired,
          status:
  matchedSubmission
    ?.subBrokerSubmissions?.[0]
    ?.status || d.status,

          // ✅ FULL LENDER DETAILS
          requestedByLenders: requestedBy,
          requestedByCount: requestedBy.length,

          uploadedCount,

          uploadedFiles: d.uploads.map((u) => ({
            uploadId: u.id,
            fileName: u.fileName,
            fileUrl: u.fileUrl,
            fileMimeType: u.fileMimeType,
            uploadedAt: u.uploadedAt,
          })),
subBrokerSubmissionId:
  matchedSubmission
    ?.subBrokerSubmissions?.[0]
    ?.id || null,
        };
      });

      const pendingCount = documents.filter(
        (doc) => doc.status === "PENDING",
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
        stack: error.stack,
        route: "submission-documents",
      });

      return reply.code(500).send({
        success: false,
        message: error.message,
      });
    }
  });
};
