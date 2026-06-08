async function loanOfficerStatus(fastify) {
  fastify.patch(
    "/:id/status",
    {
      schema: {
        tags: ["Admin -> Loan Officers"],
        summary: "Update loan officer status (platform admin)",
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
          roles: { some: { role: { name: "BROKER_OFFICER" } } },
        },
      });

      if (!user) {
        return reply.code(404).send({ success: false, message: "Loan officer not found" });
      }

      const updated = await prisma.userAccount.update({
        where: { id },
        data: { status },
      });

      return reply.send({
        success: true,
        message: "Loan officer status updated",
        data: { id: updated.id, status: updated.status },
      });
    },
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        tags: ["Admin -> Loan Officers"],
        summary: "Soft-delete loan officer (platform admin)",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { id } = req.params;

      const user = await prisma.userAccount.findFirst({
        where: {
          id,
          isDeleted: false,
          roles: { some: { role: { name: "BROKER_OFFICER" } } },
        },
      });

      if (!user) {
        return reply.code(404).send({ success: false, message: "Loan officer not found" });
      }

      await prisma.userAccount.update({
        where: { id },
        data: { isDeleted: true, status: "DISABLED" },
      });

      return reply.send({ success: true, message: "Loan officer removed" });
    },
  );
}

module.exports = loanOfficerStatus;
