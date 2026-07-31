const {
  LENDER_PRODUCT_INCLUDE,
  formatLenderProductListItem,
} = require("../../../utils/lender/formatLenderProductListItem");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function getLenderLoanProductRoutes(fastify) {
  fastify.get(
    "/:id",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Lender -> Loan Products"],
        summary: "Get a configured loan product by id",
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

      try {
        if (
          !req.user ||
          req.user.orgType !== "LENDER" ||
          !req.user.organizationId
        ) {
          return reply.status(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const { id } = req.params;

        const product = await prisma.lenderProduct.findFirst({
          where: { id, lenderOrgId },
          include: LENDER_PRODUCT_INCLUDE,
        });

        if (!product) {
          return reply.status(404).send({
            success: false,
            message: "Loan product configuration not found",
          });
        }

        return reply.send({
          success: true,
          data: formatLenderProductListItem(product),
        });
      } catch (error) {
        req.log.error(error);

        return reply.status(500).send({
          success: false,
          message: error.message || "Server error while fetching loan product",
        });
      }
    },
  );
}

module.exports = getLenderLoanProductRoutes;
