module.exports = async function addTemplateProduct(fastify) {
  fastify.post("/", async (req, reply) => {
    const { templateId } = req.params;
    const { loanProductCode } = req.body;

    if (!loanProductCode) {
      return reply.code(400).send({
        success: false,
        message: "loanProductCode is required",
      });
    }

    const product = await fastify.prisma.applicationTemplateProduct.create({
      data: {
        applicationTemplateId: templateId,
        loanProductCode,
      },
    });

    reply.send({ success: true, data: product });
  });
};
