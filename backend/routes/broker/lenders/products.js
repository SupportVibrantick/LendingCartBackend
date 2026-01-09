/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function lenderProductsRoutes(fastify) {
  fastify.get(
    "/:lenderOrgId",
    {
      schema: {
        tags: ["Broker -> Lenders"],
        summary: "Get lender loan products",
        description: "Broker can view products of a connected lender",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      if (!req.user || req.user.orgType !== "BROKER") {
        return reply.code(403).send({
          success: false,
          message: "Broker access only",
        });
      }

      const brokerOrgId = req.user.organizationId;
      const { lenderOrgId } = req.params;

      // 🔐 Step 1: Verify connection
      const access = await prisma.brokerLenderAccess.findFirst({
        where: {
          brokerOrgId,
          lenderOrgId,
          isActive: true,
        },
      });

      if (!access) {
        return reply.code(403).send({
          success: false,
          message: "You are not connected to this lender",
        });
      }

      // 📦 Step 2: Fetch lender products
      const products = await prisma.lenderProduct.findMany({
        where: {
          lenderOrgId,
        },
        include: {
          loanProduct: {
            select: {
              name: true,
              description: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return reply.send({
        success: true,
        data: products.map((p) => ({
          lenderProductId: p.id,
          loanProductCode: p.loanProductCode,
          loanProductName: p.loanProduct?.name || p.loanProductCode,
          minLoanAmount: p.minLoanAmount,
          maxLoanAmount: p.maxLoanAmount,
          termRange:
            p.minTermMonths && p.maxTermMonths
              ? `${p.minTermMonths} - ${p.maxTermMonths} months`
              : null,
          regionsSupported: p.regionsSupported,
          industriesSupported: p.industriesSupported,
          isActive: p.isActive,
        })),
      });
    }
  );
}

module.exports = lenderProductsRoutes;
