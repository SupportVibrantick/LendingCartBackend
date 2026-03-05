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
        // Validate lender
        // ---------------------------
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

        // ---------------------------
        // Fetch lender products
        // ---------------------------
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
          },
          orderBy: { createdAt: "desc" },
        });

        // ---------------------------
        // Transform CSV → arrays
        // ---------------------------
        const formatted = products.map((p) => ({
          ...p,
          businessTypes: p.businessTypes
            ? p.businessTypes.split(",")
            : [],
          equipmentTypes: p.equipmentTypes
            ? p.equipmentTypes.split(",")
            : [],
          statesSupported: p.statesSupported
            ? p.statesSupported.split(",")
            : [],
        }));

        // ---------------------------
        // Response
        // ---------------------------
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
    }
  );
}

module.exports = listLenderProductsByLenderRoutes;