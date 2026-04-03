/**
 * @param {import("fastify").FastifyInstance} fastify
 */
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
            include: {
              loanApplication: {
                select: {
                  id: true,
                  documentRequirements: {
                    include: {
                      documentType: true,

                      // 🔥 CRITICAL FIX: ONLY SUBMITTED DOCS
                      uploads: {
                        where: {
                          isSubmittedToLender: true,
                        },
                        include: {
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
                        },
                        orderBy: {
                          uploadedAt: "desc",
                        },
                      },
                    },
                  },
                },
              },
            },
          });

        if (!applicationLender || !applicationLender.loanApplication) {
          return reply.code(404).send({
            success: false,
            message: "Application not found for this lender",
          });
        }

        const loanApplication = applicationLender.loanApplication;

        /* ===============================
           FORMAT DOCUMENTS (SAFE)
        =============================== */
        const documents = loanApplication.documentRequirements.map((reqDoc) => {
          const uploads = reqDoc.uploads || [];
          const uploadedCount = uploads.length;

          return {
            requirementId: reqDoc.id,
            documentTypeId: reqDoc.documentTypeId,
            documentName: reqDoc.documentType?.name ?? null,
            source: reqDoc.source,
            isRequired: reqDoc.isRequired,

            // 🔥 IMPORTANT: status should reflect ONLY submitted files
            status:
              uploadedCount === 0
                ? "PENDING"
                : reqDoc.status === "COMPLETE"
                ? "COMPLETE"
                : "PARTIAL",

            uploadedCount,

            uploadedFiles: uploads.map((upload) => ({
              uploadId: upload.id,
              fileName: upload.fileName,
              fileUrl: upload.fileUrl,
              fileMimeType: upload.fileMimeType,
              uploadedAt: upload.uploadedAt,

              uploadedBy: upload.uploadedByUser
                ? {
                    type: "BROKER",
                    userId: upload.uploadedByUser.id,
                    name: `${upload.uploadedByUser.firstName ?? ""} ${
                      upload.uploadedByUser.lastName ?? ""
                    }`.trim(),
                    email: upload.uploadedByUser.email,
                  }
                : upload.uploadedByClientUser
                ? {
                    type: "CLIENT",
                    userId: upload.uploadedByClientUser.id,
                    email: upload.uploadedByClientUser.email,
                  }
                : null,
            })),
          };
        });

        /* ===============================
           FILTER EMPTY DOCS (OPTIONAL CLEAN UX)
        =============================== */
        const visibleDocuments = documents.filter(
          (doc) => doc.uploadedCount > 0 || doc.isRequired
        );

        /* ===============================
           PENDING COUNT (SUBMITTED CONTEXT)
        =============================== */
        const pendingCount = visibleDocuments.filter(
          (d) => d.uploadedCount === 0
        ).length;

        /* ===============================
           RESPONSE
        =============================== */
        return reply.send({
          success: true,
          data: {
            applicationLenderId,
            loanApplicationId: loanApplication.id,
            documentsPendingCount: pendingCount,
            documents: visibleDocuments,
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
    }
  );
};