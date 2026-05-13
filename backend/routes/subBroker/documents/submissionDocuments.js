/**
 * @param {import("fastify").FastifyInstance} fastify
 */

module.exports = async function submissionDocuments(fastify) {
  fastify.get(
    "/submissions/:submissionId/documents",

    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],

      schema: {
        tags: ["Sub Broker → Documents"],

        summary: "Get assigned submission documents",

        params: {
          type: "object",

          required: ["submissionId"],

          properties: {
            submissionId: {
              type: "string",
            },
          },
        },

        querystring: {
          type: "object",

          properties: {
            page: {
              type: "number",
              default: 1,
            },

            limit: {
              type: "number",
              default: 10,
            },

            search: {
              type: "string",
            },
          },
        },
      },
    },

    async (req, reply) => {
      try {
        /* ===============================
           AUTH CHECK
        =============================== */

        if (!req.user) {
          return reply.code(401).send({
            success: false,

            message: "Unauthorized",
          });
        }

        const prisma = fastify.prisma;

        const { submissionId } = req.params;

        const userId = req.user.userId;

        /* ===============================
           PAGINATION
        =============================== */

        const { page = 1, limit = 10, search = "" } = req.query;

        const pageNumber = Math.max(Number(page) || 1, 1);

        const pageSize = Math.min(Number(limit) || 10, 50);

        const skip = (pageNumber - 1) * pageSize;

        /* ===============================
           FETCH SUBMISSION
        =============================== */

        const submission = await prisma.applicationSubmission.findUnique({
          where: {
            id: submissionId,
          },

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

        const loanApplicationId = submission.application.id;

        /* ===============================
           VERIFY SUB BROKER ASSIGNMENT
        =============================== */

        const assignment = await prisma.subBrokerApplication.findFirst({
          where: {
            loanApplicationId,

            subBrokerId: userId,
          },

          select: {
            id: true,
          },
        });

        if (!assignment) {
          return reply.code(403).send({
            success: false,

            message: "Access denied for this loan",
          });
        }

        /* ===============================
           FETCH LENDER REQUESTS
        =============================== */

        const lenderRequests = await prisma.lenderDocumentRequest.findMany({
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
           SEARCH SUPPORT
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

        const totalCount = await prisma.applicationDocumentRequirement.count({
          where: whereCondition,
        });

        /* ===============================
           FETCH DOCUMENTS
        =============================== */

        const documentRequirements =
          await prisma.applicationDocumentRequirement.findMany({
            where: whereCondition,

            skip,

            take: pageSize,

            include: {
              documentType: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  description: true,
                  isActive: true,
                },
              },

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

          const requestedBy = lenderMap.get(d.documentTypeId) || [];

          return {
            requirementId: d.id,

            documentTypeId: d.documentTypeId,

            documentName: d.documentType?.name ?? null,

            source: d.source,

            isRequired: d.isRequired,

            status: d.status,

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

          route: "subbroker-submission-documents",
        });

        return reply.code(500).send({
          success: false,

          message: error.message || "Server error while fetching documents",
        });
      }
    },
  );
};
