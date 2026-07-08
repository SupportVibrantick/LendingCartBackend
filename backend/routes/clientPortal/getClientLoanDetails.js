const dayjs = require("dayjs");
const { mapClientPortalDocuments } = require("../../utils/documents/mapClientPortalDocuments");
const {
  canClientSignApplication,
  resolveLatestActiveSubmission,
} = require("../../utils/applications/clientPortalSubmission");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function getClientLoanDetailsRoute(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Client Portal"],
        summary: "Get loan details (JWT or Token based)",
        querystring: {
          type: "object",
          properties: {
            token: { type: "string" },
            applicationId: { type: "string", format: "uuid" },
          },
        },
      },
    },

    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        let loan;

        /* ===============================
           CASE 1: TOKEN BASED ACCESS
        =============================== */

        if (req.query.token) {
          const token = req.query.token;

          const tokenRecord =
            await prisma.clientUploadToken.findUnique({
              where: { token },
              include: {
                loanApplication: {
                  include: {
                    submissions: {
                      include: { fields: true },
                    },
                    documentRequirements: {
                      include: {
                        documentType: true,
                        uploads: true,
                      },
                    },
                  },
                },
              },
            });

          if (!tokenRecord) {
            return reply.code(404).send({
              success: false,
              message: "Invalid access link",
            });
          }

          if (tokenRecord.expiresAt < new Date()) {
            return reply.code(400).send({
              success: false,
              message: "Link expired",
            });
          }

          loan = tokenRecord.loanApplication;
        }

        /* ===============================
           CASE 2: JWT BASED ACCESS
        =============================== */

        else if (req.headers.authorization) {
          const authHeader = req.headers.authorization;

          const token = authHeader.split(" ")[1];

          const decoded = require("jsonwebtoken").verify(
            token,
            process.env.JWT_SECRET
          );

          const clientId = decoded.clientId;
          const { applicationId } = req.query;

          const loanRecord = await prisma.loanApplication.findFirst({
            where: applicationId
              ? { id: applicationId, clientId }
              : { clientId },
            include: {
              submissions: {
                include: { fields: true },
              },
              documentRequirements: {
                include: {
                  documentType: true,
                  uploads: true,
                },
              },
            },
            orderBy: applicationId
              ? undefined
              : {
                  createdAt: "desc",
                },
          });

          if (!loanRecord) {
            return reply.code(404).send({
              success: false,
              message: "No loan found",
            });
          }

          loan = loanRecord;
        }

        /* ===============================
           NO ACCESS METHOD
        =============================== */

        else {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized access",
          });
        }

        if (!loan) {
          return reply.code(404).send({
            success: false,
            message: "Loan not found",
          });
        }

        /* ===============================
           EXTRACT FIELDS
        =============================== */

        const allFields = [];

        for (const sub of loan.submissions || []) {
          for (const field of sub.fields || []) {
            allFields.push({
              key: field.fieldKey,
              value: field.value,
            });
          }
        }

        const getField = (key) =>
          allFields.find((f) => f.key === key)?.value || null;

        /* ===============================
           BUILD DATA
        =============================== */

        const borrowerName = [
          getField("borrowerFirstName") ||
            getField("first_name") ||
            "",
          getField("borrowerLastName") ||
            getField("last_name") ||
            "",
        ]
          .join(" ")
          .trim();

        const borrowerSignature = getField("borrowerSignature");
        const latestSubmission = resolveLatestActiveSubmission(loan.submissions || []);
        const signatureState = canClientSignApplication({
          status: loan.status,
          submittedAt: loan.submittedAt,
          createdAt: loan.createdAt,
          borrowerSignature,
          submissions: loan.submissions,
        });

        const response = {
          loanApplicationId: loan.id,
          id: loan.id,
          applicationNumber: loan.applicationNumber,
          status: loan.status,
          submittedAt: loan.submittedAt,
          createdAt: dayjs(loan.createdAt).format("DD MMM YYYY"),
          submissions: loan.submissions || [],
          latestSubmission: latestSubmission
            ? {
                id: latestSubmission.id,
                status: latestSubmission.status,
                createdAt: latestSubmission.createdAt,
                fields: latestSubmission.fields || [],
              }
            : null,
          borrowerSignature,
          canClientSign: signatureState.allowed,
          clientSignBlockedReason: signatureState.reason || null,
          alreadySigned: Boolean(signatureState.alreadySigned),

          borrower: {
            name: borrowerName || null,
            email: getField("email"),
            phone:
              getField("phone") || getField("phone_number"),
            creditScore:
              getField("creditScore") ||
              getField("credit_score"),
          },

          loanDetails: {
            amountRequested:
              getField("amountRequested") ||
              getField("loan_amount"),
            loanProductCode:
              getField("loanProductCode") ||
              loan.loanProductCode,
            interestRate:
              getField("interestRate") ||
              getField("interest_rate"),
            loanTerm:
              getField("loanTerm") ||
              getField("loan_term"),
            loanPurpose: getField("loan_purpose"),
          },

          property: {
            address: getField("property_address"),
            value: getField("property_value"),
            rent: getField("monthly_rental_income"),
          },

          fullApplication: allFields,

          documents: mapClientPortalDocuments(loan.documentRequirements || []),
        };

        return reply.send({
          success: true,
          data: response,
        });

      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
          },
          "Failed to fetch client loan details"
        );

        return reply.code(500).send({
          success: false,
          message: "Unexpected server error",
        });
      }
    }
  );
}

module.exports = getClientLoanDetailsRoute;