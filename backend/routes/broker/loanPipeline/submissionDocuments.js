/**
 * @param {import("fastify").FastifyInstance} fastify
 */
const {
  getAutoForwardDocumentsToLender,
} = require("../../../services/documentAutoForwardSetting");
const {
  buildDocumentSentToLenderMap,
  formatSentToLenders,
} = require("../../../utils/buildDocumentSentToLenderMap");
const {
  buildLenderRequestMap,
  buildDocumentFilterLenders,
  buildSubmissionDocumentsWhere,
  documentMatchesSentFilter,
  paginateDocuments,
  filterDocumentLenderContext,
} = require("../../../utils/submissionDocumentsQuery");

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
      } = req.query;

      const pageNumber = Math.max(parseInt(page) || 1, 1);
      const pageSize = Math.min(parseInt(limit) || 10, 50);
      const skip = (pageNumber - 1) * pageSize;
      const lenderFilterId =
        typeof applicationLenderId === "string" ? applicationLenderId.trim() : "";
      const normalizedSentFilter =
        typeof sentFilter === "string" ? sentFilter.trim().toLowerCase() : "all";

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
      });

      const useInMemoryPagination =
        normalizedSentFilter === "sent" || normalizedSentFilter === "not_sent";

      const documentRequirements =
        await fastify.prisma.applicationDocumentRequirement.findMany({
          where: whereCondition,
          ...(useInMemoryPagination ? {} : { skip, take: pageSize }),
          include: {
            documentType: true,
            uploads: {
              orderBy: { uploadedAt: "desc" },
              include: { subBrokerSubmissions: true },
            },
          },
        });

      const { byRequirement, lenderNameById } =
        await buildDocumentSentToLenderMap(fastify.prisma, loanApplicationId);

      let documents = documentRequirements.map((d) => {
        const matchedSubmission = d.uploads.find(
          (upload) => upload.subBrokerSubmissions?.length,
        );
        const uploadedCount = d.uploads.length;
        let requestedBy = lenderMap.get(d.documentTypeId) || [];

        if (lenderFilterId) {
          requestedBy = filterDocumentLenderContext(requestedBy, lenderFilterId);
        }

        const sentInfo = formatSentToLenders(
          d.id,
          requestedBy,
          byRequirement,
          lenderNameById,
        );

        const sentToLenders = lenderFilterId
          ? filterDocumentLenderContext(sentInfo.sentToLenders, lenderFilterId)
          : sentInfo.sentToLenders;

        return {
          requirementId: d.id,
          documentTypeId: d.documentTypeId,
          documentName: d.documentType?.name ?? null,
          source: d.source,
          isRequired: d.isRequired,
          status:
            matchedSubmission?.subBrokerSubmissions?.[0]?.status || d.status,
          requestedByLenders: requestedBy,
          requestedByCount: requestedBy.length,
          sentToLenders,
          isSentToAnyLender: sentToLenders.some((item) => item.isSent),
          uploadedCount,
          uploadedFiles: d.uploads.map((upload) => ({
            uploadId: upload.id,
            fileName: upload.fileName,
            fileUrl: upload.fileUrl,
            fileMimeType: upload.fileMimeType,
            uploadedAt: upload.uploadedAt,
          })),
          subBrokerSubmissionId:
            matchedSubmission?.subBrokerSubmissions?.[0]?.id || null,
        };
      });

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
