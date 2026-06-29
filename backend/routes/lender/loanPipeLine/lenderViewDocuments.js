/**
 * @param {import("fastify").FastifyInstance} fastify
 */
const {
  formatUserName,
  resolveLenderDocumentSourceLabel,
  matchesLenderDocumentSourceFilter,
} = require("../../../utils/resolveLenderDocumentSourceLabel");
const {
  loadSubBrokerAssignmentNameMap,
} = require("../../../utils/mapSubmissionDocumentRow");
const { paginateDocuments } = require("../../../utils/submissionDocumentsQuery");

module.exports = async function lenderViewDocuments(fastify) {
  fastify.get(
    "/lender/applications/:applicationLenderId/documents",
    async (req, reply) => {
      try {
        /* ===============================
           AUTH CHECK (LENDER ONLY)
        =============================== */
        if (!req.user || req.user.orgType !== "LENDER") {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;

        if (!lenderOrgId) {
          return reply.code(403).send({
            success: false,
            message: "Lender context not resolved",
          });
        }

        const { applicationLenderId } = req.params;
        const {
          page = 1,
          limit = 10,
          search = "",
          sourceFilter = "all",
        } = req.query;

        const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
        const pageSize = Math.min(parseInt(limit, 10) || 10, 50);
        const searchTerm =
          typeof search === "string" ? search.trim().toLowerCase() : "";
        const normalizedSourceFilter =
          typeof sourceFilter === "string"
            ? sourceFilter.trim().toLowerCase()
            : "all";
        const activeSourceFilter = ["all", "mine", "broker"].includes(
          normalizedSourceFilter,
        )
          ? normalizedSourceFilter
          : "all";

        if (!applicationLenderId) {
          return reply.code(400).send({
            success: false,
            message: "applicationLenderId is required",
          });
        }

        /* ===============================
           VALIDATE APPLICATION ACCESS
        =============================== */
        const applicationLender =
          await fastify.prisma.applicationLender.findFirst({
            where: {
              id: applicationLenderId,
              lenderOrgId,
            },
            select: {
              id: true,
              loanApplicationId: true,
              lender: {
                select: { name: true },
              },
              loanApplication: {
                select: {
                  brokerOrg: {
                    select: { name: true },
                  },
                  brokerUser: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          });

        if (!applicationLender) {
          return reply.code(404).send({
            success: false,
            message: "Application not found for this lender",
          });
        }

        const loanApplicationId = applicationLender.loanApplicationId;
        const brokerOrgName = applicationLender.loanApplication?.brokerOrg?.name || null;
        const brokerUserName = formatUserName(
          applicationLender.loanApplication?.brokerUser,
        );
        const lenderName = applicationLender.lender?.name || null;

        const assignmentNamesBySubBrokerId =
          await loadSubBrokerAssignmentNameMap(
            fastify.prisma,
            loanApplicationId,
          );

        /* ===============================
           THIS LENDER'S DOCUMENT REQUESTS
        =============================== */
        const lenderRequests =
          await fastify.prisma.lenderDocumentRequest.findMany({
            where: {
              applicationLenderId,
              loanApplicationId,
            },
            select: { documentTypeId: true },
          });

        const lenderRequestedTypeIds = new Set(
          lenderRequests.map((row) => row.documentTypeId),
        );

        /* ===============================
           FETCH REQUIREMENTS (GLOBAL)
        =============================== */
        const requirements =
          await fastify.prisma.applicationDocumentRequirement.findMany({
            where: {
              loanApplicationId,
            },
            include: {
              documentType: true,
              requestedBySubBroker: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          });

        /* ===============================
           REQUIREMENTS SHARED WITH THIS LENDER
        =============================== */
        const submissions =
          await fastify.prisma.applicationDocumentSubmission.findMany({
            where: { applicationLenderId },
            select: {
              documentUpload: {
                select: { documentRequirementId: true },
              },
            },
          });

        const sharedRequirementIds = [
          ...new Set(
            submissions
              .map((sub) => sub.documentUpload?.documentRequirementId)
              .filter(Boolean),
          ),
        ];

        const sharedRequirementIdSet = new Set(sharedRequirementIds);

        const isRequirementVisibleToLender = (reqDoc) => {
          if (reqDoc.status === "SKIPPED") return false;
          if (reqDoc.requiresClientSignature) return false;

          if (reqDoc.source === "LENDER_ADDED") {
            return lenderRequestedTypeIds.has(reqDoc.documentTypeId);
          }

          if (
            reqDoc.source === "BROKER_ADDED" ||
            reqDoc.source === "SUB_BROKER_ADDED"
          ) {
            return sharedRequirementIdSet.has(reqDoc.id);
          }

          if (lenderRequestedTypeIds.has(reqDoc.documentTypeId)) {
            return true;
          }

          return sharedRequirementIdSet.has(reqDoc.id);
        };

        const uploadInclude = {
          uploadedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          uploadedByClientUser: {
            select: {
              id: true,
              email: true,
            },
          },
          subBrokerSubmissions: {
            include: {
              submittedBy: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        };

        const uploadsByRequirement = new Map();

        if (sharedRequirementIds.length > 0) {
          const sharedUploads =
            await fastify.prisma.applicationDocumentUpload.findMany({
              where: {
                loanApplicationId,
                documentRequirementId: { in: sharedRequirementIds },
              },
              include: uploadInclude,
              orderBy: { uploadedAt: "desc" },
            });

          for (const upload of sharedUploads) {
            if (!upload.documentRequirementId) continue;

            if (!uploadsByRequirement.has(upload.documentRequirementId)) {
              uploadsByRequirement.set(upload.documentRequirementId, []);
            }

            uploadsByRequirement.get(upload.documentRequirementId).push(upload);
          }
        }

        const formatUploadedFile = (upload, reqDoc, coBrokerSourceName) => {
          const submissionSubmitter = upload.subBrokerSubmissions?.[0]?.submittedBy;
          const submitterName = formatUserName(submissionSubmitter);
          const uploaderName = formatUserName(upload.uploadedByUser);

          let uploadedBy = null;

          if (reqDoc.source === "SUB_BROKER_ADDED") {
            const displayName = submitterName || coBrokerSourceName || uploaderName;
            if (displayName) {
              uploadedBy = {
                type: "SUB_BROKER",
                userId:
                  submissionSubmitter?.id || upload.uploadedByUser?.id || null,
                name: displayName,
                email: upload.uploadedByUser?.email || null,
              };
            }
          } else if (upload.uploadedByUser) {
            uploadedBy = {
              type: "BROKER",
              userId: upload.uploadedByUser.id,
              name: uploaderName || "Broker",
              email: upload.uploadedByUser.email,
            };
          } else if (upload.uploadedByClientUser) {
            uploadedBy = {
              type: "CLIENT",
              userId: upload.uploadedByClientUser.id,
              email: upload.uploadedByClientUser.email,
            };
          }

          return {
            uploadId: upload.id,
            fileName: upload.fileName,
            fileUrl: upload.fileUrl,
            fileMimeType: upload.fileMimeType,
            uploadedAt: upload.uploadedAt,
            uploadedBy,
          };
        };

        /* ===============================
           FORMAT DOCUMENTS
        =============================== */
        const documents = requirements
          .filter(isRequirementVisibleToLender)
          .map((reqDoc) => {
          const uploads = uploadsByRequirement.get(reqDoc.id) || [];
          const uploadedCount = uploads.length;
          const sourceLabel = resolveLenderDocumentSourceLabel(reqDoc, {
            brokerOrgName,
            brokerUserName,
            lenderName,
            uploads,
            assignmentNamesBySubBrokerId,
          });

          return {
            requirementId: reqDoc.id,
            documentTypeId: reqDoc.documentTypeId,
            documentName: reqDoc.documentType?.name ?? null,
            source: reqDoc.source,
            sourceLabel,
            isRequired: reqDoc.isRequired,

            status:
              reqDoc.status === "SKIPPED"
                ? "SKIPPED"
                : uploadedCount === 0
                  ? "PENDING"
                  : reqDoc.status === "COMPLETE"
                    ? "COMPLETE"
                    : "PARTIAL",

            uploadedCount,

            uploadedFiles: uploads.map((upload) =>
              formatUploadedFile(upload, reqDoc, sourceLabel),
            ),
          };
        });

        const visibleDocuments = documents.filter(
          (doc) => doc.uploadedCount > 0 || doc.isRequired,
        );

        const sourceFilteredDocuments = visibleDocuments.filter((doc) =>
          matchesLenderDocumentSourceFilter(doc, activeSourceFilter),
        );

        const filteredDocuments = searchTerm
          ? sourceFilteredDocuments.filter((doc) => {
              const documentName = (doc.documentName || "").toLowerCase();
              const sourceLabel = (doc.sourceLabel || "").toLowerCase();
              const source = (doc.source || "").toLowerCase();

              return (
                documentName.includes(searchTerm) ||
                sourceLabel.includes(searchTerm) ||
                source.includes(searchTerm)
              );
            })
          : sourceFilteredDocuments;

        /* ===============================
           PENDING COUNT
        =============================== */
        const pendingCount = visibleDocuments.filter(
          (d) => d.uploadedCount === 0,
        ).length;

        const { documents: paginatedDocuments, pagination } = paginateDocuments(
          filteredDocuments,
          pageNumber,
          pageSize,
        );

        /* ===============================
           RESPONSE
        =============================== */
        return reply.send({
          success: true,
          data: {
            applicationLenderId,
            loanApplicationId,
            documentsPendingCount: pendingCount,
            totalDocumentsCount: visibleDocuments.length,
            activeFilters: {
              search: searchTerm || null,
              sourceFilter: activeSourceFilter,
            },
            pagination,
            documents: paginatedDocuments,
          },
        });
      } catch (error) {
        fastify.log.error({
          error: error.message,
          route: "lender-view-documents",
        });

        return reply.code(500).send({
          success: false,
          message: "Server error while fetching documents",
        });
      }
    },
  );
};
