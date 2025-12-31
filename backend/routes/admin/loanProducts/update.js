const { updateLoanProductSchema } = require("../../../schemas/admin/loanProducts/update.schema.js");

async function updateLoanProduct(fastify) {
  fastify.patch(
    "/:id",
    {
      schema:{
        tags:["Admin -> Loan Products"],
        summary:"Update loan product details"
      }
    },
    async (req, reply)=>{
      const prisma = fastify.prisma;
      const validation = updateLoanProductSchema.safeParse(req.body);
      if(!validation.success) return reply.status(400).send({ success:false, message:"Invalid input" });

      const product = await prisma.loanProduct.update({
        where:{ id:req.params.id },
        data: validation.data
      });

      reply.send({ success:true, message:"Updated", data:product });
    }
  );
}

module.exports = updateLoanProduct;
