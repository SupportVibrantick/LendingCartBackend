const {
  saveIncompleteApplication,
  getIncompleteApplication,
} = require("../../services/applications/incompleteApplication.service");
const {
  resolveSubmitLoanProduct,
} = require("../../utils/applications/resolveSubmitLoanProduct");

function isBrokerOrgActor(user) {
  if (!user?.organizationId) return false;
  if (user.orgType === "BROKER") return true;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  return (
    roles.includes("SUB_BROKER") ||
    roles.includes("BROKER_OFFICER") ||
    roles.includes("BROKER_ADMIN")
  );
}

function registerIncompleteApplicationRoutes(fastify, { actor, preHandler }) {
  const hooks = preHandler ? { preHandler } : {};

  fastify.post(
    "/incomplete",
    {
      ...hooks,
      schema: {
        tags: [`${actor} -> Applications`],
        summary: "Save incomplete loan application",
      },
    },
    async (req, reply) => {
      if (!isBrokerOrgActor(req.user)) {
        return reply.code(403).send({
          success: false,
          message: "Broker access only",
        });
      }

      const brokerOrgId = req.user.organizationId;
      const userId = req.user.id || req.user.userId;
      const { applicationId, loanProductCode, applicationProductId, draft } =
        req.body || {};

      const resolvedProduct = await resolveSubmitLoanProduct(fastify.prisma, {
        loanProductCode,
        applicationProductId,
        brokerOrgId,
      });

      if (resolvedProduct.error) {
        return reply.code(resolvedProduct.error.status).send({
          success: false,
          message: resolvedProduct.error.message,
        });
      }

      try {
        const result = await saveIncompleteApplication(fastify.prisma, {
          applicationId: applicationId || null,
          brokerOrgId,
          userId,
          actor,
          loanProductCode: resolvedProduct.loanProductCode,
          applicationProductId: resolvedProduct.applicationProductId,
          draft,
        });

        if (result.error) {
          return reply.code(result.error.status).send({
            success: false,
            message: result.error.message,
          });
        }

        return reply.code(result.data.created ? 201 : 200).send({
          success: true,
          message: result.data.created
            ? "Incomplete application saved"
            : "Incomplete application updated",
          data: result.data,
        });
      } catch (error) {
        const status = error.statusCode || 500;
        fastify.log.error(
          { error: error.message, stack: error.stack },
          "Save incomplete application failed",
        );
        return reply.code(status).send({
          success: false,
          message: error.message || "Failed to save incomplete application",
        });
      }
    },
  );

  fastify.get(
    "/:applicationId/incomplete",
    {
      ...hooks,
      schema: {
        tags: [`${actor} -> Applications`],
        summary: "Load incomplete loan application draft",
      },
    },
    async (req, reply) => {
      if (!isBrokerOrgActor(req.user)) {
        return reply.code(403).send({
          success: false,
          message: "Broker access only",
        });
      }

      const result = await getIncompleteApplication(fastify.prisma, {
        applicationId: req.params.applicationId,
        brokerOrgId: req.user.organizationId,
        userId: req.user.id || req.user.userId,
        actor,
      });

      if (result.error) {
        return reply.code(result.error.status).send({
          success: false,
          message: result.error.message,
        });
      }

      return reply.send({
        success: true,
        data: result.data,
      });
    },
  );
}

module.exports = { registerIncompleteApplicationRoutes };
