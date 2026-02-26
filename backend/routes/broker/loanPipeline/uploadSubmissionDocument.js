const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const crypto = require("crypto");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function uploadSubmissionDocument(fastify) {
  fastify.post(
    "/submissions/:submissionId/documents/:requirementId/upload",
    async (req, reply) => {
      try {
        // ===============================
        // AUTH CHECK (BROKER ONLY)
        // ===============================
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = req.user.organizationId;
        const userId = req.user.id;

        if (!brokerOrgId) {
          return reply.code(403).send({
            success: false,
            message: "Broker context not resolved",
          });
        }

        const { submissionId, requirementId } = req.params;

        // ===============================
        // VALIDATE SUBMISSION + OWNERSHIP
        // ===============================
        const submission =
          await fastify.prisma.applicationSubmission.findUnique({
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

        // ===============================
        // VALIDATE REQUIREMENT
        // ===============================
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

        // ===============================
        // HANDLE FILE
        // ===============================
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

        // ===============================
        // CREATE SAFE FILE NAME
        // ===============================
        const randomName = crypto.randomBytes(16).toString("hex");

        const originalExt = path.extname(file.filename || "");
        const safeExt = originalExt || getExtensionFromMime(file.mimetype);

        const safeFileName = `${randomName}${safeExt}`;

        // ===============================
        // FIXED UPLOAD DIRECTORY
        // ===============================
        const uploadDir = path.join(
          process.cwd(),
          "uploads",
          "loan-documents"
        );

        await fs.promises.mkdir(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, safeFileName);

        // ===============================
        // SAVE FILE (STREAM SAFE)
        // ===============================
        const writeStream = fs.createWriteStream(filePath);
        await pipeline(file.file, writeStream);

        const fileUrl = `/uploads/loan-documents/${safeFileName}`;

        // ===============================
        // TRANSACTION (SAVE + UPDATE STATUS)
        // ===============================
        await fastify.prisma.$transaction(async (tx) => {
          await tx.applicationDocumentUpload.create({
            data: {
              loanApplicationId: submission.application.id,
              documentRequirementId: requirementId,
              uploadedByUserId: userId,
              fileName: file.filename,
              fileUrl,
              fileMimeType: file.mimetype,
            },
          });

          const totalUploads =
            await tx.applicationDocumentUpload.count({
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
        fastify.log.error(error);

        return reply.code(500).send({
          success: false,
          message: "Server error while uploading document",
        });
      }
    }
  );
};

// ===============================
// Helper function for extension fallback
// ===============================
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