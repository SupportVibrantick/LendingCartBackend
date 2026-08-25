module.exports = async function (fastify) {
  fastify.patch(
    "/manual-leads/:id",
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
          keyGenerator: (req) => `admin:${req.user?.userId ?? req.ip}`,
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Too Many Requests",
            success: false,
            message: "Too many requests. Please slow down.",
          }),
        },
      },
    },
    async (req, reply) => {
    const prisma = fastify.prisma;
    const { id } = req.params;
    const {
      firstName,
      lastName,
      email,
      phone,
      status,
      campaign,
      source,
    } = req.body || {};

    const data = {};
    if (firstName !== undefined) data.firstName = firstName?.trim() || null;
    if (lastName !== undefined) data.lastName = lastName?.trim() || null;
    if (email !== undefined) {
      if (!email?.trim()) {
        return reply.code(400).send({
          success: false,
          message: "Email is required",
        });
      }
      data.email = email.trim().toLowerCase();
    }
    if (phone !== undefined) data.phone = phone?.trim() || null;
    if (status !== undefined) data.status = status;
    if (campaign !== undefined) data.campaign = campaign?.trim() || null;
    if (source !== undefined) data.source = source?.trim() || "Admin";

    if (Object.keys(data).length === 0) {
      return reply.code(400).send({
        success: false,
        message: "No updatable fields provided",
      });
    }

    try {
      const lead = await prisma.adminManualLead.update({
        where: { id },
        data,
      });
      return reply.send({ success: true, data: lead });
    } catch (err) {
      if (err.code === "P2025") {
        return reply.code(404).send({
          success: false,
          message: "Lead not found",
        });
      }
      throw err;
    }
  });
};
