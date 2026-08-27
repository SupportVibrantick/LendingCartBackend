/**
 * Public (no auth) counterpart of
 * /broker/loan-pipeline/submissions/:submissionId/documents.
 *
 * Lists the document requirements (and their uploads) for a public-embed
 * loan application so the borrower's client can match each staged file to
 * the right requirement before uploading.
 *
 * Auth gate: same as upload — submission must belong to a public-sourced
 * loan application.
 */

async function listDocumentsRoute(fastify) {
  fastify.get(
    "/submissions/:submissionId/documents",
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Too Many Requests",
            success: false,
            message: "Too many requests. Please slow down.",
          }),
        },
      },
    },
    async (req, reply) => {
      try {
        const { submissionId } = req.params;
        const limit = Math.min(parseInt(req.query?.limit) || 100, 100);

        const submission =
          await fastify.prisma.applicationSubmission.findUnique({
            where: { id: submissionId },
            include: {
              application: {
                select: {
                  id: true,
                  publicSourcePortal: true,
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

        if (!submission.application.publicSourcePortal) {
          return reply.code(403).send({
            success: false,
            message:
              "Submission is not eligible for public document listing",
          });
        }

        const requirements =
          await fastify.prisma.applicationDocumentRequirement.findMany({
            where: { loanApplicationId: submission.application.id },
            take: limit,
            include: {
              documentType: { select: { id: true, name: true } },
              uploads: {
                select: {
                  id: true,
                  fileName: true,
                  fileUrl: true,
                  fileMimeType: true,
                  uploadedAt: true,
                },
              },
            },
          });

        return reply.send({
          success: true,
          data: {
            documents: requirements.map((reqRow) => ({
              requirementId: reqRow.id,
              documentTypeId: reqRow.documentTypeId,
              documentName: reqRow.documentType?.name ?? null,
              status: reqRow.status,
              uploads: reqRow.uploads,
            })),
          },
        });
      } catch (error) {
        fastify.log.error({
          error: error.message,
          stack: error.stack,
          route: "public-list-documents",
        });
        return reply.code(500).send({
          success: false,
          message: error.message || "Server error",
        });
      }
    },
  );
}

module.exports = listDocumentsRoute;
