module.exports = async function (fastify) {
  fastify.post("/manual-leads", async (req, reply) => {
    const prisma = fastify.prisma;

    const {
      firstName,
      lastName,
      email,
      phone,
      status = "NEW",
      campaign,
      metadata,
      source = "Admin",
    } = req.body;

    if (!email) {
      return reply.code(400).send({
        success: false,
        message: "Email is required",
      });
    }

    const lead = await prisma.adminManualLead.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        status,
        campaign,
        metadata,
        source,
      },
    });

    return reply.send({ success: true, data: lead });
  });
};