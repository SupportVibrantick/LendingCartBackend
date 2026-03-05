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
        summary: "Update lender organization & admin",
        description:
          "Update lender organization details, lender admin user and broker access.",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          properties: {
            organizationName: { type: "string" },
            organizationEmail: { type: "string", format: "email" },
            organizationPhone: { type: "string" },
            organizationStatus: {
              type: "string",
              enum: ["ACTIVE", "INACTIVE"],
            },

            adminFirstName: { type: "string" },
            adminLastName: { type: "string" },
            adminEmail: { type: "string", format: "email" },
            adminPhone: { type: "string" },
            adminStatus: {
              type: "string",
              enum: ["ACTIVE", "INVITED", "DISABLED"],
            },
            adminPassword: { type: "string" },

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
        // CHECK LENDER ORGANIZATION
        // ===============================
        const lenderOrg = await prisma.organization.findFirst({
          where: {
            id: lenderOrgId,
            type: "LENDER",
            isDeleted: { not: true },
          },
        });

        if (!lenderOrg) {
          return reply.status(404).send({
            success: false,
            message: "Lender organization not found.",
          });
        }

        // ===============================
        // BROKER VALIDATION
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
              field: "brokerOrgId",
            });
          }
        }

        // ===============================
        // DUPLICATE CHECKS (ORG)
        // ===============================

        if (body.organizationName) {
          const exists = await prisma.organization.findFirst({
            where: {
              name: body.organizationName,
              id: { not: lenderOrgId },
            },
          });

          if (exists) {
            return reply.status(409).send({
              success: false,
              message: "Organization name already exists.",
              field: "organizationName",
            });
          }
        }

        if (body.organizationEmail) {
          const exists = await prisma.organization.findFirst({
            where: {
              email: body.organizationEmail,
              id: { not: lenderOrgId },
            },
          });

          if (exists) {
            return reply.status(409).send({
              success: false,
              message: "Organization email already exists.",
              field: "organizationEmail",
            });
          }
        }

        if (body.organizationPhone) {
          const exists = await prisma.organization.findFirst({
            where: {
              phone: body.organizationPhone,
              id: { not: lenderOrgId },
            },
          });

          if (exists) {
            return reply.status(409).send({
              success: false,
              message: "Organization phone already exists.",
              field: "organizationPhone",
            });
          }
        }

        // ===============================
        // FIND ADMIN USER
        // ===============================
        const adminUserRole = await prisma.userRole.findFirst({
          where: {
            role: { name: "LENDER_ADMIN" },
            user: { organizationId: lenderOrgId },
          },
          include: { user: true },
        });

        const adminUser = adminUserRole?.user;

        if (!adminUser) {
          return reply.status(404).send({
            success: false,
            message: "Lender admin user not found.",
          });
        }

        // ===============================
        // DUPLICATE ADMIN EMAIL
        // ===============================
        if (
          body.adminEmail &&
          body.adminEmail !== adminUser.email
        ) {
          const exists = await prisma.userAccount.findFirst({
            where: {
              email: body.adminEmail,
              id: { not: adminUser.id },
            },
          });

          if (exists) {
            return reply.status(409).send({
              success: false,
              message: "Admin email already in use.",
              field: "adminEmail",
            });
          }
        }

        // ===============================
        // TRANSACTION
        // ===============================

        const result = await prisma.$transaction(async (tx) => {
          let updatedOrg = null;
          let updatedAdmin = null;
          let brokerAccessUpdated = false;

          // -------------------
          // UPDATE ORGANIZATION
          // -------------------

          const orgUpdates = {};

          if (body.organizationName)
            orgUpdates.name = body.organizationName;

          if (body.organizationEmail)
            orgUpdates.email = body.organizationEmail;

          if (body.organizationPhone)
            orgUpdates.phone = body.organizationPhone;

          if (body.organizationStatus)
            orgUpdates.status = body.organizationStatus;

          if (Object.keys(orgUpdates).length) {
            updatedOrg = await tx.organization.update({
              where: { id: lenderOrgId },
              data: orgUpdates,
            });
          }

          // -------------------
          // UPDATE ADMIN
          // -------------------

          const adminUpdates = {};

          if (body.adminFirstName)
            adminUpdates.firstName = body.adminFirstName;

          if (body.adminLastName)
            adminUpdates.lastName = body.adminLastName;

          if (body.adminEmail)
            adminUpdates.email = body.adminEmail;

          if (body.adminPhone)
            adminUpdates.phone = body.adminPhone;

          if (body.adminStatus)
            adminUpdates.status = body.adminStatus;

          if (body.adminPassword) {
            adminUpdates.passwordHash = await bcrypt.hash(
              body.adminPassword,
              10
            );
          }

          if (Object.keys(adminUpdates).length) {
            updatedAdmin = await tx.userAccount.update({
              where: { id: adminUser.id },
              data: adminUpdates,
            });
          }

          // -------------------
          // BROKER ACCESS UPDATE
          // -------------------

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

        adminLogs.info("Lender updated successfully", {
          lenderOrgId,
          adminUserId: adminUser.id,
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