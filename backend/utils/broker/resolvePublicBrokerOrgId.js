/**
 * Resolve broker organization id from public embed query params.
 * Supports ?broker=<uuid>, ?brokerOrgId=<uuid>, ?brokerEmail=<email>
 */
async function resolvePublicBrokerOrgId(prisma, query = {}) {
  const rawBroker = String(query.broker || query.brokerOrgId || "").trim();
  const rawEmail = String(query.brokerEmail || query.email || "").trim();

  const emailCandidate =
    rawEmail ||
    (rawBroker.includes("@") ? rawBroker : "");

  if (emailCandidate) {
    const normalizedEmail = emailCandidate.toLowerCase();
    const byEmail = await prisma.organization.findFirst({
      where: {
        type: "BROKER",
        status: "ACTIVE",
        email: { equals: normalizedEmail, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (byEmail) {
      return byEmail.id;
    }
  }

  if (rawBroker && !rawBroker.includes("@")) {
    const byId = await prisma.organization.findFirst({
      where: {
        id: rawBroker,
        type: "BROKER",
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (byId) {
      return byId.id;
    }
  }

  return null;
}

module.exports = {
  resolvePublicBrokerOrgId,
};
