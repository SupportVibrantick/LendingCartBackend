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
        summary: "Update lender loan product (Same as create logic)",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: { type: "object" },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        // 🔐 AUTH
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

        // 🧪 VALIDATION
        const parsed = updateLenderLoanProductSchema.safeParse(req.body);

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        const data = parsed.data;

        // 🔍 CHECK OWNERSHIP
        const existing = await prisma.lenderProduct.findFirst({
          where: { id, lenderOrgId },
        });

        if (!existing) {
          return reply.status(404).send({
            success: false,
            message: "Loan product configuration not found",
          });
        }

        // 🧠 BUILD UPDATE DATA (SAME AS CREATE)
        const updateData = {};

        // helper functions
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

        // 💰 FINANCIAL
        setDecimal("minLoanAmount", data.minLoanAmount);
        setDecimal("maxLoanAmount", data.maxLoanAmount);

        // ✅ LTV
        setDecimal("maxLtvPercent", data.maxLtvPercent);

        // ✅ ARV (ALL PRODUCTS)
        setDecimal("maxArvPercent", data.maxArvPercent);

        // ✅ LTC (ONLY SPECIFIC PRODUCTS)
        if (
          [
            "MEZZ_FINANCE_PREF_EQUITY",
            "FIX_AND_FLIP",
            "CONSTRUCTION_LOAN",
          ].includes(existing.loanProductCode)
        ) {
          setDecimal("maxLtcPercent", data.maxLtcPercent);
        }

        // 🔢 NUMERIC
        setValue("minTermMonths", data.minTermMonths);
        setValue("maxTermMonths", data.maxTermMonths);
        setValue("minCreditScore", data.minCreditScore);

        // ✅ SAME AS CREATE (STRING)
        if (data.minExperience !== undefined) {
          updateData.minExperience =
            data.minExperience !== null ? String(data.minExperience) : null;
        }

        // 📝 STRING
        setValue("interestRateRange", data.interestRateRange);

        // ✅ JSON (NO stringify)
        setValue("businessTypes", data.businessTypes);
        setValue("propertyTypes", data.propertyTypes);

        // ⚠️ CSV (same as create)
        if (data.statesSupported !== undefined) {
          updateData.statesSupported = data.statesSupported?.join(",") ?? null;
        }

        // ✅ EQUIPMENT (ONLY ARRAY, ONLY FOR EQUIPMENT_FINANCE)
        const isEquipmentFinance =
          existing.loanProductCode === "EQUIPMENT_FINANCE";

        if (isEquipmentFinance) {
          if (data.equipmentTypes !== undefined) {
            updateData.equipmentTypes = data.equipmentTypes?.join(",") ?? null;
          }
          setValue("otherEquipmentExplanation", data.otherEquipmentExplanation);
        }

        // 🔘 BOOLEAN
        setValue("isActive", data.isActive);

        // 🚫 NOTHING TO UPDATE
        if (Object.keys(updateData).length === 0) {
          return reply.status(400).send({
            success: false,
            message: "No fields provided for update",
          });
        }

        // 💾 UPDATE
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
          message: error.message || "Server error while updating loan product",
        });
      }
    },
  );
}

module.exports = updateLenderLoanProductRoutes;
