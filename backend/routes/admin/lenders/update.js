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
            // ORGANIZATION FIELDS
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
                status: {
                  type: "string",
                  enum: ["ACTIVE", "INVITED", "DISABLED"],
                },
                password: { type: "string" },
              },
            },

            // OPTIONAL: broker reassignment
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
        // ===============================
        // 1. CHECK IF LENDER EXISTS
        // ===============================
        const existingOrg = await prisma.organization.findFirst({
          where: {
            id: lenderOrgId,
            type: "LENDER",
            isDeleted: { not: true },
          },
        });

        if (!existingOrg) {
          return reply.status(404).send({
            success: false,
            message: "Lender organization not found.",
          });
        }

        // ===============================
        // 2. VALIDATE BROKER ORG
        // ===============================
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
              message:
                "Invalid brokerOrgId. Broker organization not found or inactive.",
            });
          }
        }

        // ===============================
        // 3. DUPLICATE CHECK FOR ORG
        // ===============================
        if (body.name || body.email || body.phone) {
          const duplicateOrg = await prisma.organization.findFirst({
            where: {
              id: { not: lenderOrgId },
              OR: [
                body.name ? { name: body.name } : undefined,
                body.email ? { email: body.email } : undefined,
                body.phone ? { phone: body.phone } : undefined,
              ].filter(Boolean),
            },
          });

          if (duplicateOrg) {
            return reply.status(409).send({
              success: false,
              message:
                "Another organization already uses this name, email, or phone.",
            });
          }
        }

        // ===============================
        // 4. FIND LENDER ADMIN USER
        // ===============================
        const adminUserRole = await prisma.userRole.findFirst({
          where: {
            role: { name: "LENDER_ADMIN" },
            user: { organizationId: lenderOrgId },
          },
          include: { user: true },
        });

        const adminUser = adminUserRole?.user || null;

        // ===============================
        // 5. DUPLICATE CHECK FOR ADMIN EMAIL
        // ===============================
        if (
          body.admin?.email &&
          adminUser &&
          body.admin.email !== adminUser.email
        ) {
          const duplicateUser = await prisma.userAccount.findFirst({
            where: {
              email: body.admin.email,
              id: { not: adminUser.id },
            },
          });

          if (duplicateUser) {
            return reply.status(409).send({
              success: false,
              message: "Another user already uses this admin email.",
            });
          }
        }

        // ===============================
        // 6. TRANSACTION
        // ===============================
        const result = await prisma.$transaction(async (tx) => {
          let updatedOrg = null;
          let updatedAdmin = null;
          let brokerAccessUpdated = false;

          // -------------------------
          // UPDATE ORGANIZATION
          // -------------------------
          const orgUpdates = {};

          ["name", "email", "phone", "status"].forEach((key) => {
            if (body[key] !== undefined) {
              orgUpdates[key] = body[key];
            }
          });

          if (Object.keys(orgUpdates).length > 0) {
            updatedOrg = await tx.organization.update({
              where: { id: lenderOrgId },
              data: orgUpdates,
            });
          }

          // -------------------------
          // UPDATE ADMIN USER
          // -------------------------
          if (adminUser && body.admin) {
            const userUpdates = {};

            ["firstName", "lastName", "email", "phone", "status"].forEach(
              (key) => {
                if (body.admin[key] !== undefined) {
                  userUpdates[key] = body.admin[key];
                }
              }
            );

            // password update
            if (body.admin.password) {
              userUpdates.passwordHash = await bcrypt.hash(
                body.admin.password,
                10
              );
            }

            if (Object.keys(userUpdates).length > 0) {
              updatedAdmin = await tx.userAccount.update({
                where: { id: adminUser.id },
                data: userUpdates,
              });
            }
          }

          // -------------------------
          // UPDATE BROKER ACCESS
          // -------------------------
          if (body.brokerOrgId !== undefined) {
            await tx.brokerLenderAccess.deleteMany({
              where: { lenderOrgId },
            });

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

        // ===============================
        // LOG SUCCESS
        // ===============================
        adminLogs.info("Lender updated successfully", {
          lenderOrgId,
          adminUserId: adminUser?.id || null,
          brokerAccessUpdated: result.brokerAccessUpdated,
        });

        // ===============================
        // RESPONSE
        // ===============================
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
          details:
            process.env.NODE_ENV === "development"
              ? error.message
              : undefined,
        });
      }
    }
  );
}

module.exports = updateLenderRoutes;