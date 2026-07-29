const {
  listLenderLoiVersions,
  getCurrentLenderLoiVersion,
  formatLenderLoiVersion,
} = require("../../../services/loi/loiVersionService");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function loiVersionsRoute(fastify) {
  fastify.get(
    "/:applicationLenderId/loi-versions",
    {
      schema: {
        tags: ["Lender -> Loan Pipeline"],
        summary: "List all LOI versions for audit trail",
        params: {
          type: "object",
          required: ["applicationLenderId"],
          properties: {
            applicationLenderId: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (
          !req.user ||
          req.user.orgType !== "LENDER" ||
          !req.user.organizationId
        ) {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const { applicationLenderId } = req.params;

        const lenderRecord = await prisma.applicationLender.findFirst({
          where: { id: applicationLenderId, lenderOrgId },
          select: { id: true },
        });

        if (!lenderRecord) {
          return reply.code(404).send({
            success: false,
            message: "Application not found",
          });
        }

        const versions = await listLenderLoiVersions(
          prisma,
          applicationLenderId,
        );
        const current = await getCurrentLenderLoiVersion(
          prisma,
          applicationLenderId,
        );

        return reply.send({
          success: true,
          data: {
            versions,
            current: current ? formatLenderLoiVersion(current) : null,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to load LOI versions",
        });
      }
    },
  );
}

module.exports = loiVersionsRoute;
