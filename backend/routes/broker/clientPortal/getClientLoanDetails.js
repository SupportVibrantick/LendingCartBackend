const dayjs = require("dayjs");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */

async function getClientLoanDetailsRoute(fastify) {
  fastify.get(
    "/:token",
    {
      schema: {
        tags: ["Client Portal"],
        summary: "Get loan details using client token",
        params: {
          type: "object",
          required: ["token"],
          properties: {
            token: { type: "string" },
          },
        },
      },
    },

    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const { token } = req.params;

        /* ===============================
           VALIDATE TOKEN
        =============================== */

        const tokenRecord = await prisma.clientUploadToken.findUnique({
          where: { token },
          include: {
            loanApplication: {
              include: {
                submissions: {
                  include: {
                    fields: true,
                  },
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

        const loan = tokenRecord.loanApplication;

        if (!loan) {
          return reply.code(404).send({
            success: false,
            message: "Loan not found",
          });
        }

        /* ===============================
           EXTRACT ALL FIELDS (DYNAMIC)
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

        const creditScore =
          getField("creditScore") || getField("credit_score");

        const amountRequested =
          getField("amountRequested") || getField("loan_amount");

        /* ===============================
           RESPONSE
        =============================== */

        const response = {
          applicationNumber: loan.applicationNumber,
          status: loan.status,
          createdAt: dayjs(loan.createdAt).format("DD MMM YYYY"),

          borrower: {
            name: borrowerName || null,
            email: getField("email"),
            phone:
              getField("phone") || getField("phone_number"),
            creditScore,
          },

          loanDetails: {
            amountRequested,
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

          fullApplication: allFields, // 🔥 FULL DATA

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
            token: req.params.token,
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