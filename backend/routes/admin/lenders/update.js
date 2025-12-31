// routes/admin/lenders/update.js
const { adminLogs } = require("../../../services/logger/contextLogger.js");
const bcrypt = require("bcrypt");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function updateLenderRoutes(fastify) {
  fastify.patch(
    "/:id",
    {
      schema: {
        tags: ["Admin -> Lenders"],
        summary: "Update lender organization & admin user",
        description:
          "Updates a LENDER organization, its admin user (LENDER_ADMIN), and optionally broker-lender access.",
        params: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            // ORG FIELDS
            name: { type: "string" },
            email: { type: "string", format: "email" },
            phone: { type: "string" },
            status: { type: "string", enum: ["ACTIVE", "INACTIVE"] },

            // ADMIN USER FIELDS
            admin: {
              type: "object",
              properties: {
                firstName: { type: "string" },
                lastName: { type: "string" },
                email: { type: "string", format: "email" },
                phone: { type: "string" },
                status: { type: "string", enum: ["ACTIVE", "INVITED", "DISABLED"] },
                password: { type: "string" },
              },
            },

            // OPTIONAL: re-assign to broker
            brokerOrgId: { type: "string", format: "uuid", nullable: true },
          },
        },
      },
    },

    async (request, reply) => {
      const prisma = fastify.prisma;
      const lenderOrgId = request.params.id;
      const body = request.body || {};

      try {
        // ====== 1) Fetch lender org ======
        const existingOrg = await prisma.organization.findFirst({
          where: { id: lenderOrgId, type: "LENDER", isDeleted: { not: true } },
        });

        if (!existingOrg) {
          return reply.status(404).send({
            success: false,
            message: "Lender organization not found.",
          });
        }

        // ====== 2) Validate brokerOrgId ======
        let brokerOrg = null;
        if (body.brokerOrgId) {
          brokerOrg = await prisma.organization.findFirst({
            where: {
              id: body.brokerOrgId,
              type: "BROKER",
              isDeleted: { not: true },
            },
          });

          if (!brokerOrg) {
            return reply.status(400).send({
              success: false,
              message: "Invalid brokerOrgId. Broker not found or inactive.",
            });
          }
        }

        // ====== 3) Duplicate checks ======
        if (body.email || body.phone || body.name) {
          const dup = await prisma.organization.findFirst({
            where: {
              id: { not: lenderOrgId },
              OR: [
                body.name ? { name: body.name } : undefined,
                body.email ? { email: body.email } : undefined,
                body.phone ? { phone: body.phone } : undefined,
              ].filter(Boolean),
            },
          });

          if (dup) {
            return reply.status(409).send({
              success: false,
              message: "Another organization already uses this name/email/phone.",
            });
          }
        }

        // ====== 4) Find Admin User ======
        const adminUserRole = await prisma.userRole.findFirst({
          where: {
            role: { name: "LENDER_ADMIN" },
            user: { organizationId: lenderOrgId },
          },
          include: { user: true },
        });

        const adminUser = adminUserRole?.user || null;

        // If admin.email is being changed → check duplicates
        if (body.admin?.email && body.admin.email !== adminUser?.email) {
          const dupUser = await prisma.userAccount.findFirst({
            where: { email: body.admin.email },
          });

          if (dupUser) {
            return reply.status(409).send({
              success: false,
              message: "Another user already uses this admin email.",
            });
          }
        }

        // ====== 5) TRANSACTION ======
        const result = await prisma.$transaction(async (tx) => {
          let updatedOrg = null;
          let updatedAdmin = null;
          let brokerAccessUpdated = false;

          // --- update organization ---
          const orgUpdates = {};
          ["name", "email", "phone", "status"].forEach((k) => {
            if (body[k] !== undefined) orgUpdates[k] = body[k];
          });

          if (Object.keys(orgUpdates).length > 0) {
            updatedOrg = await tx.organization.update({
              where: { id: lenderOrgId },
              data: orgUpdates,
            });
          }

          // --- update admin user ---
          if (adminUser && body.admin) {
            const userUpdates = {};
            ["firstName", "lastName", "email", "phone", "status"].forEach((k) => {
              if (body.admin[k] !== undefined) userUpdates[k] = body.admin[k];
            });

            if (body.admin.password) {
              userUpdates.passwordHash = await bcrypt.hash(body.admin.password, 10);
            }

            updatedAdmin = await tx.userAccount.update({
              where: { id: adminUser.id },
              data: userUpdates,
            });
          }

          // --- update broker-lender access ---
          if (body.brokerOrgId !== undefined) {
            // Delete old access
            await tx.brokerLenderAccess.deleteMany({
              where: { lenderOrgId },
            });

            // Create new access if brokerOrgId provided
            if (brokerOrg) {
              await tx.brokerLenderAccess.create({
                data: {
                  brokerOrgId: brokerOrg.id,
                  lenderOrgId,
                  source: "PLATFORM_DEFAULT",
                  isActive: true,
                },
              });

              brokerAccessUpdated = true;
            }
          }

          return {
            updatedOrg,
            updatedAdmin,
            brokerAccessUpdated,
          };
        });

        adminLogs.info("Lender updated", {
          lenderOrgId,
          adminUserId: adminUser?.id || null,
          brokerAccessUpdated: result.brokerAccessUpdated,
        });

        return reply.send({
          success: true,
          message: "Lender updated successfully.",
          data: result,
        });
      } catch (error) {
        adminLogs.error("Lender update failed", error);
        return reply.status(500).send({
          success: false,
          message: "Server error occurred while updating lender.",
          details: process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }
    }
  );
}

module.exports = updateLenderRoutes;
