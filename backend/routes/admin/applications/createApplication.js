module.exports = async function createApplication(fastify) {
  fastify.post("/", async (req, reply) => {
    const { name, brokerOrgId } = req.body;

    // Validation
    if (!name || typeof name !== "string") {
      return reply.code(400).send({
        success: false,
        message: "Application name is required",
      });
    }

    if (!brokerOrgId) {
      return reply.code(400).send({
        success: false,
        message: "brokerOrgId is required",
      });
    }

    const baseCode = generateCode(name);
    let code = baseCode;
    let counter = 1;

    // Ensure uniqueness per broker
    while (
      await fastify.prisma.brokerApplication.findFirst({
        where: {
          brokerOrgId,
          code,
        },
      })
    ) {
      code = `${baseCode}-${counter++}`;
    }

    const app = await fastify.prisma.brokerApplication.create({
      data: {
        brokerOrgId,
        name,
        code,
        isActive: false,
      },
    });

    reply.send({ success: true, data: app });
  });
};

function generateCode(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
