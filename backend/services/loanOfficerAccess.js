/**
 * Shared access helpers for loan officer portal routes.
 * Officers may only access deals where LoanApplication.brokerUserId matches their user id.
 */

function getUserId(req) {
  return req.user?.id || req.user?.userId;
}

function getOrgId(req) {
  return req.user?.organizationId;
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
      brokerUserId: userId,
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

  if (
    submission.application.brokerOrgId !== orgId ||
    submission.application.brokerUserId !== userId
  ) {
    forbidden(reply);
    return null;
  }

  return submission;
}

const officerPreHandler = (fastify) => [
  fastify.authenticate,
  fastify.requireRole(["BROKER_OFFICER"]),
];

module.exports = {
  getUserId,
  getOrgId,
  forbidden,
  assertOwnsApplication,
  assertOwnsSubmission,
  officerPreHandler,
};
