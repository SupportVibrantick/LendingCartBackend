module.exports = async function addTemplateField(fastify) {
  fastify.post("/", async (req, reply) => {
    const { productId } = req.params;
    const { sectionId, fieldKey, label, fieldType } = req.body;

    /* ===============================
       1. REQUIRED VALIDATION
    =============================== */

    if (!sectionId || !fieldKey || !label || !fieldType) {
      return reply.code(400).send({
        success: false,
        message: "sectionId, fieldKey, label and fieldType are required",
      });
    }

    /* ===============================
       2. VALIDATE SECTION BELONGS TO PRODUCT
    =============================== */

    const section =
      await fastify.prisma.applicationTemplateSection.findFirst({
        where: {
          id: sectionId,
          applicationTemplateProductId: productId,
        },
      });

    if (!section) {
      return reply.code(400).send({
        success: false,
        message: "Invalid sectionId for this product",
      });
    }

    /* ===============================
       3. CREATE FIELD
    =============================== */

    const field =
      await fastify.prisma.applicationTemplateProductField.create({
        data: {
          applicationTemplateProductId: productId,
          sectionId,
          ...req.body,
        },
      });

    reply.send({
      success: true,
      data: field,
    });
  });
};
