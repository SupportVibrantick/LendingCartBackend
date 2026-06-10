const {
  resolveClientDisplayNameFromData,
} = require("../../../services/resolveClientDisplayName");

function submissionFieldValue(fields, ...keys) {
  for (const field of fields || []) {
    const key = field.builderField?.fieldKey || field.fieldKey;
    if (!keys.includes(key)) continue;

    const raw = field.value;
    if (raw == null || raw === "") continue;

    if (typeof raw === "string") return raw.trim();
    if (typeof raw === "number") return String(raw);
    if (typeof raw === "object" && raw !== null) {
      if (typeof raw.value === "string" || typeof raw.value === "number") {
        return String(raw.value).trim();
      }
      return String(raw).trim();
    }

    return String(raw).trim();
  }

  return null;
}

function resolveAmountFromFields(fields) {
  const raw = submissionFieldValue(
    fields,
    "amountRequested",
    "loanAmount",
    "requestedAmount",
    "loan_amount",
  );

  if (!raw) return null;
  const amount = Number(String(raw).replace(/[,$]/g, ""));
  return Number.isNaN(amount) ? null : amount;
}

function resolveEntityType(app, fields) {
  return (
    app.client?.entityType ||
    submissionFieldValue(
      fields,
      "entityType",
      "borrowerEntityType",
      "businessEntityType",
    ) ||
    "-"
  );
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function listAllApplications(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Loan Pipeline"],
        summary: "View all submitted applications",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const applications = await prisma.loanApplication.findMany({
          where: {
            status: {
              not: "DRAFT",
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          include: {
            client: {
              select: {
                id: true,
                legalName: true,
                entityType: true,
                contacts: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                    isPrimary: true,
                  },
                  orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
                },
              },
            },
            brokerOrg: {
              select: {
                id: true,
                name: true,
              },
            },
            submissions: {
              include: {
                fields: true,
              },
            },
            applicationLenders: {
              include: {
                lender: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                lenderProduct: {
                  select: {
                    loanProductCode: true,
                  },
                },
              },
            },
          },
        });

        const formatted = applications.map((app) => {
          const fields = app.submissions?.[0]?.fields || [];
          const amountRequested = resolveAmountFromFields(fields);

          return {
            applicationId: app.id,
            applicationNumber: app.applicationNumber,
            loanProductCode: app.loanProductCode,
            amountRequested,
            status: app.status,
            createdAt: app.createdAt,
            borrowerName: resolveClientDisplayNameFromData(app.client, app.submissions),
            entityType: resolveEntityType(app, fields),
            purpose:
              submissionFieldValue(fields, "purpose", "loanPurpose", "useOfFunds") ||
              app.purpose ||
              null,

            client: app.client,
            broker: app.brokerOrg,

            lenders: app.applicationLenders.map((al) => ({
              lenderOrgId: al.lenderOrgId,
              lenderName: al.lender?.name,
              lenderProduct: al.lenderProduct?.loanProductCode,
              lenderStatus: al.status,
              sentAt: al.sentAt,
            })),
          };
        });

        return reply.send({
          success: true,
          total: formatted.length,
          data: formatted,
        });
      } catch (error) {
        fastify.log.error(error);

        return reply.status(500).send({
          success: false,
          message: "Server error",
        });
      }
    }
  );
}

module.exports = listAllApplications;