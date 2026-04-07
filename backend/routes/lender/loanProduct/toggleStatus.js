/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function toggleLenderLoanProductStatusRoutes(fastify) {
  fastify.patch(
    "/:id",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["Lender -> Loan Products"],
        summary: "Toggle or set Loan Product Status",
        description:
          "Enable/Disable lender loan product. If 'isActive' is passed, it will be set explicitly; otherwise it toggles.",
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
            isActive: { type: "boolean" }, // optional (explicit set)
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        // ---------------------------
        // 🔐 AUTH CHECK
        // ---------------------------
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

        // ---------------------------
        // 🔍 FIND & VERIFY OWNERSHIP
        // ---------------------------
        const existing = await prisma.lenderProduct.findFirst({
          where: {
            id,
            lenderOrgId,
          },
          select: {
            id: true,
            isActive: true,
          },
        });

        if (!existing) {
          return reply.status(404).send({
            success: false,
            message: "Loan product configuration not found",
          });
        }

        // ---------------------------
        // 🧠 DETERMINE NEW STATE
        // ---------------------------
        const newStatus =
          typeof isActive === "boolean"
            ? isActive // explicit control
            : !existing.isActive; // toggle fallback

        // Avoid unnecessary DB write
        if (newStatus === existing.isActive) {
          return reply.status(200).send({
            success: true,
            message: "No change in status",
            data: existing,
          });
        }

        // ---------------------------
        // 💾 UPDATE (SAFE)
        // ---------------------------
        const updated = await prisma.lenderProduct.update({
          where: { id },
          data: {
            isActive: newStatus,
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