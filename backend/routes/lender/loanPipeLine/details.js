const { mapSubmissionFieldResponse } = require("../../../services/applications/staticSubmissionFields");
const {
  resolveClientDisplayNameFromData,
} = require("../../../services/messaging/resolveClientDisplayName");
const {
  resolveLatestActiveSubmission,
} = require("../../../utils/applications/clientPortalSubmission");

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
          select: {
            id: true,
            status: true,
            sentAt: true,
            lastUpdatedAt: true,
            lenderOrgId: true,
            loanApplicationId: true,
            lenderProductId: true,
            lenderProduct: {
              select: {
                id: true,
                loanProductCode: true,
                minLoanAmount: true,
                maxLoanAmount: true,
                interestRateRange: true,
                minTermMonths: true,
                maxTermMonths: true,
              },
            },
            lenderReviews: {
              orderBy: {
                createdAt: "desc",
              },
              select: {
                id: true,
                reviewStatus: true,
                approvedAmount: true,
                interestRate: true,
                notes: true,
                createdAt: true,
                conditions: {
                  select: {
                    id: true,
                    description: true,
                    status: true,
                    satisfiedAt: true,
                  },
                },
              },
            },
            loanApplication: {
              select: {
                id: true,
                applicationNumber: true,
                loanProductCode: true,
                amountRequested: true,
                status: true,
                createdAt: true,
                submittedAt: true,
                client: {
                  select: {
                    id: true,
                    legalName: true,
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
                brokerOrg: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                  },
                },
                financials: true,
                collaterals: {
                  select: {
                    id: true,
                    collateralType: true,
                    description: true,
                    valueEstimated: true,
                    lienPosition: true,
                  },
                },
                documentUploads: {
                  select: {
                    id: true,
                    fileName: true,
                    fileUrl: true,
                    fileMimeType: true,
                    uploadedAt: true,
                    documentRequirementId: true,
                  },
                },
                submissions: {
                  where: { status: { not: "SUPERSEDED" } },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: {
                    id: true,
                    status: true,
                    createdAt: true,
                    fields: {
                      select: {
                        id: true,
                        fieldKey: true,
                        value: true,
                        builderField: {
                          select: {
                            fieldKey: true,
                            label: true,
                            fieldType: true,
                            section: {
                              select: {
                                id: true,
                                name: true,
                                sortOrder: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                ruleEvaluations: {
                  orderBy: { evaluatedAt: "desc" },
                  take: 5,
                  select: {
                    id: true,
                    result: true,
                    evaluatedAt: true,
                    results: {
                      select: {
                        id: true,
                        passed: true,
                        message: true,
                        fieldValue: true,
                      },
                    },
                  },
                },
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
