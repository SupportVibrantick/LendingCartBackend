module.exports = async function (fastify) {
  fastify.get(
    "/:loanId/fee-agreement",
    {
      schema: {
        tags: ["Loan Pipeline → Fee Agreement"],
        summary: "Get Fee Agreement for a loan",
        params: {
          type: "object",
          required: ["loanId"],
          properties: {
            loanId: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const prisma = fastify.prisma;
        const { loanId } = req.params;

        // 🔐 Auth check
        if (!req.user) {
          return reply.code(401).send({
            ok: false,
            message: "Unauthorized",
          });
        }

        // 📥 Fetch agreement
        const agreement = await prisma.feeAgreement.findUnique({
          where: { loanApplicationId: loanId },
        });

        if (!agreement) {
          return reply.code(404).send({
            ok: false,
            message: "Fee Agreement not found",
          });
        }

        // 🔐 ROLE-BASED ACCESS

        // Broker / Admin → full access
        if (
          req.user.orgType === "BROKER" ||
          req.user.role === "PLATFORM_ADMIN"
        ) {
          return {
            ok: true,
            data: agreement,
          };
        }

        // Client → only if belongs to same client
        if (req.user.role === "CLIENT_USER") {
          const loan = await prisma.loanApplication.findUnique({
            where: { id: loanId },
            select: { clientId: true },
          });

          if (loan?.clientId !== req.user.clientId) {
            return reply.code(403).send({
              ok: false,
              message: "Access denied",
            });
          }

          return {
            ok: true,
            data: agreement,
          };
        }

        // ❌ Default deny
        return reply.code(403).send({
          ok: false,
          message: "Forbidden",
        });
      } catch (err) {
        req.log.error(err);

        return reply.code(500).send({
          ok: false,
          message: "Failed to fetch Fee Agreement",
        });
      }
    }
  );
};