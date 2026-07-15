const CSV_HEADERS = ["companyName", "fullName", "email", "phone"];

function escapeCsv(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function rowsToCsv(rows) {
  const lines = [CSV_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        escapeCsv(row.companyName),
        escapeCsv(row.fullName),
        escapeCsv(row.email),
        escapeCsv(row.phone),
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function bulkTemplateCsvRoutes(fastify) {
  fastify.get(
    "/bulk/template",
    {
      schema: {
        tags: ["Admin -> Invite Lenders"],
        summary: "Download bulk lender invite CSV template",
      },
    },
    async (_request, reply) => {
      const csv = rowsToCsv([
        {
          companyName: "ABC Capital",
          fullName: "Jane Doe",
          email: "jane@abccapital.com",
          phone: "5551234567",
        },
        {
          companyName: "XYZ Lending",
          fullName: "John Smith",
          email: "john@xyzlending.com",
          phone: "5559876543",
        },
      ]);

      reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header(
          "Content-Disposition",
          'attachment; filename="lender-invite-template.csv"',
        )
        .send(csv);
    },
  );
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function exportInvitesCsvRoutes(fastify) {
  fastify.get(
    "/export",
    {
      schema: {
        tags: ["Admin -> Invite Lenders"],
        summary: "Export lender invitations as CSV",
        querystring: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: [
                "PENDING",
                "ACCEPTED",
                "DECLINED",
                "EXPIRED",
                "CANCELLED",
                "ALL",
              ],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;
      const status = String(request.query?.status || "ALL").toUpperCase();

      try {
        const where =
          status && status !== "ALL" ? { status } : {};

        const invites = await prisma.adminLenderInvite.findMany({
          where,
          orderBy: { createdAt: "desc" },
        });

        const header =
          "companyName,fullName,email,phone,status,lastSentAt,createdAt,expiresAt\n";
        const body = invites
          .map((invite) =>
            [
              escapeCsv(invite.companyName),
              escapeCsv(invite.fullName),
              escapeCsv(invite.email),
              escapeCsv(invite.phone),
              escapeCsv(invite.status),
              escapeCsv(invite.lastSentAt?.toISOString?.() || invite.lastSentAt),
              escapeCsv(invite.createdAt?.toISOString?.() || invite.createdAt),
              escapeCsv(invite.expiresAt?.toISOString?.() || invite.expiresAt),
            ].join(","),
          )
          .join("\n");

        reply
          .header("Content-Type", "text/csv; charset=utf-8")
          .header(
            "Content-Disposition",
            'attachment; filename="lender-invitations.csv"',
          )
          .send(`${header}${body}${body ? "\n" : ""}`);
      } catch (error) {
        request.log.error(error, "Failed to export lender invitations");
        return reply.status(500).send({
          success: false,
          message: "Failed to export invitations",
        });
      }
    },
  );
}

module.exports = {
  bulkTemplateCsvRoutes,
  exportInvitesCsvRoutes,
  rowsToCsv,
  CSV_HEADERS,
};
