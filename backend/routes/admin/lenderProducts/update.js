// routes/admin/lenderProducts/update.js
const { adminLogs } = require("../../../services/logger/contextLogger");
const {
  updateLenderProductSchema,
} = require("../../../schemas/admin/lenderProducts/update.schema");

async function updateLenderProductRoutes(fastify) {
  fastify.patch(
    "/:id",
    {
      schema: {
        tags: ["Admin -> Lender Products"],
        summary: "Update lender product configuration",
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;
      try {
        const productId = request.params.id;

        const parsed = updateLenderProductSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid update data",
            details: parsed.error.issues,
          });
        }

        const exists = await prisma.lenderProduct.findUnique({
          where: { id: productId },
        });

        if (!exists) {
          return reply.status(404).send({
            success: false,
            message: "Lender product not found",
          });
        }

        const updated = await prisma.lenderProduct.update({
          where: { id: productId },
          data: parsed.data,
        });

        return reply.send({
          success: true,
          message: "Lender product updated successfully",
          data: updated,
        });
      } catch (error) {
        adminLogs.error("Update lender product failed", error);

        return reply.status(500).send({
          success: false,
          message: "Server error while updating lender product",
        });
      }
    }
  );
}

module.exports = updateLenderProductRoutes;
