/**
 * Shared access helpers for loan officer portal routes.
 * Officers may access deals assigned to them via brokerUserId, the
 * loan_officer_applications join table, public share link provenance, or the
 * public application link they minted.
 */

function getUserId(req) {
  return req.user?.id || req.user?.userId;
}

function getOrgId(req) {
  return req.user?.organizationId;
}

function officerAssignedApplicationWhere(userId) {
  if (!userId) return { id: { in: [] } };
  return {
    OR: [
      { brokerUserId: userId },
      {
        loanOfficerAssignments: {
          some: { loanOfficerId: userId },
        },
      },
      { publicCreatedByUserId: userId },
      {
        publicApplicationLink: {
          is: {
            OR: [
              { loanOfficerId: userId },
              { createdByUserId: userId, sourcePortal: "LOAN_OFFICER" },
            ],
          },
        },
      },
      {
        subBrokerAssignments: {
          some: {
            subBroker: {
              subBrokerLoanOfficers: {
                some: { loanOfficerId: userId },
              },
            },
          },
        },
      },
    ],
  };
}

function isOfficerAssignedToApplication(application, userId) {
  if (!application || !userId) return false;
  if (application.brokerUserId === userId) return true;
  if (
    application.loanOfficerAssignments?.some(
      (row) => row.loanOfficerId === userId,
    )
  ) {
    return true;
  }
  if (application.publicCreatedByUserId === userId) return true;
  const link = application.publicApplicationLink;
  if (link?.loanOfficerId === userId) return true;
  if (
    link?.sourcePortal === "LOAN_OFFICER" &&
    link.createdByUserId === userId
  ) {
    return true;
  }
  return false;
}

function forbidden(reply, message = "Access denied. Application not assigned to you.") {
  return reply.code(403).send({ success: false, message });
}

async function assertOwnsApplication(prisma, req, reply, applicationId) {
  const userId = getUserId(req);
  const orgId = getOrgId(req);

  const application = await prisma.loanApplication.findFirst({
    where: {
      id: applicationId,
      brokerOrgId: orgId,
      ...officerAssignedApplicationWhere(userId),
    },
  });

  if (!application) {
    forbidden(reply);
    return null;
  }

  return application;
}

async function assertOwnsSubmission(prisma, req, reply, submissionId) {
  const userId = getUserId(req);
  const orgId = getOrgId(req);

  const submission = await prisma.applicationSubmission.findUnique({
    where: { id: submissionId },
    include: { application: true },
  });

  if (!submission) {
    reply.code(404).send({ success: false, message: "Submission not found" });
    return null;
  }

  if (submission.application.brokerOrgId !== orgId) {
    forbidden(reply);
    return null;
  }

  const owned = await prisma.loanApplication.findFirst({
    where: {
      id: submission.application.id,
      brokerOrgId: orgId,
      ...officerAssignedApplicationWhere(userId),
    },
    select: { id: true },
  });

  if (!owned) {
    forbidden(reply);
    return null;
  }

  return submission;
}

const officerPreHandler = (fastify, permission) => {
  const handlers = [fastify.authenticate, fastify.requireRole(["BROKER_OFFICER"])];

  if (permission) {
    handlers.push(fastify.requirePermission(permission));
  }

  return handlers;
};

const registerOfficerRouteGuards = (fastify, permission) => {
  for (const handler of officerPreHandler(fastify, permission)) {
    fastify.addHook("preHandler", handler);
  }
};

/** Loan-scoped messaging requires CHAT (not VIEW_APPLICATIONS alone). */
const LOAN_OFFICER_MESSAGING_PERMISSIONS = "CHAT";

/** Extra permission check on routes already under registerOfficerRouteGuards. */
const extraOfficerPermission = (fastify, permission) => [
  fastify.requirePermission(permission),
];

const LO_CUSTOM_DOCUMENTS_VIEW_PERMISSIONS = [
  "VIEW_CUSTOM_DOCUMENTS",
  "MANAGE_CUSTOM_DOCUMENTS",
];

async function requireLoCustomDocumentsView(req, reply, fastify) {
  if (!req.user?.roles?.includes("BROKER_OFFICER")) return;
  await fastify.requirePermission(LO_CUSTOM_DOCUMENTS_VIEW_PERMISSIONS)(req, reply);
}

async function requireLoCustomDocumentsManage(req, reply, fastify) {
  if (!req.user?.roles?.includes("BROKER_OFFICER")) return;
  await fastify.requirePermission("MANAGE_CUSTOM_DOCUMENTS")(req, reply);
}

async function requireLoMarketplaceView(req, reply, fastify) {
  if (!req.user?.roles?.includes("BROKER_OFFICER")) return;
  await fastify.requirePermission("VIEW_MARKETPLACE")(req, reply);
}

async function requireLoConnectLenders(req, reply, fastify) {
  if (!req.user?.roles?.includes("BROKER_OFFICER")) return;
  await fastify.requirePermission("CONNECT_LENDERS")(req, reply);
}

async function requireLoAddOwnLender(req, reply, fastify) {
  if (!req.user?.roles?.includes("BROKER_OFFICER")) return;
  await fastify.requirePermission("ADD_OWN_LENDER")(req, reply);
}

async function requireLoSendApplications(req, reply, fastify) {
  if (!req.user?.roles?.includes("BROKER_OFFICER")) return;
  await fastify.requirePermission("SEND_APPLICATIONS")(req, reply);
}

async function requireLoOfficerPermission(req, reply, fastify, permission) {
  if (!req.user?.roles?.includes("BROKER_OFFICER")) return;
  await fastify.requirePermission(permission)(req, reply);
}

function isLoanOfficerActor(req) {
  return Boolean(req.user?.roles?.includes("BROKER_OFFICER"));
}

module.exports = {
  getUserId,
  getOrgId,
  forbidden,
  officerAssignedApplicationWhere,
  isOfficerAssignedToApplication,
  assertOwnsApplication,
  assertOwnsSubmission,
  officerPreHandler,
  registerOfficerRouteGuards,
  extraOfficerPermission,
  LOAN_OFFICER_MESSAGING_PERMISSIONS,
  LO_CUSTOM_DOCUMENTS_VIEW_PERMISSIONS,
  requireLoCustomDocumentsView,
  requireLoCustomDocumentsManage,
  requireLoMarketplaceView,
  requireLoConnectLenders,
  requireLoAddOwnLender,
  requireLoSendApplications,
  requireLoOfficerPermission,
  isLoanOfficerActor,
};
