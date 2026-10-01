const { validateFileMimetype } = require("../../../utils/security/fileValidator");
const {
  autoForwardDocumentUpload,
} = require("../../../services/documents/autoForwardDocumentUpload");
const {
  notifyLendersForForwardedDocument,
} = require("../../../services/notifications/lenderNotifications");
const {
  getAutoForwardDocumentsToLender,
} = require("../../../services/documents/documentAutoForwardSetting");
const {
  syncUploadToExistingLenderSubmissions,
} = require("../../../services/documents/syncUploadToExistingLenderSubmissions");
const {
  saveLoanDocumentFile,
} = require("../../../services/documents/saveLoanDocumentFile");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function uploadSubmissionDocument(fastify) {
  fastify.post(
    "/submissions/:submissionId/documents/:requirementId/upload",
    async (req, reply) => {
      try {
        fastify.log.info({ submissionId: req.params.submissionId }, "Entering uploadDocumentRoute");
        /* ===============================
           AUTH CHECK (BROKER ONLY)
        =============================== */
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

        /* ===============================
           VALIDATE SUBMISSION + OWNERSHIP
        =============================== */
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

        /* ===============================
           VALIDATE REQUIREMENT
        =============================== */
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

        /* ===============================
           HANDLE FILE
        =============================== */
        fastify.log.info("Fetching file from request");
        const file = await req.file();
        fastify.log.info({ filename: file?.filename }, "File received");

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

        fastify.log.info("Validating file mimetype");
        const validation = await validateFileMimetype(file.file, allowedMimeTypes);
        fastify.log.info({ isValid: validation.isValid, mime: validation.detectedMime }, "Mimetype validation complete");

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

        /* ===============================
           SAVE FILE (local or S3)
        =============================== */
        fastify.log.info("Saving file via storage provider");
        const stored = await saveLoanDocumentFile({
          prisma: fastify.prisma,
          stream: validatedStream,
          originalFileName: file.filename,
          mimeType: file.mimetype,
          applicationId: submission.application.id,
          requirementId,
        });
        const { fileUrl, storageKey, storageProvider } = stored;
        fastify.log.info({ storageProvider, storageKey }, "File saved successfully");

        /* ===============================
           TRANSACTION (SAVE + STATUS)
        =============================== */
        fastify.log.info("Creating upload record");
        const createdUpload = await fastify.prisma.applicationDocumentUpload.create({
          data: {
            loanApplicationId: submission.application.id,
            documentRequirementId: requirementId,
            uploadedByUserId: userId,

            fileName: file.filename,
            fileUrl,
            storageKey,
            storageProvider,
            fileMimeType: file.mimetype,

            isSubmittedToLender: false,
          },
        });
        fastify.log.info("Upload record created");

        processDocumentPostUpload(fastify, submission, requirementId, createdUpload).catch(err => {
          fastify.log.error({ err }, "Unexpected error in background post-upload process");
        });

        return reply.send({
          success: true,
          message: "Document uploaded successfully",
          fileUrl,
        });
      } catch (error) {
        fastify.log.error({
          error: error.message,
          route: "upload-document",
        });

        return reply.code(500).send({
          success: false,
          message: "Server error while uploading document",
        });
      }
    },
  );
};

async function processDocumentPostUpload(fastify, submission, requirementId, createdUpload) {
  try {
    await fastify.prisma.$transaction(async (tx) => {
      const requirement = await tx.applicationDocumentRequirement.findUnique({
        where: { id: requirementId },
      });

      if (requirement) {
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

        if (requirement.source === "SUB_BROKER_ADDED") {
          await tx.subBrokerSubmission.updateMany({
            where: {
              documentUpload: { documentRequirementId: requirementId },
              status: "PENDING",
            },
            data: { status: "REVIEWED", reviewedAt: new Date() },
          });
        }
      }
    });

    const autoForwardEnabled = await getAutoForwardDocumentsToLender(
      fastify.prisma,
      submission.application.id,
    );

    if (autoForwardEnabled) {
      try {
        const forwardResult = await autoForwardDocumentUpload(
          fastify.prisma,
          {
            loanApplicationId: submission.application.id,
            documentRequirementId: requirementId,
            documentUploadId: createdUpload.id,
          },
        );

        if (forwardResult.forwarded) {
          const requirement = await fastify.prisma.applicationDocumentRequirement.findUnique({
            where: { id: requirementId },
            select: {
              documentType: { select: { name: true } },
            },
          });

          await notifyLendersForForwardedDocument(fastify.prisma, fastify.io, {
            applicationLenderIds: forwardResult.applicationLenderIds || [],
            loanApplicationId: submission.application.id,
            applicationNumber: submission.application.applicationNumber,
            documentTypeName:
              requirement?.documentType?.name || createdUpload.fileName,
            source: "Broker",
          });
        }
      } catch (forwardErr) {
        fastify.log.error(
          {
            error: forwardErr.message,
            loanApplicationId: submission.application.id,
            documentRequirementId: requirementId,
            documentUploadId: createdUpload.id,
          },
          "Auto-forward broker document failed",
        );
      }
    }

    try {
      await syncUploadToExistingLenderSubmissions(fastify.prisma, {
        loanApplicationId: submission.application.id,
        documentRequirementId: requirementId,
        documentUploadId: createdUpload.id,
      });
    } catch (syncErr) {
      fastify.log.error(
        {
          error: syncErr.message,
          loanApplicationId: submission.application.id,
          documentRequirementId: requirementId,
          documentUploadId: createdUpload.id,
        },
        "Sync upload to existing lender submissions failed",
      );
    }
  } catch (error) {
    fastify.log.error(
      {
        error: error.message,
        loanApplicationId: submission?.application?.id,
        documentRequirementId: requirementId,
        documentUploadId: createdUpload?.id,
      },
      "Post-upload processing failed",
    );
  }
}
