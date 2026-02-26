/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function lenderViewDocuments(fastify) {
  fastify.get(
    "/lender/applications/:applicationLenderId/documents",
    async (req, reply) => {
      try {
        // ===============================
        //  AUTH CHECK (LENDER ONLY)
        // ===============================
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

        // ===============================
        // VALIDATE APPLICATION ACCESS
        // ===============================
        const applicationLender =
          await fastify.prisma.applicationLender.findFirst({
            where: {
              id: applicationLenderId,
              lenderOrgId,
            },
            include: {
              loanApplication: {
                include: {
                  documentRequirements: {
                    include: {
                      documentType: true,
                      uploads: {
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

        if (!applicationLender) {
          return reply.code(404).send({
            success: false,
            message: "Application not found for this lender",
          });
        }

        const loanApplication = applicationLender.loanApplication;

        // ===============================
        // FORMAT DOCUMENTS
        // ===============================
        const documents =
          loanApplication.documentRequirements.map((req) => {
            const uploadedCount = req.uploads.length;

            return {
              requirementId: req.id,
              documentTypeId: req.documentTypeId,
              documentName: req.documentType?.name ?? null,
              source: req.source, // LENDER_DEFAULT / PRODUCT_DEFAULT
              isRequired: req.isRequired,
              status: req.status, // PENDING / PARTIAL / COMPLETE
              uploadedCount,
              uploadedFiles: req.uploads.map((upload) => ({
                uploadId: upload.id,
                fileName: upload.fileName,
                fileUrl: upload.fileUrl,
                fileMimeType: upload.fileMimeType,
                uploadedAt: upload.uploadedAt,
                uploadedBy:
                  upload.uploadedByUser
                    ? {
                        type: "BROKER",
                        userId: upload.uploadedByUser.id,
                        name: `${upload.uploadedByUser.firstName ?? ""} ${upload.uploadedByUser.lastName ?? ""}`.trim(),
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

        const pendingCount = documents.filter(
          (d) => d.status !== "COMPLETE"
        ).length;

        // ===============================
        //  RESPONSE
        // ===============================
        return reply.send({
          success: true,
          data: {
            applicationLenderId,
            loanApplicationId: loanApplication.id,
            documentsPendingCount: pendingCount,
            documents,
          },
        });
      } catch (error) {
        fastify.log.error(error);

        return reply.code(500).send({
          success: false,
          message: "Server error while fetching documents",
        });
      }
    }
  );
};