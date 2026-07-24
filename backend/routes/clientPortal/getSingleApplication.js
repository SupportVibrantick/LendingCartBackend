const jwt = require("jsonwebtoken");
const { mapSubmissionFieldResponse } = require("../../services/applications/staticSubmissionFields");
const {
  resolveClientDisplayNameFromData,
} = require("../../services/messaging/resolveClientDisplayName");
const { resolveApplicationStatus } = require("../../utils/applications/resolveApplicationStatus");
const { mapClientPortalDocuments } = require("../../utils/documents/mapClientPortalDocuments");
const {
  canClientSignApplication,
  resolveLatestActiveSubmission,
} = require("../../utils/applications/clientPortalSubmission");
const {
  resolveClientPortalAccess,
} = require("../../utils/auth/clientPortalAuth");

function findSubmissionFieldValue(fields, keys) {
  const field = fields.find((item) => keys.includes(item.fieldKey));
  if (!field) return null;
  return field.value ?? null;
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function getClientApplicationDetailsRoute(fastify) {
  fastify.get("/applications/:id", async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      const access = await resolveClientPortalAccess(prisma, req, {
        applicationId: req.params.id,
      });

      if (access.error) {
        return reply.code(access.error.code).send({
          success: false,
          message: access.error.message,
        });
      }

      const clientId = access.clientId;
      const applicationId = access.applicationId;

      const application = await prisma.loanApplication.findFirst({
        where: {
          id: applicationId,
          clientId,
        },
        include: {
          submissions: {
            where: { status: { not: "SUPERSEDED" } },
            orderBy: { createdAt: "desc" },
            include: {
              fields: {
                include: {
                  builderField: {
                    include: {
                      section: true,
                    },
                  },
                },
              },
            },
          },
          documentRequirements: {
            include: {
              documentType: true,
              uploads: true,
            },
          },
          collaterals: true,
          financials: true,
          statusHistory: true,
          client: {
            include: {
              contacts: true,
            },
          },
          brokerOrg: true,
          applicationLenders: true,
        },
      });

      if (!application) {
        return reply.code(404).send({
          success: false,
          message: "Application not found",
        });
      }

      const feeAgreement = await prisma.feeAgreement.findUnique({
        where: {
          loanApplicationId: application.id,
        },
      });

      const loanProduct = await prisma.loanProduct.findFirst({
        where: {
          code: application.loanProductCode,
        },
        select: {
          id: true,
          name: true,
        },
      });

      const latestSubmission = resolveLatestActiveSubmission(
        application.submissions || [],
      );

      const mappedFields = latestSubmission
        ? latestSubmission.fields.map((field) => mapSubmissionFieldResponse(field))
        : [];

      const borrowerName = resolveClientDisplayNameFromData(
        application.client,
        latestSubmission
          ? [
              {
                fields: latestSubmission.fields.map((field) => ({
                  fieldKey: field.builderField?.fieldKey || field.fieldKey,
                  value: field.value,
                  builderField: field.builderField,
                })),
              },
            ]
          : [],
      );

      const creditScore = findSubmissionFieldValue(mappedFields, [
        "creditScore",
        "credit_score",
      ]);

      const amountRequested =
        Number(
          findSubmissionFieldValue(mappedFields, [
            "amountRequested",
            "loan_amount",
            "loanAmount",
          ]),
        ) ||
        application.amountRequested ||
        0;

      const loanProductCode =
        findSubmissionFieldValue(mappedFields, [
          "loanProductCode",
          "loan_product",
          "productCode",
        ]) || application.loanProductCode || null;

      const borrowerEmail =
        findSubmissionFieldValue(mappedFields, ["email", "borrowerEmail"]) ||
        application.client?.contacts?.[0]?.email ||
        "";

      const borrowerPhone =
        findSubmissionFieldValue(mappedFields, [
          "phone",
          "mobile",
          "borrowerPhone",
        ]) ||
        application.client?.contacts?.[0]?.phone ||
        "";

      const propertyAddress =
        findSubmissionFieldValue(mappedFields, [
          "propertyAddress",
          "property_address",
          "businessAddress",
          "business_address",
        ]) || "";

      const borrowerSignature =
        findSubmissionFieldValue(mappedFields, ["borrowerSignature"]) || null;

      const documents = mapClientPortalDocuments(
        application.documentRequirements || [],
      );

      const signatureState = canClientSignApplication({
        status: application.status,
        submittedAt: application.submittedAt,
        createdAt: application.createdAt,
        borrowerSignature,
        submissions: application.submissions,
        latestSubmission,
      });

      const enrichedSubmission = latestSubmission
        ? {
            ...latestSubmission,
            fields: mappedFields,
          }
        : null;

      return reply.send({
        success: true,
        data: {
          ...application,
          status: resolveApplicationStatus(application),
          submissions: enrichedSubmission ? [enrichedSubmission] : [],
          amountRequested,
          loanProductCode,
          creditScore,
          loanProduct: loanProduct
            ? {
                id: loanProduct.id,
                name: loanProduct.name,
              }
            : null,
          borrowerName,
          borrowerEmail,
          borrowerPhone,
          propertyAddress,
          borrowerSignature,
          documents,
          latestSubmission: enrichedSubmission,
          canClientSign: signatureState.allowed,
          clientSignBlockedReason: signatureState.reason || null,
          alreadySigned: Boolean(signatureState.alreadySigned),
          feeAgreement: feeAgreement || null,
        },
      });
    } catch (error) {
      fastify.log.error(
        { error: error.message },
        "Fetch application failed",
      );

      return reply.code(500).send({
        success: false,
        message: error.message || "Unexpected server error",
      });
    }
  });
}

module.exports = getClientApplicationDetailsRoute;
