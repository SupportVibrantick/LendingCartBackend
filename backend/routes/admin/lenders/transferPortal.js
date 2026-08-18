const { adminLogs } = require("../../../services/logger/contextLogger.js");
const {
  transferLenderPortalSchema,
} = require("../../../schemas/admin/lenders/transferPortal.schema.js");
const {
  transferLenderPortal,
  TransferLenderPortalError,
} = require("../../../services/lenders/transferLenderPortal.js");

async function transferLenderPortalRoutes(fastify) {
  fastify.post(
    "/:id",
    {
      schema: {
        tags: ["Admin -> Lenders"],
        summary: "Transfer lender portal access to a new contact",
        description:
          "Replaces the primary lender portal contact while keeping the same lender organization and all existing data.",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          required: ["firstName", "lastName", "email", "phone"],
          properties: {
            firstName: { type: "string" },
            lastName: { type: "string" },
            email: { type: "string", format: "email" },
            phone: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;
      const lenderOrgId = request.params.id;

      try {
        const validation = transferLenderPortalSchema.safeParse(request.body);
        if (!validation.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input data.",
            errors: validation.error.issues.map((err) => ({
              field: err.path[0],
              message: err.message,
            })),
          });
        }

        const result = await transferLenderPortal(prisma, {
          lenderOrgId,
          ...validation.data,
          actor: request.user || {},
        });

        adminLogs.info("Lender portal transferred", {
          lenderOrgId,
          oldContactId: result.oldContact?.id,
          newContactId: result.newContact?.id,
          actorUserId: request.user?.userId || request.user?.id,
        });

        return reply.send({
          success: true,
          message:
            "Lender portal transferred. An invitation email was sent to the new contact.",
          data: result,
        });
      } catch (error) {
        if (error instanceof TransferLenderPortalError) {
          return reply.status(error.statusCode).send({
            success: false,
            message: error.message,
            field: error.extra?.field,
          });
        }

        adminLogs.error("Lender portal transfer failed", error);
        return reply.status(500).send({
          success: false,
          message: "Server error occurred while transferring the lender portal.",
        });
      }
    },
  );
}

module.exports = transferLenderPortalRoutes;
