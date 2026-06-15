const { adminLogs } = require("../../../services/logger/contextLogger.js");

const CONTACT_FIELDS = [
  "contactType",
  "firstName",
  "lastName",
  "email",
  "companyName",
  "website",
  "phone",
  "tollFree",
  "cellNumber",
  "faxNumber",
  "address",
  "city",
  "state",
  "zipCode",
  "stateOfFormation",
  "entityType",
  "description",
];

function pickContactData(body = {}) {
  const data = {};
  for (const key of CONTACT_FIELDS) {
    if (body[key] !== undefined) {
      data[key] = body[key];
    }
  }
  return data;
}

async function getBrokerOrg(prisma, orgId) {
  return prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, type: true, name: true },
  });
}

async function getBrokerContact(prisma, orgId, contactId) {
  return prisma.contact.findFirst({
    where: {
      id: contactId,
      brokerOrgId: orgId,
      isDeleted: false,
    },
  });
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function brokerContactsRoutes(fastify) {
  fastify.get("/:orgId", async (request, reply) => {
    const prisma = fastify.prisma;
    const { orgId } = request.params;
    const q = request.query || {};

    try {
      const org = await getBrokerOrg(prisma, orgId);
      if (!org) {
        return reply.status(404).send({ success: false, message: "Broker not found" });
      }
      if (org.type !== "BROKER") {
        return reply.status(400).send({ success: false, message: "Organization is not a broker" });
      }

      const page = Math.max(parseInt(q.page || "1", 10), 1);
      const limit = Math.min(Math.max(parseInt(q.limit || "50", 10), 1), 100);
      const skip = (page - 1) * limit;
      const search = (q.search || "").trim();

      const where = {
        brokerOrgId: orgId,
        isDeleted: false,
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { companyName: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const [contacts, total] = await prisma.$transaction([
        prisma.contact.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.contact.count({ where }),
      ]);

      return reply.send({
        success: true,
        data: contacts,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      adminLogs.error("List broker contacts failed", { error, orgId });
      return reply.status(500).send({
        success: false,
        message: error.message || "Failed to fetch contacts",
      });
    }
  });

  fastify.post("/:orgId", async (request, reply) => {
    const prisma = fastify.prisma;
    const { orgId } = request.params;
    const body = request.body || {};

    try {
      const org = await getBrokerOrg(prisma, orgId);
      if (!org) {
        return reply.status(404).send({ success: false, message: "Broker not found" });
      }
      if (org.type !== "BROKER") {
        return reply.status(400).send({ success: false, message: "Organization is not a broker" });
      }

      if (!body.contactType) {
        return reply.status(400).send({
          success: false,
          message: "Contact type is required",
        });
      }

      const contact = await prisma.contact.create({
        data: {
          brokerOrgId: orgId,
          createdById: request.user?.id || null,
          ...pickContactData(body),
        },
      });

      adminLogs.info("Broker contact created", { orgId, contactId: contact.id });

      return reply.status(201).send({
        success: true,
        message: "Contact created successfully",
        data: contact,
      });
    } catch (error) {
      adminLogs.error("Create broker contact failed", { error, orgId });
      return reply.status(500).send({
        success: false,
        message: error.message || "Failed to create contact",
      });
    }
  });

  fastify.patch("/:orgId/:contactId", async (request, reply) => {
    const prisma = fastify.prisma;
    const { orgId, contactId } = request.params;

    try {
      const existing = await getBrokerContact(prisma, orgId, contactId);
      if (!existing) {
        return reply.status(404).send({ success: false, message: "Contact not found" });
      }

      const updateData = pickContactData(request.body || {});
      if (Object.keys(updateData).length === 0) {
        return reply.status(400).send({ success: false, message: "No fields to update" });
      }

      const contact = await prisma.contact.update({
        where: { id: contactId },
        data: updateData,
      });

      return reply.send({
        success: true,
        message: "Contact updated successfully",
        data: contact,
      });
    } catch (error) {
      adminLogs.error("Update broker contact failed", { error, orgId, contactId });
      return reply.status(500).send({
        success: false,
        message: error.message || "Failed to update contact",
      });
    }
  });

  fastify.delete("/:orgId/:contactId", async (request, reply) => {
    const prisma = fastify.prisma;
    const { orgId, contactId } = request.params;

    try {
      const existing = await getBrokerContact(prisma, orgId, contactId);
      if (!existing) {
        return reply.status(404).send({ success: false, message: "Contact not found" });
      }

      await prisma.contact.update({
        where: { id: contactId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      adminLogs.info("Broker contact deleted", { orgId, contactId });

      return reply.send({
        success: true,
        message: "Contact deleted successfully",
      });
    } catch (error) {
      adminLogs.error("Delete broker contact failed", { error, orgId, contactId });
      return reply.status(500).send({
        success: false,
        message: error.message || "Failed to delete contact",
      });
    }
  });
}

module.exports = brokerContactsRoutes;
