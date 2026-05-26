/**
 * @param {import("fastify").FastifyInstance} fastify
 */

module.exports = async function loanPipelineStatsApi(
  fastify,
) {
  fastify.get(
    "/pipeline-stats",
    {
      preHandler: fastify.authenticate,
    },

    async (req, reply) => {
      try {
        const prisma = fastify.prisma;
const { status } = req.query;
        /* ================= AUTH ================= */

        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const userId =
          req.user.id || req.user.userId;

        const orgId = req.user.organizationId;

        const roles = req.user.roles || [];

        const isAdmin =
          roles.includes("BROKER_ADMIN");

        const isOfficer =
          roles.includes("BROKER_OFFICER");

        const isSubBroker =
          roles.includes("SUB_BROKER");

        if (
          !isAdmin &&
          !isOfficer &&
          !isSubBroker
        ) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        /* ================= WHERE ================= */

        const whereCondition = {
          brokerOrgId: orgId,

          ...(isOfficer && {
            brokerUserId: userId,
          }),

          ...(isSubBroker && {
            subBrokerAssignments: {
              some: {
                subBrokerId: userId,
              },
            },
          }),
        };

        /* ================= APPLICATIONS ================= */

  const applications =
  await prisma.applicationSubmission.findMany({
    where: {
  status: {
    not: "SUPERSEDED",
  },

  application: whereCondition,
},

    include: {
      fields: {
        include: {
          builderField: true,
        },
      },

      application: {
        select: {
          id: true,
          amountRequested: true,
          status: true,

          applicationLenders: {
            select: {
              status: true,
            },
          },
        },
      },
    },
  });

          console.log(applications);
        /* ================= TOTAL VOLUME ================= */

const totalVolume = applications.reduce(
  (sum, submission) => {
    const amountField =
      submission.fields.find(
        (f) =>
          f.builderField?.fieldKey ===
            "amountRequested" ||
          f.builderField?.fieldKey ===
            "loan_amount" ||
          f.fieldKey ===
            "amountRequested" ||
          f.fieldKey === "loan_amount",
      );

const rawAmount =
  amountField?.value ||
  submission.application
    ?.amountRequested ||
  0;

const parsedAmount = Number(
  String(rawAmount)
    .replace(/[$,]/g, "")
    .trim(),
);

const amount = isNaN(parsedAmount)
  ? 0
  : parsedAmount;

    return Number(sum || 0) + Number(amount || 0);
  },
  0,
);

        /* ================= APPROVED ================= */

        /* ================= APPROVED ================= */

const approved = applications.filter(
  (submission) =>
    submission.application?.applicationLenders?.some(
      (l) => l.status === "APPROVED",
    ),
).length;

/* ================= REJECTED ================= */

const rejected = applications.filter(
  (submission) =>
    submission.application?.applicationLenders
      ?.length > 0 &&
    submission.application?.applicationLenders.every(
      (l) => l.status === "DECLINED",
    ),
).length;

/* ================= IN REVIEW ================= */

const inReview = applications.filter(
  (submission) =>
    submission.application?.status ===
      "IN_REVIEW" ||
    submission.application?.applicationLenders?.some(
      (l) => l.status === "IN_REVIEW",
    ),
).length;

/* ================= DRAFT ================= */

const draft = applications.filter(
  (submission) =>
    submission.application?.status === "DRAFT",
).length;

/* ================= SUBMITTED ================= */

const submitted = applications.filter(
  (submission) =>
    submission.application?.status ===
    "SUBMITTED",
).length;

/* ================= CLIENT PENDING ================= */

const clientPending = applications.filter(
  (submission) =>
    submission.application?.status ===
    "CLIENT_PENDING",
).length;

/* ================= NEW APPLICATIONS ================= */

const newApplications = applications.filter(
  (submission) =>
    submission.application?.status === "NEW",
).length;

        /* ================= RESPONSE ================= */

        return reply.send({
          success: true,

          data: {
            totalVolume,

            totalApplications:
              applications.length,

            newApplications,

            submitted,

            clientPending,

            approved,

            rejected,

            inReview,

            draft,
          },
        });
      } catch (error) {
        req.log.error(error);

        return reply.code(500).send({
          success: false,
          message:
            "Failed to fetch pipeline stats",
          error: error.message,
        });
      }
    },
  );
};