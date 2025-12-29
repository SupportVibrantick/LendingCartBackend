const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

module.exports = async function (fastify) {
  fastify.post("/", async (req, reply) => {
    try {
      const { firstName, lastName, email, phone } = req.body;

      if (!email) {
        return reply.status(400).send({
          success: false,
          message: "Email is required",
        });
      }

      await prisma.commercialLendingMasteryLead.create({
        data: {
          firstName,
          lastName,
          email,
          phone,
          // source + status handled by schema defaults
        },
      });

      return reply.status(201).send({
        success: true,
        message: "Lead submitted successfully",
      });
    } catch (error) {
      req.log.error(error);
      return reply.status(500).send({
        success: false,
        message: "Internal server error",
      });
    }
  });
};
