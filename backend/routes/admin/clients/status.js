async function clientStatus(fastify) {
  fastify.patch(
    "/:id/status",
    {
      schema: {
        tags: ["Admin -> Clients"],
        summary: "Activate or suspend client (platform admin)",
        body: {
          type: "object",
          required: ["isActive"],
          properties: {
            isActive: { type: "boolean" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { id } = req.params;
      const { isActive } = req.body;

      const client = await prisma.client.findFirst({
        where: { id, isDeleted: { not: true } },
      });

      if (!client) {
        return reply.code(404).send({ success: false, message: "Client not found" });
      }

      const updated = await prisma.client.update({
        where: { id },
        data: { isActive },
      });

      return reply.send({
        success: true,
        message: isActive ? "Client activated" : "Client suspended",
        data: { id: updated.id, isActive: updated.isActive },
      });
    },
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        tags: ["Admin -> Clients"],
        summary: "Soft-delete client (platform admin)",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { id } = req.params;

      const client = await prisma.client.findFirst({
        where: { id, isDeleted: { not: true } },
      });

      if (!client) {
        return reply.code(404).send({ success: false, message: "Client not found" });
      }

      await prisma.client.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date(), isActive: false },
      });

      return reply.send({ success: true, message: "Client removed" });
    },
  );
}

module.exports = clientStatus;
