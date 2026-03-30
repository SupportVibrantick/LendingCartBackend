// routes/admin/lenderProducts/update.js

const { Prisma } = require("@prisma/client");
const { adminLogs } = require("../../../services/logger/contextLogger");
const {
  updateLenderProductSchema,
} = require("../../../schemas/admin/lenderProducts/update.schema");

async function updateLenderProductRoutes(fastify) {
  fastify.patch(
    "/:id",
    {
      schema: {
        tags: ["Admin -> Lender Products"],
        summary: "Update lender product configuration",
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      // ✅ FIX: UUID → do NOT convert to Number
      const productId = request.params.id;

      if (!productId) {
        return reply.status(400).send({
          success: false,
          message: "Invalid product ID",
        });
      }

      try {
        // -----------------------------
        // Validate request body
        // -----------------------------
        const parsed = updateLenderProductSchema.safeParse(request.body);

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid update data",
            details: parsed.error.issues,
          });
        }

        const data = parsed.data;

        // -----------------------------
        // Check if product exists
        // -----------------------------
        const existing = await prisma.lenderProduct.findUnique({
          where: { id: productId },
        });

        if (!existing) {
          return reply.status(404).send({
            success: false,
            message: "Lender product not found",
          });
        }

        const isEquipmentFinance =
          existing.loanProductCode === "EQUIPMENT_FINANCE";

        const updatePayload = {};

        // -----------------------------
        // 🔧 Helpers
        // -----------------------------
        const toDecimal = (value) => {
          if (value === undefined) return undefined;
          if (value === null || value === "") return null;

          const num = Number(value);
          if (isNaN(num)) {
            throw new Error(`Invalid number: ${value}`);
          }

          return new Prisma.Decimal(num);
        };

        const toCsv = (value) => {
          if (value === undefined) return undefined;
          if (value === null || value === "") return null;

          if (Array.isArray(value)) {
            const cleaned = value
              .map((v) => String(v).trim())
              .filter(Boolean);

            return cleaned.length ? cleaned.join(",") : null;
          }

          return String(value).trim() || null;
        };

        const normalizeArray = (value) => {
          if (value === undefined) return undefined;
          if (!Array.isArray(value)) return null;

          const cleaned = value
            .map((v) => v) // keep objects intact (important for your case)
            .filter(Boolean);

          return cleaned.length ? cleaned : null;
        };

        // -----------------------------
        // Business & Property Types (JSON)
        // -----------------------------
        if (data.businessTypes !== undefined) {
          updatePayload.businessTypes = normalizeArray(data.businessTypes);
        }

        if (data.propertyTypes !== undefined) {
          updatePayload.propertyTypes = normalizeArray(data.propertyTypes);
        }

        // -----------------------------
        // Equipment fields
        // -----------------------------
        if (isEquipmentFinance) {
          const equipmentTypes = toCsv(data.equipmentTypes);

          if (equipmentTypes !== undefined) {
            updatePayload.equipmentTypes = equipmentTypes;
          }

          if (data.otherEquipmentExplanation !== undefined) {
            updatePayload.otherEquipmentExplanation =
              data.otherEquipmentExplanation?.trim() || null;
          }
        }

        // -----------------------------
        // Loan Amounts
        // -----------------------------
        const minLoanAmount = toDecimal(data.minLoanAmount);
        if (minLoanAmount !== undefined)
          updatePayload.minLoanAmount = minLoanAmount;

        const maxLoanAmount = toDecimal(data.maxLoanAmount);
        if (maxLoanAmount !== undefined)
          updatePayload.maxLoanAmount = maxLoanAmount;

        // -----------------------------
        // Terms
        // -----------------------------
        if (data.minTermMonths !== undefined)
          updatePayload.minTermMonths = data.minTermMonths ?? null;

        if (data.maxTermMonths !== undefined)
          updatePayload.maxTermMonths = data.maxTermMonths ?? null;

        // -----------------------------
        // LTV
        // -----------------------------
        const minLtv = toDecimal(data.minLtvPercent);
        if (minLtv !== undefined)
          updatePayload.minLtvPercent = minLtv;

        const maxLtv = toDecimal(data.maxLtvPercent);
        if (maxLtv !== undefined)
          updatePayload.maxLtvPercent = maxLtv;

        // -----------------------------
        // Credit & Experience
        // -----------------------------
        if (data.minCreditScore !== undefined)
          updatePayload.minCreditScore = data.minCreditScore ?? null;

        if (data.minExperience !== undefined)
          updatePayload.minExperience = data.minExperience ?? null;

        if (data.interestRateRange !== undefined)
          updatePayload.interestRateRange =
            data.interestRateRange?.trim() || null;

        // -----------------------------
        // States
        // -----------------------------
        const states = toCsv(data.statesSupported);
        if (states !== undefined)
          updatePayload.statesSupported = states;

        // -----------------------------
        // Active flag
        // -----------------------------
        if (typeof data.isActive === "boolean")
          updatePayload.isActive = data.isActive;

        // -----------------------------
        // Prevent empty update
        // -----------------------------
        if (!Object.keys(updatePayload).length) {
          return reply.status(400).send({
            success: false,
            message: "No valid fields provided for update",
          });
        }

        // -----------------------------
        // Update product
        // -----------------------------
        const updatedProduct = await prisma.lenderProduct.update({
          where: { id: productId },
          data: updatePayload,
          include: {
            loanProduct: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        });

        // -----------------------------
        // Fetch updated list
        // -----------------------------
        const products = await prisma.lenderProduct.findMany({
          where: {
            lenderOrgId: existing.lenderOrgId,
          },
          include: {
            loanProduct: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        // -----------------------------
        // Normalize response
        // -----------------------------
        const formatted = products.map((item) => ({
          ...item,
          statesSupported: item.statesSupported
            ? item.statesSupported.split(",")
            : [],
        }));

        return reply.send({
          success: true,
          message: "Lender product updated successfully",
          updatedProduct,
          data: formatted,
        });
      } catch (error) {
        adminLogs.error("Update lender product failed", {
          productId,
          error: error.message,
          payload: request.body,
        });

        return reply.status(500).send({
          success: false,
          message:
            process.env.NODE_ENV === "development"
              ? error.message
              : "Server error while updating lender product",
        });
      }
    }
  );
}

module.exports = updateLenderProductRoutes;