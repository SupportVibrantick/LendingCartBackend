module.exports = async function (fastify) {
  fastify.delete("/:id", async (req, reply) => {
    const prisma = fastify.prisma;
    const { id } = req.params;

    await prisma.loanAiBookDemoLead.delete({
      where: { id },
    });

    return reply.send({
      success: true,
      message: "Lead deleted successfully",
    });
  });
};
