const {
  syncBookDemoLeadToGhl,
  syncAdminManualLeadToGhl,
} = require("../../../services/ghl/bookDemoLeadSync");
const { getClientIp } = require("../../../utils/security/rateLimit");

const LEAD_MODELS = {
  COMMERCIAL_LENDING_MASTERY: "commercialLendingMasteryLead",
  CLM_LANDING_PAGE: "clmLandingPageLead",
  ADMIN_MANUAL: "adminManualLead",
  LOAN_AI_BOOK_DEMO: "loanAiBookDemoLead",
};

function resolveModel(prisma, leadType) {
  const key = LEAD_MODELS[leadType];
  if (!key) return null;
  return prisma[key];
}

function pickCommonFields(body = {}) {
  const data = {};
  for (const key of [
    "firstName",
    "lastName",
    "email",
    "phone",
    "status",
    "campaign",
  ]) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  if (data.email != null) {
    data.email = String(data.email).trim().toLowerCase();
  }
  if (data.firstName != null) {
    data.firstName = String(data.firstName).trim() || null;
  }
  if (data.lastName != null) {
    data.lastName = String(data.lastName).trim() || null;
  }
  if (data.phone != null) {
    data.phone = String(data.phone).trim() || null;
  }
  if (data.campaign != null) {
    data.campaign = String(data.campaign).trim() || null;
  }
  return data;
}

function pickBookDemoFields(body = {}) {
  const data = pickCommonFields(body);
  for (const key of [
    "company",
    "message",
    "interestedPlanCode",
    "interestedPlanName",
  ]) {
    if (body[key] !== undefined) {
      data[key] =
        body[key] == null || body[key] === ""
          ? null
          : String(body[key]).trim();
    }
  }
  return data;
}

module.exports = async function (fastify) {
  fastify.get("/:id", async (req, reply) => {
    const prisma = fastify.prisma;
    const { id } = req.params;
    const leadType = req.query.leadType;

    if (!leadType) {
      return reply.code(400).send({
        success: false,
        message: "leadType query param is required",
      });
    }

    const model = resolveModel(prisma, leadType);
    if (!model) {
      return reply.code(400).send({
        success: false,
        message: "Invalid leadType",
      });
    }

    const lead = await model.findUnique({ where: { id } });
    if (!lead) {
      return reply.code(404).send({
        success: false,
        message: "Lead not found",
      });
    }

    return reply.send({
      success: true,
      data: { ...lead, leadType },
    });
  });

  fastify.patch(
    "/:id",
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
          keyGenerator: (req) => `admin-ip:${getClientIp(req)}`,
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Too Many Requests",
            success: false,
            message: "Too many requests. Please slow down.",
          }),
        },
      },
    },
    async (req, reply) => {
    const prisma = fastify.prisma;
    const { id } = req.params;
    const body = req.body || {};
    const leadType = body.leadType || req.query.leadType;

    if (!leadType) {
      return reply.code(400).send({
        success: false,
        message: "leadType is required",
      });
    }

    const model = resolveModel(prisma, leadType);
    if (!model) {
      return reply.code(400).send({
        success: false,
        message: "Invalid leadType",
      });
    }

    const existing = await model.findUnique({ where: { id } });
    if (!existing) {
      return reply.code(404).send({
        success: false,
        message: "Lead not found",
      });
    }

    const data =
      leadType === "LOAN_AI_BOOK_DEMO"
        ? pickBookDemoFields(body)
        : pickCommonFields(body);

    if (data.email === "") {
      return reply.code(400).send({
        success: false,
        message: "Email is required",
      });
    }

    if (Object.keys(data).length === 0) {
      return reply.code(400).send({
        success: false,
        message: "No updatable fields provided",
      });
    }

    let updated = await model.update({
      where: { id },
      data,
    });

    let ghl = null;
    const shouldSyncGhl =
      body.syncGhl === true || body.syncGhl === "true";
    if (shouldSyncGhl && leadType === "LOAN_AI_BOOK_DEMO") {
      updated = await syncBookDemoLeadToGhl(prisma, updated, {
        logger: req.log,
      });
      ghl = {
        ghlSyncStatus: updated.ghlSyncStatus,
        ghlContactId: updated.ghlContactId,
        ghlSyncedAt: updated.ghlSyncedAt,
        ghlLastError: updated.ghlLastError,
      };
    } else if (shouldSyncGhl && leadType === "ADMIN_MANUAL") {
      updated = await syncAdminManualLeadToGhl(prisma, updated, {
        logger: req.log,
      });
      ghl = {
        ghlSyncStatus: updated.ghlSyncStatus,
        ghlContactId: updated.ghlContactId,
        ghlSyncedAt: updated.ghlSyncedAt,
        ghlLastError: updated.ghlLastError,
      };
    }

    return reply.send({
      success: true,
      message: "Lead updated successfully",
      data: { ...updated, leadType },
      ghl,
    });
  });

  fastify.delete(
    "/:id",
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
          keyGenerator: (req) => `admin-ip:${getClientIp(req)}`,
          errorResponseBuilder: () => ({
            statusCode: 429,
            error: "Too Many Requests",
            success: false,
            message: "Too many requests. Please slow down.",
          }),
        },
      },
    },
    async (req, reply) => {
    const prisma = fastify.prisma;
    const { id } = req.params;
    const leadType = req.query.leadType || req.body?.leadType;

    if (!leadType) {
      return reply.code(400).send({
        success: false,
        message: "leadType is required",
      });
    }

    const model = resolveModel(prisma, leadType);
    if (!model) {
      return reply.code(400).send({
        success: false,
        message: "Invalid leadType",
      });
    }

    try {
      await model.delete({ where: { id } });
    } catch (err) {
      if (err.code === "P2025") {
        return reply.code(404).send({
          success: false,
          message: "Lead not found",
        });
      }
      throw err;
    }

    return reply.send({
      success: true,
      message: "Lead deleted successfully",
    });
  });
};
