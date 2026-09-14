// routes/admin/lenderProducts/list.js

async function listLenderProductRoutes(fastify) {
  const {
    mapLenderDocumentRequirements,
  } = require("../../../utils/lender/syncLenderProductDocuments");
  const {
    normalizeLenderProductForAdminApi,
  } = require("../../../utils/lender/normalizeLenderProductResponse");

  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Lender Products"],
        summary: "List all lender product mappings",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { parsePagination } = require("../../../utils/pagination");
      const { skip, take, page, limit } = parsePagination(req.query);

      try {
        const [result, total] = await Promise.all([
          prisma.lenderProduct.findMany({
            skip,
            take,
            select: {
              id: true,
              lenderOrgId: true,
              loanProductCode: true,
              isEnabled: true,
              createdAt: true,
              updatedAt: true,
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
          prisma.lenderProduct.count(),
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
