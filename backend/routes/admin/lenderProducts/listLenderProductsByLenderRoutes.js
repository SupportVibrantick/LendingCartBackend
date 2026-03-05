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
            isActive: true,
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
        // Return response
        // ---------------------------
        return reply.send({
          success: true,
          lender,
          lenderOrgId,
          count: result.length,
          data: result,
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