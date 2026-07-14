/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function getClientApplicationLink(fastify) {
  fastify.get(
    "/client-application-link",
    {
      schema: {
        tags: ["Broker -> Loan Pipeline"],
        summary: "Get shareable client loan application link for this broker",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = req.user.organizationId;

        const organization = await prisma.organization.findUnique({
          where: { id: brokerOrgId },
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
          },
        });

        if (!organization) {
          return reply.code(404).send({
            success: false,
            message: "Broker organization not found",
          });
        }

        const activeProductCount = await prisma.loanProduct.count({
          where: { isActive: true },
        });

        const embedBase = (
          process.env.EMBED_APP_URL ||
          process.env.VITE_EMBED_APP_URL ||
          ""
        ).replace(/\/$/, "");

        const sharePath = `/get-loan?broker=${encodeURIComponent(brokerOrgId)}`;
        const shareUrl = embedBase ? `${embedBase}${sharePath}` : sharePath;

        // Catalog products replace Application Builder — link is shareable when
        // the broker org exists (fallback form codes always available on embed).
        return reply.send({
          success: true,
          data: {
            brokerOrgId,
            brokerName: organization.name,
            brokerEmail: organization.email,
            hasActiveApplication: true,
            catalogProductCount: activeProductCount,
            applicationId: null,
            applicationName: null,
            sharePath,
            shareUrl,
            embedBaseUrl: embedBase || null,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: "Failed to build client application link",
        });
      }
    },
  );
};
