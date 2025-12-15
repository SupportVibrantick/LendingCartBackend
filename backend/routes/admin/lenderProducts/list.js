// routes/admin/lenderProducts/list.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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
      try {
        const result = await prisma.lenderProduct.findMany({
          include: {
            lender: true,
            loanProduct: true,
          },
          orderBy: { createdAt: "desc" },
        });

        return reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          message: "Server error while listing lender products",
        });
      }
    }
  );
}

module.exports = listLenderProductRoutes;
