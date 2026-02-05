module.exports = async function deleteSection(fastify) {
  fastify.delete("/:sectionId", async (req, reply) => {
    const { sectionId } = req.params;
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
        select: { id: true },
      });

    if (!section) {
      return reply.code(404).send({
        success: false,
        message: "Section not found",
      });
    }

    /* ===============================
       CHECK IF FIELDS EXIST
    =============================== */
    const fieldExists =
      await fastify.prisma.brokerApplicationProductField.findFirst({
        where: {
          sectionId,
        },
        select: { id: true },
      });

    if (fieldExists) {
      return reply.code(409).send({
        success: false,
        message:
          "Cannot delete section because fields are associated with it",
      });
    }

    /* ===============================
       DELETE SECTION
    =============================== */
    await fastify.prisma.brokerApplicationSection.delete({
      where: { id: sectionId },
    });

    return reply.send({
      success: true,
      message: "Section deleted successfully",
    });
  });
};