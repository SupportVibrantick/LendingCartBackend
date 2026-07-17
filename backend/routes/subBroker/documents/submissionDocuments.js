/**
 * @param {import("fastify").FastifyInstance} fastify
 */
const {
  buildDocumentSentToLenderMap,
} = require("../../../utils/documents/buildDocumentSentToLenderMap");
const {
  buildLenderRequestMap,
  buildDocumentFilterLenders,
  buildSubmissionDocumentsWhere,
  normalizeSourceFilter,
  documentMatchesSentFilter,
  paginateDocuments,
} = require("../../../utils/documents/submissionDocumentsQuery");
const {
  submissionDocumentRequirementInclude,
  loadSubBrokerAssignmentNameMap,
  mapSubmissionDocumentRow,
} = require("../../../utils/documents/mapSubmissionDocumentRow");

module.exports = async function submissionDocuments(fastify) {
  fastify.get(
    "/submissions/:submissionId/documents",
    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],
      schema: {
        tags: ["Sub Broker → Documents"],
        summary: "Get assigned submission documents",
      },
    },
    async (req, reply) => {
      try {
        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const prisma = fastify.prisma;
        const { submissionId } = req.params;
        const userId = req.user.userId;

        const {
          page = 1,
          limit = 10,
          search = "",
          applicationLenderId = "",
          sentFilter = "all",
          sourceFilter = "all",
          documentCategory = "upload",
        } = req.query;

        const pageNumber = Math.max(parseInt(page) || 1, 1);
        const pageSize = Math.min(parseInt(limit) || 10, 50);
        const skip = (pageNumber - 1) * pageSize;
        const lenderFilterId =
          typeof applicationLenderId === "string"
            ? applicationLenderId.trim()
            : "";
        const normalizedSentFilter =
          typeof sentFilter === "string" ? sentFilter.trim().toLowerCase() : "all";
        const normalizedSourceFilter = normalizeSourceFilter(sourceFilter);

        const submission = await prisma.applicationSubmission.findUnique({
          where: { id: submissionId },
          include: {
            application: {
              include: {
                brokerOrg: {
                  select: {
                    id: true,
                    name: true,
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

        const loanApplicationId = submission.application.id;

        const assignment = await prisma.subBrokerApplication.findFirst({
          where: {
            loanApplicationId,
            subBrokerId: userId,
          },
          select: { id: true },
        });

        if (!assignment) {
          return reply.code(403).send({
            success: false,
            message: "Access denied for this loan",
          });
        }

        const lenderRequests = await prisma.lenderDocumentRequest.findMany({
          where: { loanApplicationId },
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

        const documentFilterLenders = buildDocumentFilterLenders(lenderRequests);
        const lenderMap = buildLenderRequestMap(lenderRequests);

        if (
          lenderFilterId &&
          !documentFilterLenders.some(
            (lender) => lender.applicationLenderId === lenderFilterId,
          )
        ) {
          return reply.code(400).send({
            success: false,
            message: "Invalid lender filter",
          });
        }

        const whereCondition = buildSubmissionDocumentsWhere({
          loanApplicationId,
          search,
          applicationLenderId: lenderFilterId,
          lenderRequests,
          sourceFilter: normalizedSourceFilter,
          documentCategory,
          viewerRole: "sub_broker",
        });

        const useInMemoryPagination =
          normalizedSentFilter === "sent" ||
          normalizedSentFilter === "not_sent" ||
          normalizedSentFilter === "sent_to_client" ||
          normalizedSentFilter === "not_sent_to_client";

        const documentRequirements =
          await prisma.applicationDocumentRequirement.findMany({
            where: whereCondition,
            ...(useInMemoryPagination ? {} : { skip, take: pageSize }),
            include: submissionDocumentRequirementInclude,
          });

        const { byRequirement, byUpload, lenderNameById } =
          await buildDocumentSentToLenderMap(prisma, loanApplicationId);

        const assignmentNamesBySubBrokerId =
          await loadSubBrokerAssignmentNameMap(prisma, loanApplicationId);

        let documents = documentRequirements.map((d) =>
          mapSubmissionDocumentRow(d, {
            lenderMap,
            lenderFilterId,
            byRequirement,
            byUpload,
            lenderNameById,
            assignmentNamesBySubBrokerId,
          }),
        );

        if (useInMemoryPagination) {
          documents = documents.filter((doc) =>
            documentMatchesSentFilter(
              doc,
              normalizedSentFilter,
              lenderFilterId || null,
            ),
          );
        }

        let pagination;

        if (useInMemoryPagination) {
          const paged = paginateDocuments(documents, pageNumber, pageSize);
          documents = paged.documents;
          pagination = paged.pagination;
        } else {
          const totalCount =
            await prisma.applicationDocumentRequirement.count({
              where: whereCondition,
            });

          pagination = {
            page: pageNumber,
            limit: pageSize,
            total: totalCount,
            totalPages: Math.ceil(totalCount / pageSize) || 1,
          };
        }

        const pendingCount = documents.filter((doc) => doc.status === "PENDING")
          .length;

        return reply.send({
          success: true,
          data: {
            submissionId: submission.id,
            loanApplicationId,
            brokerOrgName: submission.application.brokerOrg?.name || null,
            documentsRequested: pendingCount > 0,
            pendingDocumentsCount: pendingCount,
            documentFilterLenders,
            activeFilters: {
              applicationLenderId: lenderFilterId || null,
              sentFilter: normalizedSentFilter,
              sourceFilter: normalizedSourceFilter,
            },
            pagination,
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
