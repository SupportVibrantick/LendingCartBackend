// routes/admin/lenderProducts/list.js

async function listLenderProductRoutes(fastify) {
  const {
    mapLenderDocumentRequirements,
  } = require("../../../utils/lender/syncLenderProductDocuments");
  const {
    normalizeLenderProductForAdminApi,
  } = require("../../../utils/lender/normalizeLenderProductResponse");
  const { LoanProductCode } = require("@prisma/client");

  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Lender Products"],
        summary: "List all lender product mappings",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
            search: { type: "string" },
            lenderOrgId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { parsePagination } = require("../../../utils/pagination");
      const { skip, take, page, limit } = parsePagination(req.query);

      try {
        const search = String(req.query.search || "").trim();
        const lenderOrgId = String(req.query.lenderOrgId || "").trim();

        const where = {
          ...(lenderOrgId ? { lenderOrgId } : {}),
          ...(search
            ? {
                OR: [
                  {
                    lender: {
                      name: { contains: search, mode: "insensitive" },
                    },
                  },
                  {
                    loanProduct: {
                      name: { contains: search, mode: "insensitive" },
                    },
                  },
                  {
                    interestRateRange: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                  ...Object.values(LoanProductCode)
                    .filter((code) =>
                      String(code).toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((code) => ({ loanProductCode: code })),
                ],
              }
            : {}),
        };

        const [result, total] = await Promise.all([
          prisma.lenderProduct.findMany({
            where,
            skip,
            take,
            include: {
              lender: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  status: true,
                },
              },
              loanProduct: {
                select: {
                  code: true,
                  name: true,
                },
              },
              lenderDocumentRequirements: {
                select: {
                  id: true,
                  documentTypeId: true,
                  isRequired: true,
                  sortOrder: true,
                  documentType: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                      isCustom: true,
                    },
                  },
                },
                orderBy: { sortOrder: "asc" },
              },
            },
            orderBy: { createdAt: "desc" },
          }),
          prisma.lenderProduct.count({ where }),
        ]);

        const formatted = result.map((item) =>
          normalizeLenderProductForAdminApi(item, {
            documents: mapLenderDocumentRequirements(
              item.lenderDocumentRequirements,
            ),
          }),
        );

        return reply.send({
          success: true,
          count: formatted.length,
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit) || 1),
          data: formatted,
        });
      } catch (error) {
        fastify.log.error(error);

        return reply.status(500).send({
          success: false,
          message: "Server error while listing lender products",
        });
      }
    },
  );
}

module.exports = listLenderProductRoutes;
