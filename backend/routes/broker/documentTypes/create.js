/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function createBrokerCustomDocumentType(fastify) {
  fastify.post("/", async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      if (!req.user?.organizationId || req.user.orgType !== "BROKER") {
        return reply.code(403).send({
          success: false,
          message: "Broker access only",
        });
      }

      const brokerOrgId = req.user.organizationId;
      const name = String(req.body?.name || "").trim();
      const description = String(req.body?.description || "").trim();

      if (name.length < 2) {
        return reply.code(400).send({
          success: false,
          message: "Document name must be at least 2 characters",
        });
      }

      const existing = await prisma.documentType.findFirst({
        where: {
          isCustom: true,
          createdByOrgId: brokerOrgId,
          isActive: true,
          name: { equals: name, mode: "insensitive" },
        },
      });

      if (existing) {
        return reply.code(409).send({
          success: false,
          message: "A custom document with this name already exists",
          data: existing,
        });
      }

      const created = await prisma.documentType.create({
        data: {
          name,
          description: description || null,
          isCustom: true,
          createdByOrgId: brokerOrgId,
          isActive: true,
        },
      });

      return reply.code(201).send({
        success: true,
        message: "Custom document created",
        data: { ...created, usageCount: 0, isProtected: false },
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error.message || "Failed to create custom document",
      });
    }
  });
}

module.exports = createBrokerCustomDocumentType;
