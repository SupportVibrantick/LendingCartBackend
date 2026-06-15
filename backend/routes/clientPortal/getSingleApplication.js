const jwt = require("jsonwebtoken");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function getClientApplicationDetailsRoute(fastify) {
  fastify.get("/applications/:id", async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      /* ===============================
         AUTH
      =============================== */
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return reply.code(401).send({
          success: false,
          message: "Unauthorized",
        });
      }

      const token = authHeader.split(" ")[1];

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return reply.code(401).send({
          success: false,
          message: "Invalid token",
        });
      }

      if (!decoded.clientId || decoded.role !== "CLIENT") {
        return reply.code(403).send({
          success: false,
          message: "Access denied",
        });
      }

      const clientId = decoded.clientId;
      const applicationId = req.params.id;

      /* ===============================
         FETCH DATA
      =============================== */
      const application = await prisma.loanApplication.findFirst({
        where: {
          id: applicationId,
          clientId,
        },
        include: {
          submissions: {
            orderBy: { createdAt: "desc" },
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

      /* ===============================
         FETCH FULL FEE AGREEMENT ✅
      =============================== */
      const feeAgreement = await prisma.feeAgreement.findUnique({
        where: {
          loanApplicationId: application.id,
        },
      });

      /* ===============================
         GET LATEST VALID SUBMISSION
      =============================== */
      const latestSubmission = (application.submissions || [])
        .filter((s) => s.status !== "SUPERSEDED")
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

      /* ===============================
         BUILD FIELD MAP
      =============================== */
      const fieldMap = new Map();

      if (latestSubmission?.fields?.length) {
        for (const field of latestSubmission.fields) {
          if (!field?.fieldKey) continue;
          fieldMap.set(field.fieldKey.trim(), field.value ?? null);
        }
      }

      const getField = (...keys) => {
  for (const key of keys) {
    const value = fieldMap.get(key);

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return value;
    }
  }

  return null;
};

      const toNumber = (val) => {
        if (val === null || val === undefined) return null;
        const num = Number(val);
        return isNaN(num) ? null : num;
      };

      /* ===============================
         FIXED VALUES
      =============================== */
const amountRequested =
  toNumber(
    getField(
      "amountRequested",
      "loan_amount",
      "loanAmount"
    )
  ) ??
  application.amountRequested ??
  0;

const loanProductCode =
  getField(
    "loanProductCode",
    "loan_product",
    "productCode"
  ) ||
  application.loanProductCode ||
  null;

  const borrowerFirstName =
  getField("borrowerFirstName", "first_name") ||
  application.client?.contacts?.[0]?.firstName ||
  "";

const borrowerLastName =
  getField("borrowerLastName", "last_name") ||
  application.client?.contacts?.[0]?.lastName ||
  "";

const borrowerName =
  `${borrowerFirstName} ${borrowerLastName}`.trim();

const borrowerEmail =
  getField("email", "borrowerEmail") ||
  application.client?.contacts?.[0]?.email ||
  "";

const borrowerPhone =
  getField("phone", "mobile", "borrowerPhone") ||
  application.client?.contacts?.[0]?.phone ||
  "";

const propertyAddress =
  getField(
    "propertyAddress",
    "property_address",
    "businessAddress",
    "business_address"
  ) || "";

const borrowerSignature =
  getField("borrowerSignature") || null;

      /* ===============================
         FINAL RESPONSE ✅ FULL DATA
      =============================== */
      return reply.send({
        success: true,
        data: {
          ...application,

          amountRequested,
          loanProductCode,

          borrowerName,
          borrowerEmail,
          borrowerPhone,
          propertyAddress,
          borrowerSignature,

          latestSubmission: latestSubmission
            ? {
                id: latestSubmission.id,
                status: latestSubmission.status,
                createdAt: latestSubmission.createdAt,
                fields: latestSubmission.fields || [],
              }
            : null,

          feeAgreement: feeAgreement || null,

          _debug: {
            submissionAmount: getField("amountRequested"),
            dbAmount: application.amountRequested,
            fieldKeys: [...fieldMap.keys()],
          },
        },
      });
    } catch (error) {
      fastify.log.error(
        { error: error.message },
        "Fetch application failed"
      );

      return reply.code(500).send({
        success: false,
        message: "Unexpected server error",
      });
    }
  });
}

module.exports = getClientApplicationDetailsRoute;