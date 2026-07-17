async function listLoanProducts(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Loan Products"],
        summary: "List all loan products",
      },
    },
    async (_, reply) => {
      const prisma = fastify.prisma;
      const {
        sortLoanProductsByPriority,
      } = require("../../../utils/loanProducts/sortLoanProductsByPriority");

      const products = await prisma.loanProduct.findMany();
      const sortedProducts = sortLoanProductsByPriority(products);

      reply.send({ success: true, data: sortedProducts });
    },
  );
}

module.exports = listLoanProducts;
