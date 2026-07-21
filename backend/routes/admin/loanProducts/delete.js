const { adminLogs } = require("../../../services/logger/contextLogger.js");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function deleteLoanProduct(fastify) {
  fastify.delete(
    "/:id",
    {
      schema: {
        tags: ["Admin -> Loan Products"],
        summary: "Delete loan product",
        description:
          "Deletes a global loan product when it is not assigned to any lender.",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { id } = req.params;

      try {
        const product = await prisma.loanProduct.findUnique({
          where: { id },
        });

        if (!product) {
          return reply.status(404).send({
            success: false,
            message: "Loan product not found",
          });
        }

        const lenderProductCount = await prisma.lenderProduct.count({
          where: {
            OR: [
              { loanProductId: id },
              { loanProductCode: product.code },
            ],
          },
        });

        if (lenderProductCount > 0) {
          return reply.status(409).send({
            success: false,
            message:
              "This loan product is assigned to one or more lenders and cannot be deleted. Deactivate it instead.",
            code: "PRODUCT_IN_USE",
          });
        }

        await prisma.$transaction(async (tx) => {
          await tx.productDocumentRequirement.deleteMany({
            where: { loanProductId: id },
          });

          await tx.loanProduct.delete({
            where: { id },
          });
        });

        adminLogs.info("Loan product deleted", {
          productId: id,
          code: product.code,
          name: product.name,
        });

        return reply.send({
          success: true,
          message: "Loan product deleted successfully",
        });
      } catch (error) {
        adminLogs.error("Loan product delete failed", error);
        return reply.status(500).send({
          success: false,
          message: "Server error while deleting loan product",
        });
      }
    },
  );
}

module.exports = deleteLoanProduct;
