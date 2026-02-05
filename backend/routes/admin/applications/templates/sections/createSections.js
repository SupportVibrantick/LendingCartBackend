module.exports = async function addTemplateSection(fastify) {
  fastify.post("/", async (req, reply) => {
    const { productId } = req.params;
    const { name, description, sortOrder } = req.body;

    /* ===============================
       1. BASIC VALIDATION
    =============================== */

    if (!name) {
      return reply.code(400).send({
        success: false,
        message: "section name is required",
      });
    }

    /* ===============================
       2. CREATE SECTION
    =============================== */

    const section =
      await fastify.prisma.applicationTemplateSection.create({
        data: {
          applicationTemplateProductId: productId,
          name,
          description: description || null,
          sortOrder: sortOrder ?? null,
        },
      });

    reply.send({
      success: true,
      data: section,
    });
  });
};
