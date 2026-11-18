const {
  LENDER_PRODUCT_INCLUDE,
  formatLenderProductListItem,
} = require("../../../utils/lender/formatLenderProductListItem");

const SUMMARY_PRODUCT_SELECT = {
  id: true,
  isActive: true,
  minLoanAmount: true,
  maxLoanAmount: true,
  minCreditScore: true,
  minDscr: true,
  interestRateRange: true,
  loanProductCode: true,
  loanProductId: true,
  loanProduct: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
};

const TABLE_PRODUCT_INCLUDE = {
  loanProduct: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
};

function formatSummaryProductListItem(product) {
  const minLoanAmount =
    product.minLoanAmount === null || product.minLoanAmount === undefined
      ? null
      : Number(product.minLoanAmount);
  const maxLoanAmount =
    product.maxLoanAmount === null || product.maxLoanAmount === undefined
      ? null
      : Number(product.maxLoanAmount);
  const minDscr =
    product.minDscr === null || product.minDscr === undefined
      ? null
      : Number(product.minDscr);

  return {
    id: product.id,
    isActive: product.isActive,
    loanProductId: product.loanProductId || product.loanProduct?.id || null,
    code: product.loanProduct?.code || product.loanProductCode || null,
    name: product.loanProduct?.name || null,
    minLoanAmount: Number.isFinite(minLoanAmount) ? minLoanAmount : null,
    maxLoanAmount:
      Number.isFinite(maxLoanAmount) && maxLoanAmount > 0 ? maxLoanAmount : null,
    minCreditScore: product.minCreditScore ?? null,
    minDscr: Number.isFinite(minDscr) ? minDscr : null,
    interestRateRange:
      typeof product.interestRateRange === "string"
        ? product.interestRateRange.replace(/%/g, "")
        : product.interestRateRange,
  };
}

function parseBool(value) {
  return value === true || value === "true" || value === "1";
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
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

            summary: {
              type: "boolean",
              default: false,
              description:
                "Return a lightweight product payload without documents/criteria",
            },

            includeDocuments: {
              type: "boolean",
              default: false,
              description:
                "Include document requirements (heavier). Default false for table views.",
            },
          },
        },
      },
    },

    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
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
        const {
          page = 1,
          limit = 10,
          isActive,
          search,
          summary: summaryRaw = false,
          includeDocuments: includeDocumentsRaw = false,
        } = req.query;
        const summary = parseBool(summaryRaw);
        const includeDocuments = parseBool(includeDocumentsRaw);
        const skip = (page - 1) * limit;

        const where = {
          lenderOrgId,
        };

        if (typeof isActive === "boolean") {
          where.isActive = isActive;
        } else if (isActive === "true" || isActive === "false") {
          where.isActive = isActive === "true";
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

        const queryOptions = summary
          ? { select: SUMMARY_PRODUCT_SELECT }
          : {
              include: includeDocuments
                ? LENDER_PRODUCT_INCLUDE
                : TABLE_PRODUCT_INCLUDE,
            };

        const [products, total] = await Promise.all([
          prisma.lenderProduct.findMany({
            where,
            ...queryOptions,
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

        const formatted = summary
          ? products.map(formatSummaryProductListItem)
          : products.map(formatLenderProductListItem);

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
