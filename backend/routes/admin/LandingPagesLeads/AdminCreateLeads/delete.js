module.exports = async function (fastify) {
  fastify.delete("/manual-leads/:id", async (req, reply) => {
    const prisma = fastify.prisma;
    const { id } = req.params;

    try {
      await prisma.adminManualLead.delete({ where: { id } });
    } catch (err) {
      if (err.code === "P2025") {
        return reply.code(404).send({
          success: false,
          message: "Lead not found",
        });
      }
      throw err;
    }

    return reply.send({
      success: true,
      message: "Lead deleted successfully",
    });
  });
};
