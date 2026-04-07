async function toggleLenderLoanProductStatusRoutes(fastify) {
  fastify.patch(
    "/:id",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Lender -> Loan Products"],
        summary: "Toggle or set Loan Product Status",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            isActive: { type: "boolean" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        // 🔐 AUTH
        if (
          !req.user ||
          req.user.orgType !== "LENDER" ||
          !req.user.organizationId
        ) {
          return reply.status(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const { id } = req.params;
        const { isActive } = req.body || {};

        // 🔍 FETCH EXISTING
        const existing = await prisma.lenderProduct.findFirst({
          where: { id, lenderOrgId },
          select: { id: true, isActive: true },
        });

        if (!existing) {
          return reply.status(404).send({
            success: false,
            message: "Loan product configuration not found",
          });
        }

        // 🧠 DETERMINE STATUS
        const newStatus =
          typeof isActive === "boolean"
            ? isActive
            : !existing.isActive;

        // 🚫 NO CHANGE
        if (newStatus === existing.isActive) {
          return reply.send({
            success: true,
            message: "No change in status",
            data: existing,
          });
        }

        // 💾 UPDATE
        const updated = await prisma.lenderProduct.update({
          where: { id },
          data: { isActive: newStatus },
          select: {
            id: true,
            isActive: true,
            loanProductCode: true,
          },
        });

        return reply.send({
          success: true,
          message: `Loan product ${
            updated.isActive ? "activated" : "deactivated"
          } successfully`,
          data: updated,
        });
      } catch (error) {
        req.log.error(error);

        return reply.status(500).send({
          success: false,
          message:
            error.message ||
            "Server error while toggling loan product status",
        });
      }
    }
  );
}

module.exports = toggleLenderLoanProductStatusRoutes;