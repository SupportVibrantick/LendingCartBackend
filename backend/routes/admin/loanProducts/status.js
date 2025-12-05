const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { updateLoanProductStatusSchema } = require("../../../schemas/admin/loanProducts/status.schema.js");

async function updateLoanProductStatus(fastify){
  fastify.patch(
    "/:id/status",
    {
      schema:{
        tags:["Admin -> Loan Products"],
        summary:"Enable/Disable loan product"
      }
    },
    async(req, reply)=>{
      const validation = updateLoanProductStatusSchema.safeParse(req.body);
      if(!validation.success) return reply.status(400).send({ success:false,message:"Invalid Input" });

      const updated = await prisma.loanProduct.update({
        where:{ id:req.params.id },
        data:{ isActive:req.body.isActive }
      });

      reply.send({ success:true, message:"Status updated", data:updated });
    }
  );
}

module.exports = updateLoanProductStatus;
