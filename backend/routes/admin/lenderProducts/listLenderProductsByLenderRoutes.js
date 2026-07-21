async function listLenderProductsByLenderRoutes(fastify) {
  const {
    mapLenderDocumentRequirements,
  } = require("../../../utils/lender/syncLenderProductDocuments");
  const {
    normalizeLenderProductForAdminApi,
  } = require("../../../utils/lender/normalizeLenderProductResponse");

  fastify.get(
    "/lender/:lenderOrgId",
    {
      schema: {
        tags: ["Admin -> Lender Products"],
        summary: "List lender product mappings by lender ID",
        params: {
          type: "object",
          properties: {
            lenderOrgId: { type: "string", format: "uuid" },
          },
          required: ["lenderOrgId"],
        },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;
      const { lenderOrgId } = request.params;

      try {
        const lender = await prisma.organization.findUnique({
          where: { id: lenderOrgId },
          select: {
            id: true,
            name: true,
            type: true,
            isDeleted: true,
          },
        });

        if (!lender || lender.type !== "LENDER" || lender.isDeleted) {
          return reply.status(404).send({
            success: false,
            message: "Lender organization not found",
          });
        }

        const products = await prisma.lenderProduct.findMany({
          where: { lenderOrgId },
          include: {
            loanProduct: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
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
          orderBy: {
            createdAt: "desc",
          },
        });

        const formatted = products.map((item) =>
          normalizeLenderProductForAdminApi(item, {
            documents: mapLenderDocumentRequirements(
              item.lenderDocumentRequirements,
            ),
          }),
        );

        return reply.send({
          success: true,
          lender: {
            id: lender.id,
            name: lender.name,
          },
          count: formatted.length,
          data: formatted,
        });
      } catch (error) {
        fastify.log.error(error);

        return reply.status(500).send({
          success: false,
          message: "Server error while fetching lender products",
        });
      }
    },
  );
}

module.exports = listLenderProductsByLenderRoutes;
