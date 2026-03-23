const dayjs = require("dayjs");

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

          const loanRecord = await prisma.loanApplication.findFirst({
            where: { clientId },
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
            orderBy: {
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

        const response = {
          applicationNumber: loan.applicationNumber,
          status: loan.status,
          createdAt: dayjs(loan.createdAt).format("DD MMM YYYY"),

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

          documents: loan.documentRequirements.map((doc) => ({
            id: doc.id,
            name: doc.documentType.name,
            status: doc.status,
            required: doc.isRequired,
            uploadedFiles: doc.uploads.map((file) => ({
              fileName: file.fileName,
              fileUrl: file.fileUrl,
              uploadedAt: file.uploadedAt,
            })),
          })),
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