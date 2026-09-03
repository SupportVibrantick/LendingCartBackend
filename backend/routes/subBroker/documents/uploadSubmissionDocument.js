const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const crypto = require("crypto");
const { validateFileMimetype } = require("../../../utils/security/fileValidator");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function uploadSubmissionDocumentForSubBroker(fastify) {
  fastify.post(
    "/submissions/:submissionId/documents/:requirementId/upload",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(["SUB_BROKER"]),
      ],
    },
    async (req, reply) => {
      try {
        if (!req.user) {
          return reply.code(401).send({ success: false, message: "Authentication required" });
        }

        const prisma = fastify.prisma;
        const userId = req.user.userId;
        const { submissionId, requirementId } = req.params;

        const submission = await prisma.applicationSubmission.findUnique({
          where: { id: submissionId },
          include: { application: true },
        });

        if (!submission) {
          return reply.code(404).send({ success: false, message: "Submission not found" });
        }

        const assignment = await prisma.subBrokerApplication.findFirst({
          where: {
            loanApplicationId: submission.application.id,
            subBrokerId: userId,
          },
          select: { id: true },
        });

        if (!assignment) {
          return reply.code(403).send({ success: false, message: "Access denied for this loan" });
        }

        const requirement = await prisma.applicationDocumentRequirement.findUnique({
          where: { id: requirementId },
        });

        if (!requirement) {
          return reply.code(404).send({ success: false, message: "Document requirement not found" });
        }

        if (requirement.loanApplicationId !== submission.application.id) {
          return reply.code(400).send({ success: false, message: "Requirement does not belong to this submission" });
        }

        const file = await req.file();
        if (!file) {
          return reply.code(400).send({ success: false, message: "No file uploaded" });
        }

        const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
        const validation = await validateFileMimetype(file.file, allowedMimeTypes);
        if (!validation.isValid) {
          return reply.code(400).send({
            success: false,
            message: `Invalid file type. Detected: ${validation.detectedMime || "unknown"}. Only PDF, JPG, PNG, WEBP allowed`,
          });
        }
        const validatedStream = validation.stream;

        if (file.file.truncated) {
          return reply.code(400).send({ success: false, message: "File too large" });
        }

        const randomName = crypto.randomBytes(16).toString("hex");
        const originalExt = path.extname(file.filename || "");
        const safeExt = originalExt || getExtensionFromMime(file.mimetype);
        const safeFileName = `${randomName}${safeExt}`;

        const uploadDir = path.join(process.cwd(), "uploads", "loan-documents", submission.application.id, requirementId);
        await fs.promises.mkdir(uploadDir, { recursive: true });
        const filePath = path.join(uploadDir, safeFileName);

        const writeStream = fs.createWriteStream(filePath);
        await pipeline(validatedStream, writeStream);

        const fileUrl = `/uploads/loan-documents/${submission.application.id}/${requirementId}/${safeFileName}`;

        await prisma.$transaction(async (tx) => {
          await tx.applicationDocumentUpload.create({
            data: {
              loanApplicationId: submission.application.id,
              documentRequirementId: requirementId,
              uploadedByUserId: userId,
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
        fastify.log.error({ error: error.message, stack: error.stack, route: "subbroker-upload-document" });
        return reply.code(500).send({ success: false, message: error.message || "Server error while uploading document" });
      }
    },
  );
}

function getExtensionFromMime(mime) {
  switch (mime) {
    case "application/pdf": return ".pdf";
    case "image/jpeg": return ".jpg";
    case "image/png": return ".png";
    case "image/webp": return ".webp";
    default: return "";
  }
}

module.exports = uploadSubmissionDocumentForSubBroker;
