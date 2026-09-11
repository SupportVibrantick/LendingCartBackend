function normalizePersonName(value) {
  if (value == null) return "";
  return String(value).trim().replace(/\s+/g, " ");
}

/**
 * Update borrower Client legalName + primary contact for a broker org.
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{
 *   brokerOrgId: string,
 *   clientId: string,
 *   firstName: string,
 *   lastName?: string,
 *   phone?: string | null,
 * }} params
 */
async function updateBorrowerClientIdentity(
  prisma,
  { brokerOrgId, clientId, firstName, lastName = "", phone },
) {
  const normalizedFirst = normalizePersonName(firstName);
  const normalizedLast = normalizePersonName(lastName);

  if (!normalizedFirst) {
    const err = new Error("First name is required");
    err.statusCode = 400;
    throw err;
  }
  if (!brokerOrgId || !clientId) {
    const err = new Error("Client not found");
    err.statusCode = 404;
    throw err;
  }

  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      primaryBrokerOrgId: brokerOrgId,
      isDeleted: false,
    },
    include: { contacts: true },
  });

  if (!client) {
    const err = new Error("Client not found");
    err.statusCode = 404;
    throw err;
  }

  const displayName =
    `${normalizedFirst} ${normalizedLast}`.trim().replace(/\s+/g, " ") ||
    normalizedFirst;

  const primaryContact =
    (client.contacts || []).find((c) => c.isPrimary) ||
    (client.contacts || [])[0] ||
    null;

  let fallbackEmail = primaryContact?.email || null;
  if (!fallbackEmail) {
    const portalUser = await prisma.clientPortalUser.findFirst({
      where: { clientId: client.id, isDeleted: false },
      select: { email: true },
      orderBy: { createdAt: "asc" },
    });
    fallbackEmail = portalUser?.email || null;
  }

  if (!primaryContact && !fallbackEmail) {
    const err = new Error("Client contact email is missing");
    err.statusCode = 400;
    throw err;
  }

  await prisma.$transaction(async (tx) => {
    await tx.client.update({
      where: { id: client.id },
      data: { legalName: displayName },
    });

    if (primaryContact) {
      await tx.clientContact.update({
        where: { id: primaryContact.id },
        data: {
          firstName: normalizedFirst,
          lastName: normalizedLast || null,
          ...(phone !== undefined
            ? { phone: phone == null ? null : String(phone).trim() || null }
            : {}),
        },
      });
    } else {
      await tx.clientContact.create({
        data: {
          clientId: client.id,
          firstName: normalizedFirst,
          lastName: normalizedLast || null,
          email: fallbackEmail,
          phone:
            phone === undefined
              ? null
              : phone == null
                ? null
                : String(phone).trim() || null,
          isPrimary: true,
        },
      });
    }
  });

  const refreshed = await prisma.client.findUnique({
    where: { id: client.id },
    include: { contacts: true },
  });

  const contact =
    (refreshed?.contacts || []).find((c) => c.isPrimary) ||
    (refreshed?.contacts || [])[0] ||
    null;

  return {
    clientId: client.id,
    clientName: displayName,
    firstName: contact?.firstName || normalizedFirst,
    lastName: contact?.lastName || normalizedLast || "",
    phone: contact?.phone ?? null,
    email: contact?.email || null,
  };
}

module.exports = {
  updateBorrowerClientIdentity,
  normalizePersonName,
};
