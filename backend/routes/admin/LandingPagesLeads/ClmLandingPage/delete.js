const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

module.exports = async function (fastify) {
  fastify.delete("/:id", async (req, reply) => {
    const { id } = req.params;

    await prisma.clmLandingPageLead.delete({
      where: { id },
    });

    return reply.send({
      success: true,
      message: "Lead deleted successfully",
    });
  });
};
