module.exports = async function (fastify) {
  fastify.delete("/:id", async (req, reply) => {
    const prisma = fastify.prisma;
    const { id } = req.params;

    await prisma.commercialLendingMasteryLead.delete({
      where: { id },
    });

    return reply.send({
      success: true,
      message: "Lead deleted successfully",
    });
  });
};
