/**
 * @param {import("fastify").FastifyInstance} fastify
 */
const {
  getAutoForwardDocumentsToLender,
} = require("../../../services/documentAutoForwardSetting");
const {
  buildDocumentSentToLenderMap,
} = require("../../../utils/buildDocumentSentToLenderMap");
const {
  buildLenderRequestMap,
  buildDocumentFilterLenders,
  buildSubmissionDocumentsWhere,
  normalizeSourceFilter,
  documentMatchesSentFilter,
  paginateDocuments,
} = require("../../../utils/submissionDocumentsQuery");
const {
  submissionDocumentRequirementInclude,
  loadSubBrokerAssignmentNameMap,
  mapSubmissionDocumentRow,
} = require("../../../utils/mapSubmissionDocumentRow");

module.exports = async function submissionDocuments(fastify) {
  fastify.get("/submissions/:submissionId/documents", async (req, reply) => {
    try {
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
        typeof applicationLenderId === "string" ? applicationLenderId.trim() : "";
      const normalizedSentFilter =
        typeof sentFilter === "string" ? sentFilter.trim().toLowerCase() : "all";
      const normalizedSourceFilter = normalizeSourceFilter(sourceFilter);

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

      const lenderRequests =
        await fastify.prisma.lenderDocumentRequest.findMany({
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
      });

      const useInMemoryPagination =
        normalizedSentFilter === "sent" || normalizedSentFilter === "not_sent";

      const { byRequirement, byUpload, lenderNameById } =
        await buildDocumentSentToLenderMap(fastify.prisma, loanApplicationId);

      const assignmentNamesBySubBrokerId =
        await loadSubBrokerAssignmentNameMap(fastify.prisma, loanApplicationId);

      const documentRequirements =
        await fastify.prisma.applicationDocumentRequirement.findMany({
          where: whereCondition,
          ...(useInMemoryPagination ? {} : { skip, take: pageSize }),
          include: submissionDocumentRequirementInclude,
        });

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
          await fastify.prisma.applicationDocumentRequirement.count({
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

      const autoForwardDocumentsToLender =
        await getAutoForwardDocumentsToLender(
          fastify.prisma,
          loanApplicationId,
        );

      return reply.send({
        success: true,
        data: {
          submissionId: submission.id,
          loanApplicationId,
          autoForwardDocumentsToLender,
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
        route: "submission-documents",
      });

      return reply.code(500).send({
        success: false,
        message: error.message,
      });
    }
  });
};
