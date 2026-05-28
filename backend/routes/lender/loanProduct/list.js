/**
 * @param {import("fastify").FastifyInstance} fastify
 */
const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toPositiveNumberOrNull = (value) => {
  const parsed = toNumberOrNull(value);
  return parsed && parsed > 0 ? parsed : null;
};

const toStringArray = (value) => {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim());
  }

  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed)
        ? parsed.filter((item) => typeof item === "string" && item.trim())
        : [];
    } catch {
      return [];
    }
  }

  return trimmed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const toGroupedSelectionMap = (value, keyField) => {
  if (!value) {
    return {};
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return toGroupedSelectionMap(parsed, keyField);
    } catch {
      return {};
    }
  }

  if (Array.isArray(value)) {
    return value.reduce((acc, item) => {
      if (!item || typeof item !== "object") {
        return acc;
      }

      const key = item[keyField];
      const list = Array.isArray(item.subTypes)
        ? item.subTypes.filter(
            (subType) => typeof subType === "string" && subType.trim(),
          )
        : [];

      if (typeof key === "string" && key.trim()) {
        acc[key] = list;
      }

      return acc;
    }, {});
  }

  if (typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, list]) => {
      if (!key) {
        return acc;
      }

      acc[key] = Array.isArray(list)
        ? list.filter((item) => typeof item === "string" && item.trim())
        : [];

      return acc;
    }, {});
  }

  return {};
};

async function listLenderLoanProductsRoutes(fastify) {
  fastify.get(
    "/",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Lender -> Loan Products"],
        summary: "List configured loan products (Advanced)",

        querystring: {
          type: "object",
          properties: {
            page: {
              type: "number",
              minimum: 1,
              default: 1,
            },

            limit: {
              type: "number",
              minimum: 1,
              maximum: 100,
              default: 10,
            },

            isActive: {
              type: "boolean",
            },

            search: {
              type: "string",
            },
          },
        },
      },
    },

    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        // 🔐 AUTH CHECK
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

        // 📄 QUERY PARAMS
        const { page = 1, limit = 10, isActive, search } = req.query;

        const skip = (page - 1) * limit;

        // 🔍 FILTERS
        const where = {
          lenderOrgId,
        };

        if (typeof isActive === "boolean") {
          where.isActive = isActive;
        }

if (search) {
  where.OR = [
    {
      loanProduct: {
        is: {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
      },
    },
  ];
}

        // 📊 QUERY
        const [products, total] = await Promise.all([
          prisma.lenderProduct.findMany({
            where,

            include: {
              // ✅ Loan Product
              loanProduct: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },

              // ✅ Configured Documents
              lenderDocumentRequirements: {
                include: {
                  documentType: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                      isCustom: true,
                    },
                  },
                },
              },
            },

            orderBy: {
              createdAt: "desc",
            },

            skip,
            take: limit,
          }),

          prisma.lenderProduct.count({
            where,
          }),
        ]);

        // 🧠 FORMAT RESPONSE
        const formatted = products.map((p) => ({
          ...p,
  // ✅ IMPORTANT
  code: p.loanProduct?.code || p.loanProductCode || null,
  name: p.loanProduct?.name || null,
          minLoanAmount: toPositiveNumberOrNull(p.minLoanAmount),
          maxLoanAmount: toPositiveNumberOrNull(p.maxLoanAmount),
          minTermMonths: toPositiveNumberOrNull(p.minTermMonths),
          maxTermMonths: toPositiveNumberOrNull(p.maxTermMonths),
maxLtvPercent: toPositiveNumberOrNull(p.maxLtvPercent),

// ✅ ARV
maxArvPercent: toPositiveNumberOrNull(p.maxArvPercent),

// ✅ LTC
maxLtcPercent: toPositiveNumberOrNull(p.maxLtcPercent),

          // ✅ Normalize legacy + current JSON shapes
          businessTypes: toGroupedSelectionMap(p.businessTypes, "name"),
          propertyTypes: toGroupedSelectionMap(p.propertyTypes, "type"),

          // ✅ CSV / string / array → array
          statesSupported: toStringArray(p.statesSupported),

          // ✅ string / csv / array → array
          equipmentTypes: toStringArray(p.equipmentTypes),

          // ✅ Interest Range
interestRateRange:
  typeof p.interestRateRange === "string"
    ? p.interestRateRange.replace("%", "")
    : p.interestRateRange,

          // ✅ DOCUMENTS
          documents:
            p.lenderDocumentRequirements?.map((doc) => ({
              id: doc.id,

              documentTypeId: doc.documentTypeId,

              documentName: doc.documentType?.name || null,

              documentCode: doc.documentType?.code || null,

              isCustom: doc.documentType?.isCustom || false,

              isRequired: doc.isRequired,

              minFiles: doc.minFiles,
              maxFiles: doc.maxFiles,

              notes: doc.notes,
              sortOrder: doc.sortOrder,

              createdAt: doc.createdAt,
            })) || [],
        }));

        // 📦 RESPONSE
        return reply.send({
          success: true,

          meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },

          data: formatted,
        });
      } catch (error) {
        req.log.error(error);

        return reply.status(500).send({
          success: false,
          message: error.message || "Server error while fetching loan products",
        });
      }
    },
  );
}

module.exports = listLenderLoanProductsRoutes;
