module.exports = async function (fastify) {
  fastify.patch("/:id/status", async (req, reply) => {
    const prisma = fastify.prisma;
    const { id } = req.params;
    const { status } = req.body;

    if (!Object.values(LeadStatus).includes(status)) {
      return reply.status(400).send({
        success: false,
        message: "Invalid status value",
      });
    }

    const lead = await prisma.commercialLendingMasteryLead.update({
      where: { id },
      data: { status },
    });

    return reply.send({ success: true, data: lead });
  });
};
