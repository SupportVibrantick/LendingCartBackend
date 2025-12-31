async function listLoanProducts(fastify) {
  fastify.get(
    "/",
    {
      schema:{
        tags:["Admin -> Loan Products"],
        summary:"List all loan products",
      }
    },
    async (_, reply)=>{
      const prisma = fastify.prisma;
      const products = await prisma.loanProduct.findMany({
        orderBy:{ createdAt:"desc" }
      });
      reply.send({ success:true, data:products });
    }
  );
}

module.exports = listLoanProducts;
