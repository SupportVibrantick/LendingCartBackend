const { getClientFromRequest } = require("../../utils/auth/clientPortalAuth");
const {
  resolveClientDisplayName,
  buildContactName,
} = require("../../utils/applications/resolveClientDisplayName");

function normalizePersonName(value) {
  if (value == null) return "";
  return String(value).trim().replace(/\s+/g, " ");
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function updateClientProfileRoute(fastify) {
  fastify.put("/profile", async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      const auth = getClientFromRequest(req);
      if (auth.error) {
        return reply.code(auth.error.code).send({
          success: false,
          message: auth.error.message,
        });
      }

      const body = req.body || {};
      const firstName = normalizePersonName(body.firstName);
      const lastName = normalizePersonName(body.lastName);
      const phone =
        body.phone == null ? undefined : String(body.phone).trim() || null;

      if (!firstName) {
        return reply.code(400).send({
          success: false,
          message: "First name is required",
        });
      }

      if (!lastName) {
        return reply.code(400).send({
          success: false,
          message: "Last name is required",
        });
      }

      const user = await prisma.clientPortalUser.findFirst({
        where: {
          clientId: auth.clientId,
          isDeleted: false,
        },
        include: {
          client: {
            include: {
              contacts: true,
            },
          },
        },
      });

      if (!user?.client) {
        return reply.code(404).send({
          success: false,
          message: "Client account not found",
        });
      }

      const contacts = user.client.contacts || [];
      const primaryContact =
        contacts.find((c) => c.isPrimary) ||
        contacts.find(
          (c) =>
            String(c.email || "")
              .trim()
              .toLowerCase() === String(user.email || "").trim().toLowerCase(),
        ) ||
        contacts[0] ||
        null;

      const displayName =
        `${firstName} ${lastName}`.trim().replace(/\s+/g, " ") || firstName;

      await prisma.$transaction(async (tx) => {
        await tx.client.update({
          where: { id: user.clientId },
          data: { legalName: displayName },
        });

        if (primaryContact) {
          await tx.clientContact.update({
            where: { id: primaryContact.id },
            data: {
              firstName,
              lastName: lastName || null,
              ...(phone !== undefined ? { phone } : {}),
            },
          });
        } else {
          await tx.clientContact.create({
            data: {
              clientId: user.clientId,
              firstName,
              lastName: lastName || null,
              email: user.email,
              phone: phone ?? null,
              isPrimary: true,
            },
          });
        }
      });

      const refreshed = await prisma.clientPortalUser.findFirst({
        where: { id: user.id, isDeleted: false },
        include: {
          client: {
            include: { contacts: true },
          },
        },
      });

      const nextContacts = refreshed?.client?.contacts || [];
      const nextPrimary =
        nextContacts.find((c) => c.isPrimary) || nextContacts[0] || null;

      const clientName = await resolveClientDisplayName(prisma, {
        clientId: user.clientId,
        client: refreshed?.client,
        contacts: nextContacts,
      });

      return reply.send({
        success: true,
        message: "Profile updated",
        data: {
          id: user.id,
          email: user.email,
          clientId: user.clientId,
          clientName: clientName || buildContactName(nextPrimary) || displayName,
          firstName: nextPrimary?.firstName || firstName,
          lastName: nextPrimary?.lastName || lastName || "",
          phone: nextPrimary?.phone ?? phone ?? null,
        },
      });
    } catch (error) {
      fastify.log.error(
        { error: error.message },
        "Failed to update client profile",
      );

      return reply.code(500).send({
        success: false,
        message: "Unexpected server error",
      });
    }
  });
}

module.exports = updateClientProfileRoute;
