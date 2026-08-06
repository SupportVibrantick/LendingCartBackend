const jwt = require("jsonwebtoken");
const jwtSecret = require("../../utils/auth/jwtSecret");
const { resolveApplicationStatus } = require("../../utils/applications/resolveApplicationStatus");
const { isDocumentVisibleToClient } = require("../../utils/documents/mapClientPortalDocuments");
const { resolvePortalClientIds } = require("../../utils/auth/clientPortalAuth");

const APPLICATION_SELECT = {
  id: true,
  applicationNumber: true,
  status: true,
  amountRequested: true,
  loanProductCode: true,
  createdAt: true,
  brokerOrgId: true,
  brokerOrg: {
    select: {
      id: true,
      name: true,
      email: true,
      brokerWhiteLabelSettings: {
        select: {
          brandName: true,
          logoUrl: true,
        },
      },
    },
  },
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
  collaterals: {
    select: {
      collateralType: true,
      description: true,
      lienPosition: true,
    },
    take: 3,
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

function getSubmissionFieldValues(submission, keys = []) {
  for (const key of keys) {
    const value = getSubmissionFieldValue(submission, key);
    if (value) {
      return value;
    }
  }

  return "";
}

function formatDisplayText(value) {
  if (!value) return "";
  return String(value).replace(/_/g, " ").trim();
}

function resolveBusinessName(submission) {
  return formatDisplayText(
    getSubmissionFieldValues(submission, [
      "companyName",
      "entityLegalName",
      "businessName",
      "dba",
    ]),
  );
}

function resolvePropertyInfo(submission) {
  const propertyType = formatDisplayText(
    getSubmissionFieldValues(submission, ["propertyType", "property_type"]),
  );
  const subPropertyType = formatDisplayText(
    getSubmissionFieldValues(submission, [
      "subPropertyType",
      "sub_property_type",
    ]),
  );
  const businessIndustry = formatDisplayText(
    getSubmissionFieldValues(submission, [
      "businessIndustry",
      "business_industry",
    ]),
  );

  const parts = [propertyType, subPropertyType].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(" · ");
  }

  return businessIndustry;
}

function resolveCollateralSummary(submission, collaterals = []) {
  const collateralFromFields = formatDisplayText(
    getSubmissionFieldValues(submission, [
      "collateral",
      "collateralTypes",
      "collateralType",
    ]),
  );

  const collateralFromTable = collaterals
    .map((item) => {
      const parts = [
        item.lienPosition,
        item.collateralType,
        item.description,
      ]
        .map((part) => formatDisplayText(part))
        .filter(Boolean);

      return parts.join(" — ");
    })
    .filter(Boolean);

  if (collateralFromTable.length > 0) {
    return collateralFromTable.join("; ");
  }

  return collateralFromFields;
}

function resolveApplicationAddress(submission) {
  const street = getSubmissionFieldValues(submission, [
    "propertyAddress",
    "property_address",
    "businessAddress",
    "business_address",
    "address",
    "mailingAddress",
  ]);
  const city = getSubmissionFieldValues(submission, [
    "propertyCity",
    "property_city",
    "borrowerCity",
    "city",
  ]);
  const state = getSubmissionFieldValues(submission, [
    "propertyState",
    "property_state",
    "borrowerState",
    "state",
  ]);
  const zip = getSubmissionFieldValues(submission, [
    "propertyZip",
    "property_zip",
    "zip",
  ]);
  const country = getSubmissionFieldValues(submission, [
    "propertyCountry",
    "property_country",
    "borrowerCountry",
    "country",
  ]);

  const cityStateZip = [city, state].filter(Boolean).join(", ");
  const locality = [cityStateZip, zip].filter(Boolean).join(" ").trim();
  const parts = [street, locality, country].filter(Boolean);

  return parts.join(", ");
}

function resolveApplicationSummary(app, latestSubmission) {
  return {
    businessName: resolveBusinessName(latestSubmission),
    propertyInfo: resolvePropertyInfo(latestSubmission),
    collateralSummary: resolveCollateralSummary(
      latestSubmission,
      app.collaterals || [],
    ),
    address: resolveApplicationAddress(latestSubmission),
  };
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

function resolveBrokerInfo(app) {
  const org = app.brokerOrg;
  if (!org) return null;

  const brandName = org.brokerWhiteLabelSettings?.brandName?.trim() || "";
  const name = brandName || org.name || "";

  if (!name && !org.email) return null;

  return {
    id: org.id,
    name: name || "Broker",
    email: org.email || null,
    logoUrl: org.brokerWhiteLabelSettings?.logoUrl || null,
  };
}

function applicationMatchesSearch(app, search) {
  const latestSubmission = app.submissions?.[0];
  const summary = resolveApplicationSummary(app, latestSubmission);
  const broker = resolveBrokerInfo(app);
  const applicationNumber = String(app.applicationNumber || "").toLowerCase();
  const status = String(app.status || "").toLowerCase();
  const amount = String(
    getSubmissionFieldValue(latestSubmission, "amountRequested") ||
      app.amountRequested ||
      "",
  ).toLowerCase();
  const loanProduct = String(
    getSubmissionFieldValue(latestSubmission, "loanProductCode") ||
      app.loanProductCode ||
      "",
  ).toLowerCase();
  const businessName = String(summary.businessName || "").toLowerCase();
  const propertyInfo = String(summary.propertyInfo || "").toLowerCase();
  const collateralSummary = String(summary.collateralSummary || "").toLowerCase();
  const address = String(summary.address || "").toLowerCase();
  const brokerName = String(broker?.name || "").toLowerCase();
  const brokerEmail = String(broker?.email || "").toLowerCase();

  return (
    applicationNumber.includes(search) ||
    status.includes(search) ||
    amount.includes(search) ||
    loanProduct.includes(search) ||
    businessName.includes(search) ||
    propertyInfo.includes(search) ||
    collateralSummary.includes(search) ||
    address.includes(search) ||
    brokerName.includes(search) ||
    brokerEmail.includes(search)
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
  const summary = resolveApplicationSummary(app, latestSubmission);
  const broker = resolveBrokerInfo(app);

  return {
    id: app.id,
    applicationNumber: app.applicationNumber,
    status: resolveApplicationStatus(app),
    loanProduct: productFromField || app.loanProductCode || null,
    amountRequested: resolveAmountRequested(app, latestSubmission),
    createdAt: app.createdAt,
    businessName: summary.businessName || null,
    propertyInfo: summary.propertyInfo || null,
    collateralSummary: summary.collateralSummary || null,
    address: summary.address || null,
    broker,
    brokerOrgId: app.brokerOrgId || broker?.id || null,
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
            brokerOrgId: { type: "string", format: "uuid" },
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
          decoded = jwt.verify(token, jwtSecret);
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
        const statusFilter = String(req.query.status || "").trim();
        const brokerOrgIdFilter = String(req.query.brokerOrgId || "").trim();

        // Same portal email can belong to Client rows under different brokers.
        const clientIds = await resolvePortalClientIds(prisma, {
          portalUserId: decoded.id,
          clientId,
          email: decoded.email || decoded.clientEmail,
        });

        if (clientIds.length === 0) {
          return reply.send({
            success: true,
            data: [],
            meta: {
              page,
              limit,
              total: 0,
              totalPages: 1,
              filters: { brokers: [], statuses: [] },
            },
          });
        }

        const clientScope = { clientId: { in: clientIds } };

        const baseWhere = {
          ...clientScope,
          ...(brokerOrgIdFilter ? { brokerOrgId: brokerOrgIdFilter } : {}),
        };

        // Distinct brokers/statuses for filter UI (unfiltered by search/status/broker).
        const filterSourceApps = await prisma.loanApplication.findMany({
          where: clientScope,
          select: {
            status: true,
            brokerOrgId: true,
            brokerOrg: {
              select: {
                id: true,
                name: true,
                email: true,
                brokerWhiteLabelSettings: {
                  select: { brandName: true, logoUrl: true },
                },
              },
            },
            applicationLenders: { select: { status: true } },
          },
          orderBy: { createdAt: "desc" },
        });

        const brokerMap = new Map();
        const statusSet = new Set();
        for (const app of filterSourceApps) {
          const resolvedStatus = resolveApplicationStatus(app);
          if (resolvedStatus) statusSet.add(resolvedStatus);

          const broker = resolveBrokerInfo(app);
          if (broker?.id && !brokerMap.has(broker.id)) {
            brokerMap.set(broker.id, broker);
          }
        }

        const filterOptions = {
          brokers: Array.from(brokerMap.values()).sort((a, b) =>
            a.name.localeCompare(b.name),
          ),
          statuses: Array.from(statusSet).sort(),
        };

        let applications;
        let total;
        const needsInMemoryFilter = Boolean(search || statusFilter);

        if (needsInMemoryFilter) {
          const allApplications = await prisma.loanApplication.findMany({
            where: baseWhere,
            orderBy: { createdAt: "desc" },
            select: APPLICATION_SELECT,
          });

          let filtered = allApplications;

          if (statusFilter) {
            filtered = filtered.filter(
              (app) => resolveApplicationStatus(app) === statusFilter,
            );
          }

          if (search) {
            filtered = filtered.filter((app) =>
              applicationMatchesSearch(app, search),
            );
          }

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
            filters: filterOptions,
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
