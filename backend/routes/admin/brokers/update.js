// routes/admin/brokers/update.js (simplified)
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { adminLogs } = require("../../../services/logger/contextLogger.js");
const bcrypt = require("bcrypt");

/**
 * PATCH /:id
 * - update broker fields (name, email, phone, status)
 * - optionally update one admin user (identified by id or email) with basic fields and password
 */
async function updateBrokerRoutes(fastify, options) {
  fastify.patch(
    "/:id",
    {
      schema: {
        tags: ["Admin -> Brokers"], // Swagger grouping
        summary: "Update broker and optional admin",
        description:
          "Update broker fields (name, email, phone, status). Optionally update a single admin user belonging to the broker.",
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string", format: "email" },
            phone: { type: "string" },
            status: { type: "string" },
            admin: {
              type: "object",
              properties: {
                id: { type: "string" },
                email: { type: "string", format: "email" },
                firstName: { type: "string" },
                lastName: { type: "string" },
                password: { type: "string" },
                status: { type: "string" },
              },
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  organization: {
                    type: ["object", "null"],
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      email: { type: ["string", "null"] },
                      phone: { type: ["string", "null"] },
                      status: { type: "string" },
                      updatedAt: { type: "string" },
                    },
                  },
                  admin: {
                    type: ["object", "null"],
                    properties: {
                      id: { type: "string" },
                      email: { type: "string" },
                      firstName: { type: ["string", "null"] },
                      lastName: { type: ["string", "null"] },
                      status: { type: "string" },
                      updatedAt: { type: "string" },
                    },
                  },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          500: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              details: { type: ["string", "null"] },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const orgId = request.params?.id;
      if (!orgId) return reply.status(400).send({ success: false, message: "Missing broker id" });

      try {
        const body = request.body || {};

        // Collect allowed org fields
        const allowedOrgFields = ["name", "email", "phone", "status"];
        const orgUpdates = {};
        for (const k of allowedOrgFields) {
          if (k in body && body[k] !== undefined) orgUpdates[k] = body[k];
        }

        // Admin update is optional
        const admin = body.admin; // { id?, email?, firstName?, lastName?, password?, status? }

        if (Object.keys(orgUpdates).length === 0 && !admin) {
          return reply.status(400).send({ success: false, message: "Nothing to update" });
        }

        // Basic existence check for organization
        const existingOrg = await prisma.organization.findUnique({ where: { id: orgId } });
        if (!existingOrg) return reply.status(404).send({ success: false, message: "Broker not found" });
        if (existingOrg.type !== "BROKER")
          return reply.status(400).send({ success: false, message: "Organization is not a broker" });

        // Prepare admin update if provided
        let adminUpdate = null;
        if (admin) {
          // identify admin user by id or email
          const adminWhere = admin.id ? { id: admin.id } : { email: admin.email };
          const foundAdmin = await prisma.userAccount.findFirst({ where: adminWhere });
          if (!foundAdmin) return reply.status(404).send({ success: false, message: "Admin user not found" });

          // ensure admin belongs to this org
          if (foundAdmin.organizationId !== orgId)
            return reply.status(400).send({ success: false, message: "Admin does not belong to this broker" });

          // build admin updates
          adminUpdate = {};
          for (const f of ["email", "firstName", "lastName", "status"]) {
            if (f in admin && admin[f] !== undefined) adminUpdate[f] = admin[f];
          }
          if (admin.password) {
            adminUpdate.passwordHash = await bcrypt.hash(admin.password, 10);
          }
          adminUpdate._id = foundAdmin.id; // keep id for the transaction
        }

        // Run the updates inside a transaction (atomic)
        let updatedOrg = null;
        let updatedAdmin = null;
        await prisma.$transaction(async (tx) => {
          if (Object.keys(orgUpdates).length) {
            updatedOrg = await tx.organization.update({
              where: { id: orgId },
              data: orgUpdates,
              select: { id: true, name: true, email: true, phone: true, status: true, updatedAt: true },
            });
          }

          if (adminUpdate) {
            const id = adminUpdate._id;
            delete adminUpdate._id;
            updatedAdmin = await tx.userAccount.update({
              where: { id },
              data: adminUpdate,
              select: { id: true, email: true, firstName: true, lastName: true, status: true, updatedAt: true },
            });
          }
        });

        adminLogs.info("Broker updated", { orgId, updatedOrg, updatedAdmin });
        return reply.status(200).send({
          success: true,
          message: "Updated successfully",
          data: { organization: updatedOrg, admin: updatedAdmin },
        });
      } catch (err) {
        adminLogs.error("Failed to update broker", { err, orgId });
        return reply.status(500).send({
          success: false,
          message: "Server error while updating broker",
          details: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
      }
    }
  );
}

module.exports = updateBrokerRoutes;
