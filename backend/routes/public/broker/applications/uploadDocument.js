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

const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const crypto = require("crypto");

async function uploadDocumentRoute(fastify) {
  fastify.post(
    "/submissions/:submissionId/documents/:requirementId/upload",
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
          return reply.code(403).send({
            success: false,
            message:
              "Submission is not eligible for public document upload",
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

        if (!allowedMimeTypes.includes(file.mimetype)) {
          return reply.code(400).send({
            success: false,
            message: "Invalid file type. Only PDF, JPG, PNG, WEBP allowed",
          });
        }

        if (file.file.truncated) {
          return reply.code(400).send({
            success: false,
            message: "File too large",
          });
        }

        const randomName = crypto.randomBytes(16).toString("hex");
        const originalExt = path.extname(file.filename || "");
        const safeExt = originalExt || getExtensionFromMime(file.mimetype);
        const safeFileName = `${randomName}${safeExt}`;

        const uploadDir = path.join(
          process.cwd(),
          "uploads",
          "loan-documents",
          submission.application.id,
          requirementId,
        );

        await fs.promises.mkdir(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, safeFileName);
        const fileUrl = `/uploads/loan-documents/${submission.application.id}/${requirementId}/${safeFileName}`;

        await pipeline(file.file, fs.createWriteStream(filePath));

        await fastify.prisma.$transaction(async (tx) => {
          await tx.applicationDocumentUpload.create({
            data: {
              loanApplicationId: submission.application.id,
              documentRequirementId: requirementId,
              uploadedByUserId: null,
              fileName: file.filename,
              fileUrl,
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

function getExtensionFromMime(mime) {
  switch (mime) {
    case "application/pdf":
      return ".pdf";
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return "";
  }
}

module.exports = uploadDocumentRoute;
