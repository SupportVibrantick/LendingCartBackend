const {
  deactivateBrokerCustomDocumentType,
} = require("../../../utils/documents/brokerCustomDocumentType");
const {
  requireLoCustomDocumentsManage,
} = require("../../../services/broker/loanOfficerAccess");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function deactivateBrokerCustomDocumentTypeRoute(fastify) {
  fastify.patch(
    "/:id/deactivate",
    {
      preHandler: async (req, reply) => {
        await requireLoCustomDocumentsManage(req, reply, fastify);
      },
    },
    async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      if (!req.user?.organizationId || req.user.orgType !== "BROKER") {
        return reply.code(403).send({
          success: false,
          message: "Broker access only",
        });
      }

      const brokerOrgId = req.user.organizationId;
      const { id } = req.params;

      const result = await deactivateBrokerCustomDocumentType(
        prisma,
        id,
        brokerOrgId,
      );

      if (!result.ok) {
        if (result.reason === "NOT_FOUND") {
          return reply.code(404).send({
            success: false,
            message: "Custom document not found",
          });
        }
        if (result.reason === "PROTECTED") {
          return reply.code(400).send({
            success: false,
            message: "This system document cannot be removed",
          });
        }
        if (result.reason === "IN_USE") {
          return reply.code(400).send({
            success: false,
            message:
              "This document is linked to loan applications and cannot be removed",
            data: { usageCount: result.usageCount },
          });
        }
        return reply.code(400).send({
          success: false,
          message: "Unable to deactivate document",
        });
      }

      return reply.send({
        success: true,
        message: "Custom document removed",
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error.message || "Failed to remove custom document",
      });
    }
    },
  );
}

module.exports = deactivateBrokerCustomDocumentTypeRoute;
