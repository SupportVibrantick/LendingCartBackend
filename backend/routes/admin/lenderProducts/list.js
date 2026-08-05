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
    async (_, reply) => {
      const prisma = fastify.prisma;

      try {
        const result = await prisma.lenderProduct.findMany({
          include: {
            lender: true,
            loanProduct: true,
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
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
        });

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
