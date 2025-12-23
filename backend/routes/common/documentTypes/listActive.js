const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

module.exports = async function listActiveDocumentTypes(fastify) {
  fastify.get(
    "/active",
    {
      schema: {
        tags: ["Common -> Document Types"],
        summary: "Get active document types",
      },
    },
    async (req, reply) => {
      await fastify.authenticate(req, reply);

      const docs = await prisma.documentType.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
        },
        orderBy: { name: "asc" },
      });

      return {
        success: true,
        data: docs,
      };
    }
  );
};
