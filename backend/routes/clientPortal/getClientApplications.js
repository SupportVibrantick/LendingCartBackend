const jwt = require("jsonwebtoken");
const { resolveApplicationStatus } = require("../../utils/applications/resolveApplicationStatus");
const { isDocumentVisibleToClient } = require("../../utils/documents/mapClientPortalDocuments");

const APPLICATION_SELECT = {
  id: true,
  applicationNumber: true,
  status: true,
  amountRequested: true,
  loanProductCode: true,
  createdAt: true,
  submissions: {
    where: { status: { not: "SUPERSEDED" } },
    orderBy: { createdAt: "desc" },
    take: 1,
    include: {
      fields: {
        include: {
          builderField: {
            select: { fieldKey: true },
          },
        },
      },
    },
  },
  documentRequirements: {
    select: {
      id: true,
      source: true,
      status: true,
      sentToClientAt: true,
      requiresClientSignature: true,
      uploads: {
        select: { id: true },
      },
    },
  },
  documentUploads: {
    select: { id: true },
  },
  applicationLenders: {
    select: { status: true },
  },
};

function getSubmissionFieldValue(submission, key) {
  const field = submission?.fields?.find(
    (item) =>
      item.fieldKey === key || item.builderField?.fieldKey === key,
  );

  if (!field || field.value === null || field.value === undefined) {
    return "";
  }

  if (typeof field.value === "object") {
    return String(field.value);
  }

  return String(field.value);
}

function parseAmountValue(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return null;
  }

  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return rawValue;
  }

  const cleaned = String(rawValue).replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;

  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
}

function resolveAmountRequested(app, latestSubmission) {
  const amountFromField = getSubmissionFieldValue(
    latestSubmission,
    "amountRequested",
  );

  return (
    parseAmountValue(amountFromField) ??
    parseAmountValue(app.amountRequested)
  );
}

function countUploadedRequirements(requirements = []) {
  return requirements.filter((req) => {
    const uploadCount = req.uploads?.length || 0;
    return (
      uploadCount > 0 ||
      req.status === "COMPLETE" ||
      req.status === "PARTIAL"
    );
  }).length;
}

function applicationMatchesSearch(app, search) {
  const latestSubmission = app.submissions?.[0];
  const applicationNumber = String(app.applicationNumber || "").toLowerCase();
  const status = String(app.status || "").toLowerCase();
  const amount = String(
    getSubmissionFieldValue(latestSubmission, "amountRequested") ||
      app.amountRequested ||
      "",
  ).toLowerCase();

  return (
    applicationNumber.includes(search) ||
    status.includes(search) ||
    amount.includes(search)
  );
}

function formatClientApplication(app) {
  const latestSubmission = app.submissions?.[0];
  const productFromField = getSubmissionFieldValue(
    latestSubmission,
    "loanProductCode",
  );

  const visibleRequirements = (app.documentRequirements || []).filter(
    isDocumentVisibleToClient,
  );

  return {
    id: app.id,
    applicationNumber: app.applicationNumber,
    status: resolveApplicationStatus(app),
    loanProduct: productFromField || app.loanProductCode || null,
    amountRequested: resolveAmountRequested(app, latestSubmission),
    createdAt: app.createdAt,
    documentProgress: {
      total: visibleRequirements.length,
      uploaded: countUploadedRequirements(visibleRequirements),
      filesUploaded: visibleRequirements.reduce(
        (sum, req) => sum + (req.uploads?.length || 0),
        0,
      ),
    },
  };
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function getClientApplicationsRoute(fastify) {
  fastify.get(
    "/applications",
    {
      schema: {
        tags: ["Client Portal"],
        summary: "Get all loan applications for logged-in client",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 50, default: 12 },
            status: { type: "string" },
            search: { type: "string" },
          },
        },
      },
    },

    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const token = authHeader.split(" ")[1];

        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
          return reply.code(401).send({
            success: false,
            message: "Invalid token",
          });
        }

        if (!decoded.clientId || decoded.role !== "CLIENT") {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        const clientId = decoded.clientId;
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit, 10) || 12, 50);
        const skip = (page - 1) * limit;
        const search = String(req.query.search || "").trim().toLowerCase();

        const baseWhere = {
          clientId,
          ...(req.query.status && { status: req.query.status }),
        };

        let applications;
        let total;

        if (search) {
          const allApplications = await prisma.loanApplication.findMany({
            where: baseWhere,
            orderBy: { createdAt: "desc" },
            select: APPLICATION_SELECT,
          });

          const filtered = allApplications.filter((app) =>
            applicationMatchesSearch(app, search),
          );

          total = filtered.length;
          applications = filtered.slice(skip, skip + limit);
        } else {
          total = await prisma.loanApplication.count({ where: baseWhere });

          applications = await prisma.loanApplication.findMany({
            where: baseWhere,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            select: APPLICATION_SELECT,
          });
        }

        const formatted = applications.map(formatClientApplication);
        const totalPages = total > 0 ? Math.ceil(total / limit) : 1;

        return reply.send({
          success: true,
          data: formatted,
          meta: {
            page,
            limit,
            total,
            totalPages,
          },
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message },
          "Failed to fetch client applications",
        );

        return reply.code(500).send({
          success: false,
          message: "Unexpected server error",
        });
      }
    },
  );
}

module.exports = getClientApplicationsRoute;
