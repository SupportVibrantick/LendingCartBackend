// routes/admin/lenderProducts/toggleStatus.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function toggleStatusRoutes(fastify) {
  fastify.patch(
    "/:id/status",
    {
      schema: {
        tags: ["Admin -> Lender Products"],
        summary: "Enable or disable a lender product",
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;

        const product = await prisma.lenderProduct.findUnique({
          where: { id },
        });

        if (!product) {
          return reply.status(404).send({
            success: false,
            message: "Lender product not found",
          });
        }

        const updated = await prisma.lenderProduct.update({
          where: { id },
          data: { isActive: !product.isActive },
        });

        return reply.send({
          success: true,
          message: `Product is now ${updated.isActive ? "ACTIVE" : "INACTIVE"}`,
          data: updated,
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          message: "Server error while toggling status",
        });
      }
    }
  );
}

module.exports = toggleStatusRoutes;
