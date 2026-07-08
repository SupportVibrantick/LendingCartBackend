/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function createCustomDocumentTypeRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Lender -> Document Config"],
        summary: "Create lender custom document type",
        body: {
          type: "object",
          required: ["name"],
          additionalProperties: false,
          properties: {
            name: { type: "string", minLength: 2, maxLength: 120 },
            description: { type: "string", maxLength: 500 },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user || req.user.orgType !== "LENDER" || !req.user.organizationId) {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;
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
            isActive: true,
            isCustom: true,
            createdByOrgId: lenderOrgId,
            name: {
              equals: name,
              mode: "insensitive",
            },
          },
        });

        if (existing) {
          return reply.send({
            success: true,
            message: "Custom document already exists",
            data: existing,
          });
        }

        const created = await prisma.documentType.create({
          data: {
            name,
            description: description || null,
            isCustom: true,
            createdByOrgId: lenderOrgId,
            isActive: true,
          },
        });

        return reply.code(201).send({
          success: true,
          message: "Custom document created",
          data: created,
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message, stack: error.stack },
          "Create custom document type failed",
        );
        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    },
  );
}

module.exports = createCustomDocumentTypeRoutes;
