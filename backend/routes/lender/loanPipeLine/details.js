const { mapSubmissionFieldResponse } = require("../../../services/staticSubmissionFields");
const {
  resolveClientDisplayNameFromData,
} = require("../../../services/resolveClientDisplayName");
const {
  resolveLatestActiveSubmission,
} = require("../../../utils/clientPortalSubmission");

function findSubmissionFieldValue(fields, keys) {
  const field = fields.find((item) => keys.includes(item.fieldKey));
  if (!field) return null;
  return field.value ?? null;
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function getApplicationDetails(fastify) {
  fastify.get(
    "/:applicationLenderId",
    {
      schema: {
        tags: ["Lender -> Loan Pipeline"],
        summary: "Get full application details for lender",
        params: {
          type: "object",
          required: ["applicationLenderId"],
          properties: {
            applicationLenderId: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (
          !req.user ||
          req.user.orgType !== "LENDER" ||
          !req.user.organizationId
        ) {
          return reply.status(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const { applicationLenderId } = req.params;

        const record = await prisma.applicationLender.findFirst({
          where: {
            id: applicationLenderId,
            lenderOrgId,
          },
          include: {
            loanApplication: {
              include: {
                client: {
                  include: {
                    contacts: {
                      where: { isPrimary: true },
                      take: 1,
                    },
                  },
                },
                brokerOrg: true,
                financials: true,
                collaterals: true,
                documentUploads: true,
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
                ruleEvaluations: {
                  include: {
                    results: true,
                  },
                },
              },
            },
            lenderProduct: true,
            lenderReviews: {
              orderBy: {
                createdAt: "desc",
              },
              include: {
                conditions: true,
              },
            },
          },
        });

        if (!record) {
          return reply.status(404).send({
            success: false,
            message: "Application not found for this lender",
          });
        }

        const loanProduct = await prisma.loanProduct.findFirst({
          where: {
            code: record.loanApplication.loanProductCode,
          },
          select: {
            id: true,
            name: true,
          },
        });

        const latestSubmission = resolveLatestActiveSubmission(
          record.loanApplication.submissions || [],
        );

        const mappedFields = latestSubmission
          ? latestSubmission.fields.map((field) => mapSubmissionFieldResponse(field))
          : [];

        const borrowerName = resolveClientDisplayNameFromData(
          record.loanApplication.client,
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

        const amountRequested = findSubmissionFieldValue(mappedFields, [
          "amountRequested",
          "loan_amount",
        ]);

        const enrichedSubmission = latestSubmission
          ? {
              ...latestSubmission,
              fields: mappedFields,
            }
          : null;

        return reply.send({
          success: true,
          data: {
            ...record,
            borrowerName,
            creditScore,
            amountRequested,
            loanProduct: loanProduct
              ? {
                  id: loanProduct.id,
                  name: loanProduct.name,
                }
              : null,
            latestSubmission: enrichedSubmission,
            loanApplication: {
              ...record.loanApplication,
              submissions: enrichedSubmission ? [enrichedSubmission] : [],
            },
          },
        });
      } catch (error) {
        fastify.log.error(error);

        return reply.status(500).send({
          success: false,
          message: "Server error while fetching application details",
        });
      }
    },
  );
}

module.exports = getApplicationDetails;
