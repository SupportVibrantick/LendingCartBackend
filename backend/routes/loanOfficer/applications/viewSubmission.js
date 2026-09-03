module.exports = async function viewSubmission(fastify) {
  const { mapSubmissionFieldResponse } = require("../../../services/applications/staticSubmissionFields");
  const {
    resolveBrokerPipelineDisplayStatus,
    canBrokerRequestDocuments,
    canBrokerEditSubmittedApplication,
  } = require("../../../utils/applications/resolveApplicationStatus");
  const {
    APPLICATION_LENDER_SUBMISSION_INCLUDE,
    formatSubmissionApplicationLenders,
  } = require("../../../utils/applications/submissionApplicationLenders");
  fastify.get("/submissions/:submissionId", async (req, reply) => {
    const { submissionId } = req.params;

    if (!req.user || req.user.orgType !== "BROKER") {
      return reply.code(403).send({ success: false, message: "Unauthorized" });
    }

    const userId = req.user.id || req.user.userId;
    const orgId = req.user.organizationId;
    const { officerAssignedApplicationWhere } = require("../../../services/broker/loanOfficerAccess");

    /* ===============================
       FETCH SUBMISSION + EXTRA DATA
    =============================== */
    const submission = await fastify.prisma.applicationSubmission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        applicationId: true,
        applicationProductId: true,
        status: true,
        createdAt: true,
        fields: {
          select: {
            id: true,
            value: true,
            fieldKey: true,
            builderField: {
              select: {
                fieldKey: true,
                section: { select: { name: true } },
              },
            },
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

    const application = await fastify.prisma.loanApplication.findUnique({
      where: { id: submission.applicationId },
      select: {
        id: true,
        applicationNumber: true,
        loanProductCode: true,
        brokerOrgId: true,
        brokerUserId: true,
        status: true,
        amountRequested: true,
        client: {
          select: {
            id: true,
            contacts: {
              where: { isPrimary: true },
              take: 1,
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!application) {
      return reply.code(404).send({
        success: false,
        message: "Application not found",
      });
    }

    const owned = await fastify.prisma.loanApplication.findFirst({
      where: {
        id: submission.applicationId,
        brokerOrgId: orgId,
        ...officerAssignedApplicationWhere(userId),
      },
      select: { id: true },
    });

    if (!owned) {
      return reply.code(403).send({
        success: false,
        message: "Access denied - not assigned to you",
      });
    }

    const appLenders = await fastify.prisma.applicationLender.findMany({
      where: { loanApplicationId: submission.applicationId },
      include: APPLICATION_LENDER_SUBMISSION_INCLUDE,
    });

    const applicationWithLenders = {
      ...application,
      applicationLenders: appLenders,
    };

    /* ===============================
       FETCH LOAN PRODUCT NAME
    =============================== */
    const loanProduct = await fastify.prisma.loanProduct.findFirst({
      where: {
        code: application.loanProductCode,
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    /* ===============================
       BORROWER NAME
    =============================== */
    const primaryContact =
      application.client?.contacts?.[0] || null;

    const borrowerName = primaryContact
      ? `${primaryContact.firstName ?? ""} ${
          primaryContact.lastName ?? ""
        }`.trim()
      : null;

    /* ===============================
       🔥 EXTRACT IMPORTANT FIELDS
    =============================== */

    // ✅ CREDIT SCORE
    const creditScoreField = submission.fields.find(
      (f) =>
        f.builderField?.fieldKey === "creditScore" ||
        f.builderField?.fieldKey === "credit_score" ||
        f.fieldKey === "creditScore" ||
        f.fieldKey === "credit_score"
    );

    const creditScore = creditScoreField?.value ?? null;

    // ✅ AMOUNT REQUESTED (FIXED)
    const amountField = submission.fields.find(
      (f) =>
        f.builderField?.fieldKey === "amountRequested" ||
        f.builderField?.fieldKey === "loan_amount" ||
        f.fieldKey === "amountRequested" ||
        f.fieldKey === "loan_amount"
    );

    const amountRequested = amountField?.value ?? null;

    const applicationStatus = application?.status ?? null;
    const pipelineStatus = resolveBrokerPipelineDisplayStatus(
      applicationWithLenders,
    );
    const editCheck = canBrokerEditSubmittedApplication(applicationWithLenders);
    const documentRequestCheck = canBrokerRequestDocuments(
      applicationWithLenders,
    );

    /* ===============================
       RESPONSE
    =============================== */
    return reply.send({
      success: true,
      data: {
        submissionId: submission.id,
        applicationId: submission.applicationId,
        applicationNumber: application.applicationNumber,

        borrowerName,

        loanProduct: loanProduct
          ? {
              id: loanProduct.id,
              name: loanProduct.name,
              code: loanProduct.code,
            }
          : null,

        // ✅ FIXED VALUES
        amountRequested,
        creditScore,

        applicationProductId: submission.applicationProductId,
        status: pipelineStatus,
        submissionStatus: submission.status,
        pipelineStatus,
        applicationStatus,
        canEdit: editCheck.allowed,
        editBlockedReason: editCheck.allowed ? null : editCheck.reason,
        canRequestDocuments: documentRequestCheck.allowed,
        documentRequestBlockedReason: documentRequestCheck.allowed
          ? null
          : documentRequestCheck.reason,
        submittedAt: submission.createdAt,

        /* ================= FIELDS ================= */
        fields: submission.fields.map((f) => mapSubmissionFieldResponse(f)),

        /* ================= LENDER REVIEWS ================= */
        lenders: formatSubmissionApplicationLenders(appLenders),
      },
    });
  });
};
