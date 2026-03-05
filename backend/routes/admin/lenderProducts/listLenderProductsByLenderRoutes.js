// routes/admin/lenderProducts/listByLender.js

async function listLenderProductsByLenderRoutes(fastify) {
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
        // ---------------------------
        // Validate lender exists
        // ---------------------------
        const lender = await prisma.organization.findFirst({
          where: {
            id: lenderOrgId,
            type: "LENDER",
            isDeleted: { not: true },
          },
          select: {
            id: true,
            name: true,
          },
        });

        if (!lender) {
          return reply.status(404).send({
            success: false,
            message: "Lender organization not found",
          });
        }

        // ---------------------------
        // Fetch lender products
        // ---------------------------
        const result = await prisma.lenderProduct.findMany({
          where: {
            lenderOrgId,
            isActive: true, // only active mappings
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
          orderBy: {
            createdAt: "desc",
          },
        });

        // ---------------------------
        // Normalize response
        // ---------------------------
        const formatted = result.map((item) => ({
          ...item,

          businessTypes: item.businessTypes
            ? item.businessTypes.split(",")
            : [],

          equipmentTypes: item.equipmentTypes
            ? item.equipmentTypes.split(",")
            : [],

          statesSupported: item.statesSupported
            ? item.statesSupported.split(",")
            : [],
        }));

        return reply.send({
          success: true,
          lender: lender,
          lenderOrgId,
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
    }
  );
}

module.exports = listLenderProductsByLenderRoutes;