const { Prisma } = require("@prisma/client");

const {
  updateLenderLoanProductSchema,
} = require("../../../schemas/lender/loanProduct/update.schema");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function updateLenderLoanProductRoutes(fastify) {
  fastify.put(
    "/:id",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Lender -> Loan Products"],
        summary: "Update Loan Product Configuration (Advanced)",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            minLoanAmount: { type: "number" },
            maxLoanAmount: { type: "number" },
            minTermMonths: { type: "number" },
            maxTermMonths: { type: "number" },
            minLtvPercent: { type: "number" },
            maxLtvPercent: { type: "number" },
            minCreditScore: { type: "number" },
            minExperience: { type: "number" },
            interestRateRange: { type: "string" },
            businessTypes: {
              type: "array",
              items: { type: "string" },
            },
            propertyTypes: {
              type: "array",
              items: { type: "string" },
            },
            statesSupported: {
              type: "array",
              items: { type: "string" },
            },
            equipmentTypes: {
              type: "array",
              items: { type: "string" },
            },
            otherEquipmentExplanation: { type: "string" },
            isActive: { type: "boolean" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        // ---------------------------
        // 🔐 AUTH CHECK
        // ---------------------------
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
        const { id } = req.params;

        // ---------------------------
        // 🧪 VALIDATION
        // ---------------------------
        const parsed =
          updateLenderLoanProductSchema.safeParse(req.body);

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        const data = parsed.data;

        // ---------------------------
        // 🔍 FETCH EXISTING
        // ---------------------------
        const existing = await prisma.lenderProduct.findFirst({
          where: { id, lenderOrgId },
        });

        if (!existing) {
          return reply.status(404).send({
            success: false,
            message: "Loan product configuration not found",
          });
        }

        // ---------------------------
        // ⚠️ BUSINESS VALIDATION
        // ---------------------------
        if (
          data.minLoanAmount &&
          data.maxLoanAmount &&
          data.minLoanAmount > data.maxLoanAmount
        ) {
          return reply.status(400).send({
            success: false,
            message: "minLoanAmount cannot be greater than maxLoanAmount",
          });
        }

        if (
          data.minTermMonths &&
          data.maxTermMonths &&
          data.minTermMonths > data.maxTermMonths
        ) {
          return reply.status(400).send({
            success: false,
            message: "minTermMonths cannot be greater than maxTermMonths",
          });
        }

        // ---------------------------
        // 🧠 BUILD UPDATE PAYLOAD
        // ---------------------------
        const updateData = {};

        const setDecimal = (field, value) => {
          if (value !== undefined) {
            updateData[field] =
              value === null ? null : new Prisma.Decimal(value);
          }
        };

        const setValue = (field, value) => {
          if (value !== undefined) {
            updateData[field] = value;
          }
        };

        const setArrayAsCSV = (field, arr) => {
          if (arr !== undefined) {
            updateData[field] =
              arr === null ? null : arr.join(",");
          }
        };

        // financial
        setDecimal("minLoanAmount", data.minLoanAmount);
        setDecimal("maxLoanAmount", data.maxLoanAmount);
        setDecimal("minLtvPercent", data.minLtvPercent);
        setDecimal("maxLtvPercent", data.maxLtvPercent);

        // numeric
        setValue("minTermMonths", data.minTermMonths);
        setValue("maxTermMonths", data.maxTermMonths);
        setValue("minCreditScore", data.minCreditScore);
        setValue("minExperience", data.minExperience);

        // string
        setValue("interestRateRange", data.interestRateRange);
        setValue(
          "otherEquipmentExplanation",
          data.otherEquipmentExplanation
        );

        // arrays
        setArrayAsCSV("businessTypes", data.businessTypes);
        setArrayAsCSV("propertyTypes", data.propertyTypes);
        setArrayAsCSV("statesSupported", data.statesSupported);
        setArrayAsCSV("equipmentTypes", data.equipmentTypes);

        // boolean
        setValue("isActive", data.isActive);

        // ---------------------------
        // 🚫 NO UPDATE CASE
        // ---------------------------
        if (Object.keys(updateData).length === 0) {
          return reply.status(400).send({
            success: false,
            message: "No valid fields provided for update",
          });
        }

        // ---------------------------
        // 💾 UPDATE
        // ---------------------------
        const updated = await prisma.lenderProduct.update({
          where: { id },
          data: updateData,
        });

        return reply.send({
          success: true,
          message: "Loan product updated successfully",
          data: updated,
        });
      } catch (error) {
        req.log.error(error);

        return reply.status(500).send({
          success: false,
          message:
            error.message ||
            "Server error while updating loan product",
        });
      }
    }
  );
}

module.exports = updateLenderLoanProductRoutes;