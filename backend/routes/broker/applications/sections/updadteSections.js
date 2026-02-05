module.exports = async function updateSection(fastify) {
  fastify.put("/:sectionId", async (req, reply) => {
    const { sectionId } = req.params;
    const { name, description, sortOrder, isActive } = req.body;

    const brokerOrgId = req.user.organizationId;

    /* ===============================
       VERIFY SECTION OWNERSHIP
    =============================== */
    const section =
      await fastify.prisma.brokerApplicationSection.findFirst({
        where: {
          id: sectionId,
          applicationProduct: {
            brokerApplication: {
              brokerOrgId,
            },
          },
        },
        select: {
          id: true,
          name: true,
          applicationProductId: true,
        },
      });

    if (!section) {
      return reply.code(404).send({
        success: false,
        message: "Section not found",
      });
    }

    /* ===============================
       VALIDATION
    =============================== */
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return reply.code(400).send({
          success: false,
          message: "Section name must be a non-empty string",
        });
      }

      // unique per product (exclude self)
      const duplicate =
        await fastify.prisma.brokerApplicationSection.findFirst({
          where: {
            applicationProductId: section.applicationProductId,
            name: name.trim(),
            NOT: { id: sectionId },
          },
          select: { id: true },
        });

      if (duplicate) {
        return reply.code(409).send({
          success: false,
          message: "Section with this name already exists",
        });
      }
    }

    const order =
      typeof sortOrder === "number" && sortOrder >= 0
        ? sortOrder
        : undefined;

    /* ===============================
       UPDATE SECTION
    =============================== */
    const updatedSection =
      await fastify.prisma.brokerApplicationSection.update({
        where: { id: sectionId },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(description !== undefined && { description }),
          ...(order !== undefined && { sortOrder: order }),
          ...(typeof isActive === "boolean" && { isActive }),
        },
      });

    return reply.send({
      success: true,
      data: updatedSection,
    });
  });
};