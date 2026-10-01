/**
 * Public (no auth) counterpart of
 * /broker/loan-pipeline/submissions/:submissionId/documents/:requirementId/upload.
 *
 * Lets a borrower who just submitted a public embed upload files for a
 * document requirement that exists on their freshly created loanApplication.
 *
 * Auth gate: the submission must belong to a loan application whose
 * `publicSourcePortal` is set, and the requirement must belong to the
 * same loan application.
 */

const { validateFileMimetype } = require("../../../../utils/security/fileValidator");
const {
  saveLoanDocumentFile,
} = require("../../../../services/documents/saveLoanDocumentFile");

async function uploadDocumentRoute(fastify) {
  fastify.post(
    "/submissions/:submissionId/documents/:requirementId/upload",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute",
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Too Many Requests",
            success: false,
            message: "Too many uploads. Please slow down.",
          }),
        },
      },
    },
    async (req, reply) => {
      try {
        const { submissionId, requirementId } = req.params;

        const submission = await fastify.prisma.applicationSubmission.findUnique(
          {
            where: { id: submissionId },
            include: {
              application: {
                select: {
                  id: true,
                  publicSourcePortal: true,
                },
              },
            },
          },
        );

        if (!submission) {
          return reply.code(404).send({
            success: false,
            message: "Submission not found",
          });
        }

        if (!submission.application.publicSourcePortal) {
          return reply.code(404).send({
            success: false,
            message: "Submission not found",
          });
        }

        const requirement =
          await fastify.prisma.applicationDocumentRequirement.findUnique({
            where: { id: requirementId },
          });

        if (!requirement) {
          return reply.code(404).send({
            success: false,
            message: "Document requirement not found",
          });
        }

        if (requirement.loanApplicationId !== submission.application.id) {
          return reply.code(400).send({
            success: false,
            message: "Requirement does not belong to this submission",
          });
        }

        const file = await req.file();

        if (!file) {
          return reply.code(400).send({
            success: false,
            message: "No file uploaded",
          });
        }

        const allowedMimeTypes = [
          "application/pdf",
          "image/jpeg",
          "image/png",
          "image/webp",
        ];

        const validation = await validateFileMimetype(file.file, allowedMimeTypes);
        if (!validation.isValid) {
          return reply.code(400).send({
            success: false,
            message: `Invalid file type. Detected: ${validation.detectedMime || "unknown"}. Only PDF, JPG, PNG, WEBP allowed`,
          });
        }
        const validatedStream = validation.stream;

        if (file.file.truncated) {
          return reply.code(400).send({
            success: false,
            message: "File too large",
          });
        }

        const stored = await saveLoanDocumentFile({
          prisma: fastify.prisma,
          stream: validatedStream,
          originalFileName: file.filename,
          mimeType: file.mimetype,
          applicationId: submission.application.id,
          requirementId,
        });
        const { fileUrl, storageKey, storageProvider } = stored;

        await fastify.prisma.$transaction(async (tx) => {
          await tx.applicationDocumentUpload.create({
            data: {
              loanApplicationId: submission.application.id,
              documentRequirementId: requirementId,
              uploadedByUserId: null,
              fileName: file.filename,
              fileUrl,
              storageKey,
              storageProvider,
              fileMimeType: file.mimetype,
              isSubmittedToLender: false,
            },
          });

          const totalUploads = await tx.applicationDocumentUpload.count({
            where: { documentRequirementId: requirementId },
          });

          let newStatus = "PARTIAL";
          if (requirement.minFiles && totalUploads >= requirement.minFiles) {
            newStatus = "COMPLETE";
          }

          await tx.applicationDocumentRequirement.update({
            where: { id: requirementId },
            data: { status: newStatus },
          });
        });

        return reply.send({
          success: true,
          message: "Document uploaded successfully",
          fileUrl,
        });
      } catch (error) {
        fastify.log.error({
          error: error.message,
          stack: error.stack,
          route: "public-upload-document",
        });
        return reply.code(500).send({
          success: false,
          message: "Server error while uploading document",
        });
      }
    },
  );
}

module.exports = uploadDocumentRoute;
