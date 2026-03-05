// routes/admin/lenderProducts/create.js
const { Prisma } = require("@prisma/client");
const { adminLogs } = require("../../../services/logger/contextLogger");
const {
  createLenderProductSchema,
} = require("../../../schemas/admin/lenderProducts/create.schema");

async function createLenderProductRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Admin -> Lender Products"],
        summary: "Assign multiple loan products to a lender",
        body: { type: "object" },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        // ---------------------------
        // Validate request body
        // ---------------------------
        const parsed = createLenderProductSchema.safeParse(request.body);

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid data",
            details: parsed.error.issues,
          });
        }

        const data = parsed.data;

        // ---------------------------
        // Validate lender org
        // ---------------------------
        const lenderOrg = await prisma.organization.findFirst({
          where: {
            id: data.lenderOrgId,
            type: "LENDER",
            isDeleted: { not: true },
          },
        });

        if (!lenderOrg) {
          return reply.status(404).send({
            success: false,
            message: "Lender organization not found.",
          });
        }

        // ---------------------------
        // Fetch loan products
        // ---------------------------
        const loanProducts = await prisma.loanProduct.findMany({
          where: {
            code: { in: data.loanProductCodes },
            isActive: true,
          },
        });

        if (loanProducts.length !== data.loanProductCodes.length) {
          return reply.status(404).send({
            success: false,
            message: "One or more loan products not found or inactive.",
          });
        }

        // ---------------------------
        // Existing mappings
        // ---------------------------
        const existing = await prisma.lenderProduct.findMany({
          where: {
            lenderOrgId: data.lenderOrgId,
            loanProductCode: { in: data.loanProductCodes },
          },
          select: { loanProductCode: true },
        });

        const existingCodes = new Set(existing.map((e) => e.loanProductCode));

        // ---------------------------
        // Prepare create payload
        // ---------------------------
        const createPayload = loanProducts
          .filter((p) => !existingCodes.has(p.code))
          .map((product) => {
            const isEquipmentFinance = product.code === "EQUIPMENT_FINANCE";

            return {
              lenderOrgId: data.lenderOrgId,
              loanProductId: product.id,
              loanProductCode: product.code,

              businessTypes: data.businessTypes?.join(",") ?? null,

              equipmentTypes: isEquipmentFinance
                ? (data.equipmentTypes?.join(",") ?? null)
                : null,

              otherEquipmentExplanation: isEquipmentFinance
                ? (data.otherEquipmentExplanation ?? null)
                : null,

              minLoanAmount: data.minLoanAmount
                ? new Prisma.Decimal(data.minLoanAmount)
                : null,

              maxLoanAmount: data.maxLoanAmount
                ? new Prisma.Decimal(data.maxLoanAmount)
                : null,

              minTermMonths: data.minTermMonths ?? null,
              maxTermMonths: data.maxTermMonths ?? null,

              minLtvPercent: data.minLtvPercent
                ? new Prisma.Decimal(data.minLtvPercent)
                : null,

              maxLtvPercent: data.maxLtvPercent
                ? new Prisma.Decimal(data.maxLtvPercent)
                : null,

              minCreditScore: data.minCreditScore ?? null,
              minExperience: data.minExperience ?? null,

              interestRateRange: data.interestRateRange ?? null,

              statesSupported: data.statesSupported?.join(",") ?? null,

              isActive: data.isActive ?? true,
            };
          });

        if (!createPayload.length) {
          return reply.status(409).send({
            success: false,
            message: "All loan products are already assigned to this lender.",
          });
        }

        // ---------------------------
        // Create records (transaction)
        // ---------------------------
        const created = await prisma.$transaction(
          createPayload.map((d) => prisma.lenderProduct.create({ data: d })),
        );

        return reply.status(201).send({
          success: true,
          message: "Lender products created successfully.",
          createdCount: created.length,
          skippedLoanProductCodes: [...existingCodes],
          data: created,
        });
      } catch (error) {
        adminLogs.error("LenderProduct bulk create failed", error);

        return reply.status(500).send({
          success: false,
          message: "Server error while creating lender products",
        });
      }
    },
  );
}

module.exports = createLenderProductRoutes;
