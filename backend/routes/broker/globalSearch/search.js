/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function globalSearchRoute(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Broker -> Global Search"],
        summary: "Search sub brokers, loan officers, clients, contacts, lenders",
        querystring: {
          type: "object",
          properties: {
            q: { type: "string" },
            search: { type: "string" },
            limit: { type: "integer", minimum: 1, maximum: 10, default: 5 },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = req.user.organizationId;
        const userId = req.user.id || req.user.userId;
        const roles = req.user.roles || [];
        const isAdmin = roles.includes("BROKER_ADMIN");
        const isOfficer = roles.includes("BROKER_OFFICER");

        const search = (req.query.q || req.query.search || "").trim();
        const limit = Math.min(Number(req.query.limit) || 5, 10);

        if (!search) {
          return reply.send({
            success: true,
            data: {
              subBrokers: [],
              loanOfficers: [],
              clients: [],
              contacts: [],
              lenders: [],
            },
          });
        }

        const personSearch = {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        };

        const subBrokerPromise =
          isAdmin || isOfficer
            ? prisma.userAccount.findMany({
                where: {
                  organizationId: brokerOrgId,
                  isDeleted: false,
                  ...personSearch,
                  roles: {
                    some: { role: { name: "SUB_BROKER" } },
                  },
                },
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                  status: true,
                },
                orderBy: { createdAt: "desc" },
                take: limit,
              })
            : Promise.resolve([]);

        const loanOfficerPromise = isAdmin
          ? prisma.userAccount.findMany({
              where: {
                organizationId: brokerOrgId,
                isDeleted: false,
                ...personSearch,
                roles: {
                  some: { role: { name: "BROKER_OFFICER" } },
                },
              },
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                status: true,
              },
              orderBy: { createdAt: "desc" },
              take: limit,
            })
          : Promise.resolve([]);

        const clientPromise = prisma.client.findMany({
          where: {
            primaryBrokerOrgId: brokerOrgId,
            isDeleted: { not: true },
            OR: [
              { legalName: { contains: search, mode: "insensitive" } },
              {
                contacts: {
                  some: {
                    OR: [
                      { email: { contains: search, mode: "insensitive" } },
                      { firstName: { contains: search, mode: "insensitive" } },
                      { lastName: { contains: search, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          },
          select: {
            id: true,
            legalName: true,
            entityType: true,
            contacts: {
              where: { isPrimary: true },
              take: 1,
              select: { email: true, phone: true },
            },
            loanApplications: {
              where: {
                brokerOrgId,
                ...(isOfficer ? { brokerUserId: userId } : {}),
              },
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                applicationNumber: true,
                submissions: {
                  where: { status: { not: "SUPERSEDED" } },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: { id: true },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        });

        const contactPromise = prisma.contact.findMany({
          where: {
            brokerOrgId,
            isDeleted: false,
            ...(isOfficer ? { createdById: userId } : {}),
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { companyName: { contains: search, mode: "insensitive" } },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        });

        const lenderPromise = prisma.organization.findMany({
          where: {
            type: "LENDER",
            status: "ACTIVE",
            isDeleted: { not: true },
            name: { contains: search, mode: "insensitive" },
          },
          select: {
            id: true,
            name: true,
            email: true,
          },
          orderBy: { name: "asc" },
          take: limit,
        });

        const [subBrokers, loanOfficers, clients, contacts, lenderOrgs] =
          await Promise.all([
            subBrokerPromise,
            loanOfficerPromise,
            clientPromise,
            contactPromise,
            lenderPromise,
          ]);

        const lenderIds = lenderOrgs.map((l) => l.id);
        const connectedRows =
          lenderIds.length > 0
            ? await prisma.brokerLenderAccess.findMany({
                where: {
                  brokerOrgId,
                  isActive: true,
                  lenderOrgId: { in: lenderIds },
                },
                select: { lenderOrgId: true },
              })
            : [];
        const connectedSet = new Set(connectedRows.map((r) => r.lenderOrgId));

        const formatName = (first, last) =>
          `${first || ""} ${last || ""}`.trim() || "Unknown";

        return reply.send({
          success: true,
          data: {
            subBrokers: subBrokers.map((u) => ({
              id: u.id,
              label: formatName(u.firstName, u.lastName),
              subtitle: [u.email, u.phone, u.status].filter(Boolean).join(" · "),
              email: u.email,
            })),
            loanOfficers: loanOfficers.map((u) => ({
              id: u.id,
              label: formatName(u.firstName, u.lastName),
              subtitle: [u.email, u.phone, u.status].filter(Boolean).join(" · "),
              email: u.email,
            })),
            clients: clients.map((c) => {
              const latestApp = c.loanApplications?.[0];
              const latestSubmission = latestApp?.submissions?.[0];
              const primaryContact = c.contacts?.[0];
              return {
                id: c.id,
                label: c.legalName,
                subtitle: [
                  latestApp?.applicationNumber,
                  primaryContact?.email,
                  c.entityType,
                ]
                  .filter(Boolean)
                  .join(" · "),
                submissionId: latestSubmission?.id || null,
                applicationNumber: latestApp?.applicationNumber || null,
              };
            }),
            contacts: contacts.map((c) => ({
              id: c.id,
              label: formatName(c.firstName, c.lastName),
              subtitle: [c.companyName, c.email].filter(Boolean).join(" · "),
              email: c.email,
            })),
            lenders: lenderOrgs.map((l) => ({
              id: l.id,
              label: l.name,
              subtitle: l.email || "",
              isConnected: connectedSet.has(l.id),
            })),
          },
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message, stack: error.stack },
          "Global search failed",
        );

        return reply.code(500).send({
          success: false,
          message: error.message,
        });
      }
    },
  );
};
