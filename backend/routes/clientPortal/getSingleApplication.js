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
          client: true,
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

      const getField = (key) => fieldMap.get(key) ?? null;

      const toNumber = (val) => {
        if (val === null || val === undefined) return null;
        const num = Number(val);
        return isNaN(num) ? null : num;
      };

      /* ===============================
         FIXED VALUES
      =============================== */
      let amountRequested = null;

      if (getField("amountRequested") !== null) {
        amountRequested = toNumber(getField("amountRequested"));
      } else if (getField("loan_amount") !== null) {
        amountRequested = toNumber(getField("loan_amount"));
      } else if (getField("loanAmount") !== null) {
        amountRequested = toNumber(getField("loanAmount"));
      } else if (application.amountRequested !== null) {
        amountRequested = Number(application.amountRequested);
      }

      let loanProductCode = null;

      if (getField("loanProductCode")) {
        loanProductCode = getField("loanProductCode");
      } else if (getField("loan_product")) {
        loanProductCode = getField("loan_product");
      } else if (application.loanProductCode) {
        loanProductCode = application.loanProductCode;
      }

      /* ===============================
         FINAL RESPONSE ✅ FULL DATA
      =============================== */
      return reply.send({
        success: true,
        data: {
          ...application,

          amountRequested,
          loanProductCode,

          // 🔥 FULL OBJECT (NO TRIM)
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