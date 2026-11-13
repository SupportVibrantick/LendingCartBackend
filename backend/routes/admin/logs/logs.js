const { sanitizeAuditValueJson } = require("../../../services/logger/sanitizeAuditValue");
const {
  buildAuditWhere,
  mapAuditRow,
  AUDIT_INCLUDE,
  getAuditAnalytics,
  SECTION_PRESETS,
} = require("../../../services/audit/auditLogQuery");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function logsRoutes(fastify) {
  const listSchema = {
    type: "object",
    properties: {
      page: { type: "integer", minimum: 1, default: 1 },
      limit: { type: "integer", minimum: 1, maximum: 200, default: 20 },
      action: { type: "string" },
      category: { type: "string" },
      entityType: { type: "string" },
      entityId: { type: "string" },
      actorUserId: { type: "string" },
      actorOrgId: { type: "string" },
      dashboard: { type: "string", enum: ["BROKER", "LENDER", "PLATFORM"] },
      section: {
        type: "string",
        enum: Object.keys(SECTION_PRESETS),
        default: "all",
      },
      status: { type: "string", enum: ["SUCCESS", "FAILED"] },
      role: { type: "string" },
      startDate: { type: "string", format: "date-time" },
      endDate: { type: "string", format: "date-time" },
      search: { type: "string" },
    },
  };

  async function listHandler(req, reply) {
    const prisma = fastify.prisma;
    const pageNum = Math.max(Number(req.query.page) || 1, 1);
    const limitNum = Math.min(Math.max(Number(req.query.limit) || 20, 1), 200);
    const skip = (pageNum - 1) * limitNum;
    const where = buildAuditWhere(req.query);

    try {
      const [rows, total, categoryGroups, entityGroups] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limitNum,
          include: AUDIT_INCLUDE,
        }),
        prisma.auditLog.count({ where }),
        prisma.auditLog.groupBy({
          by: ["category"],
          _count: { _all: true },
          orderBy: { category: "asc" },
        }),
        prisma.auditLog.groupBy({
          by: ["entityType"],
          _count: { _all: true },
          orderBy: { entityType: "asc" },
        }),
      ]);

      const data = rows.map((row) => {
        const mapped = mapAuditRow(row);
        return {
          ...mapped,
          oldValueJson: sanitizeAuditValueJson(mapped.oldValueJson),
          newValueJson: sanitizeAuditValueJson(mapped.newValueJson),
        };
      });

      return reply.send({
        success: true,
        total,
        page: pageNum,
        totalPages: Math.max(1, Math.ceil(total / limitNum) || 1),
        limit: limitNum,
        section: req.query.section || "all",
        data,
        filters: {
          categories: categoryGroups.map((r) => r.category).filter(Boolean),
          entityTypes: entityGroups.map((r) => r.entityType).filter(Boolean),
          sections: Object.keys(SECTION_PRESETS),
        },
      });
    } catch (err) {
      fastify.log.error({ err }, "Failed to fetch audit logs");
      return reply.status(500).send({
        success: false,
        message: "Failed to fetch audit logs",
      });
    }
  }

  fastify.get("/", { schema: { tags: ["Admin -> Audit Logs"], summary: "List audit logs", querystring: listSchema } }, listHandler);

  fastify.get(
    "/analytics",
    {
      schema: {
        tags: ["Admin -> Audit Logs"],
        summary: "Audit log analytics summary",
      },
    },
    async (req, reply) => {
      try {
        const analytics = await getAuditAnalytics(fastify.prisma);
        return reply.send({ success: true, data: analytics });
      } catch (err) {
        fastify.log.error({ err }, "Failed to fetch audit analytics");
        return reply.status(500).send({
          success: false,
          message: "Failed to fetch audit analytics",
        });
      }
    },
  );

  // Convenience section aliases
  for (const section of [
    "login-history",
    "broker-activity",
    "lender-activity",
    "security-events",
  ]) {
    const sectionMap = {
      "login-history": "login",
      "broker-activity": "broker",
      "lender-activity": "lender",
      "security-events": "security",
    };
    fastify.get(
      `/${section}`,
      {
        schema: {
          tags: ["Admin -> Audit Logs"],
          summary: `List ${section}`,
          querystring: listSchema,
        },
      },
      async (req, reply) => {
        req.query = { ...req.query, section: sectionMap[section] };
        return listHandler(req, reply);
      },
    );
  }

  fastify.get(
    "/export",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "15 minute",
        },
      },
      schema: {
        tags: ["Admin -> Audit Logs"],
        summary: "Export audit logs as CSV",
        querystring: listSchema,
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const where = buildAuditWhere(req.query);
      try {
        const rows = await prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: 5000,
          include: AUDIT_INCLUDE,
        });

        const mapped = rows.map(mapAuditRow);
        const header = [
          "createdAt",
          "userName",
          "userEmail",
          "organizationName",
          "userRole",
          "action",
          "module",
          "description",
          "ipAddress",
          "browser",
          "device",
          "status",
          "entityType",
          "entityId",
          "dashboard",
        ];

        const escape = (v) => {
          const s = v == null ? "" : String(v);
          if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        };

        const lines = [header.join(",")];
        for (const row of mapped) {
          lines.push(header.map((k) => escape(row[k])).join(","));
        }

        reply
          .header("Content-Type", "text/csv; charset=utf-8")
          .header(
            "Content-Disposition",
            `attachment; filename="audit-logs-${Date.now()}.csv"`,
          )
          .send(lines.join("\n"));
      } catch (err) {
        fastify.log.error({ err }, "Failed to export audit logs");
        return reply.status(500).send({
          success: false,
          message: "Failed to export audit logs",
        });
      }
    },
  );

  fastify.get(
    "/:id",
    {
      schema: {
        tags: ["Admin -> Audit Logs"],
        summary: "Get a single audit log",
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        querystring: {
          type: "object",
          properties: {
            createdAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { id } = req.params;
      try {
        // Partitioned PK is (id, createdAt) — find by id alone via findFirst.
        const row = await prisma.auditLog.findFirst({
          where: { id },
          include: AUDIT_INCLUDE,
        });

        if (!row) {
          return reply.status(404).send({
            success: false,
            message: "Audit log not found",
          });
        }

        const mapped = mapAuditRow(row);
        return reply.send({
          success: true,
          data: {
            ...mapped,
            oldValueJson: sanitizeAuditValueJson(mapped.oldValueJson),
            newValueJson: sanitizeAuditValueJson(mapped.newValueJson),
          },
        });
      } catch (err) {
        fastify.log.error({ err }, "Failed to fetch audit log");
        return reply.status(500).send({
          success: false,
          message: "Failed to fetch audit log",
        });
      }
    },
  );
}

module.exports = logsRoutes;
