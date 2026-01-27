module.exports = async function createTemplate(fastify) {
  fastify.post("/", async (req, reply) => {
    const { name, description } = req.body;

    if (!name || typeof name !== "string") {
      return reply.code(400).send({
        success: false,
        message: "Template name is required",
      });
    }

    const code = generateCode(name);

    const exists = await fastify.prisma.applicationTemplate.findUnique({
      where: { code },
    });

    if (exists) {
      return reply.code(400).send({
        success: false,
        message: "Template with same name already exists",
      });
    }

    const template = await fastify.prisma.applicationTemplate.create({
      data: {
        name,
        description,
        code,
        createdByUserId: req.user.id,
        isActive: false,
      },
    });

    reply.send({ success: true, data: template });
  });
};

function generateCode(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
