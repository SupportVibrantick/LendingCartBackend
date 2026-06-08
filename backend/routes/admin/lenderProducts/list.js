// routes/admin/lenderProducts/list.js

async function listLenderProductRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Lender Products"],
        summary: "List all lender product mappings",
      },
    },
    async (_, reply) => {
      const prisma = fastify.prisma;

      try {
        const result = await prisma.lenderProduct.findMany({
          include: {
            lender: true,
            loanProduct: true,
          },
          orderBy: { createdAt: "desc" },
        });

        // ---------------------------
        // Normalize response for frontend (Production-safe)
        // ---------------------------
const formatted = result.map((item) => ({
  ...item,

  // JSON object return karo
businessTypes: Array.isArray(item.businessTypes)
  ? item.businessTypes.filter(
      (b) => b && b.name
    )
  : [],

propertyTypes: Array.isArray(item.propertyTypes)
  ? item.propertyTypes.filter(
      (p) =>
        p &&
        p.type &&
        p.type !== "undefined"
    )
  : [],

  // array return karo
  equipmentTypes: normalizeToArray(item.equipmentTypes),

  statesSupported: normalizeToArray(item.statesSupported),

  maxLtvPercent: item.maxLtvPercent?.toString() ?? null,
  maxArvPercent: item.maxArvPercent?.toString() ?? null,
  maxLtcPercent: item.maxLtcPercent?.toString() ?? null,

  minLoanAmount: item.minLoanAmount?.toString() ?? null,
  maxLoanAmount: item.maxLoanAmount?.toString() ?? null,
}));

        return reply.send({
          success: true,
          count: formatted.length,
          data: formatted,
        });
      } catch (error) {
        fastify.log.error(error);

        return reply.status(500).send({
          success: false,
          message: "Server error while listing lender products",
        });
      }
    }
  );
}

/**
 * Utility: Safely normalize any value to array
 * Handles:
 * - comma-separated string
 * - array
 * - null / undefined
 */
function normalizeToArray(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean); // remove empty values
  }

  return [];
}

module.exports = listLenderProductRoutes;