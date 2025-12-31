async function listLenderLoanProductsRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Lender -> Loan Products"],
        summary: "List configured loan products",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const lenderOrgId = req.user.organizationId;

      const products = await prisma.lenderProduct.findMany({
        where: { lenderOrgId },
        include: { loanProduct: true },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({
        success: true,
        data: products,
      });
    }
  );
}

module.exports = listLenderLoanProductsRoutes;
