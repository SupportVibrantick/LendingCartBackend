async function subBrokerStatus(fastify) {
  fastify.patch(
    "/:id/status",
    {
      schema: {
        tags: ["Admin -> Sub-Brokers"],
        summary: "Update sub-broker status (platform admin)",
        body: {
          type: "object",
          required: ["status"],
          properties: {
            status: { type: "string", enum: ["ACTIVE", "DISABLED", "INVITED"] },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { id } = req.params;
      const { status } = req.body;

      const user = await prisma.userAccount.findFirst({
        where: {
          id,
          isDeleted: false,
          roles: { some: { role: { name: "SUB_BROKER" } } },
        },
      });

      if (!user) {
        return reply.code(404).send({ success: false, message: "Sub-broker not found" });
      }

      const updated = await prisma.userAccount.update({
        where: { id },
        data: { status },
      });

      return reply.send({
        success: true,
        message: "Sub-broker status updated",
        data: { id: updated.id, status: updated.status },
      });
    },
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        tags: ["Admin -> Sub-Brokers"],
        summary: "Soft-delete sub-broker (platform admin)",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { id } = req.params;

      const user = await prisma.userAccount.findFirst({
        where: {
          id,
          isDeleted: false,
          roles: { some: { role: { name: "SUB_BROKER" } } },
        },
      });

      if (!user) {
        return reply.code(404).send({ success: false, message: "Sub-broker not found" });
      }

      await prisma.userAccount.update({
        where: { id },
        data: { isDeleted: true, status: "DISABLED" },
      });

      return reply.send({ success: true, message: "Sub-broker removed" });
    },
  );
}

module.exports = subBrokerStatus;
