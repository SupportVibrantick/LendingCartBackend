const bcrypt = require("bcrypt");
const {
  sendSubBrokerCredentialsEmail,
} = require("../../../services/subBrokerCredentialsEmail");

function buildFreedDeletedEmail(user) {
  const at = user.email.lastIndexOf("@");
  if (at === -1) {
    return `${user.id.replace(/-/g, "")}.deleted@removed.local`;
  }

  const local = user.email.slice(0, at);
  const domain = user.email.slice(at + 1);
  return `${local}+deleted.${user.id.slice(0, 8)}.${Date.now()}@${domain}`;
}

async function sendSubBrokerWelcomeEmail(fastify, prisma, {
  brokerOrgId,
  firstName,
  email,
  password,
  subBrokerId,
}) {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: brokerOrgId },
      select: { name: true },
    });

    await sendSubBrokerCredentialsEmail({
      firstName,
      email,
      password,
      organizationName: organization?.name,
    });

    fastify.log.info(
      { to: email, subBrokerId },
      "Sub broker welcome email sent",
    );
  } catch (mailErr) {
    fastify.log.error(
      {
        error: mailErr.message,
        stack: mailErr.stack,
        to: email,
        subBrokerId,
      },
      "Sub broker created but welcome email failed",
    );
  }
}

async function createSubBrokerRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Broker -> Sub Broker"],
        summary: "Create Sub Broker",

        body: {
          type: "object",
          required: ["email", "password", "firstName"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            firstName: { type: "string" },
            lastName: { type: "string" },
            phone: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ===============================
           AUTH CHECK (MATCH YOUR STYLE)
        =============================== */
        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Authentication required",
          });
        }

        if (
          !req.user.organizationId ||
          req.user.orgType !== "BROKER"
        ) {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const roles = req.user.roles || [];

        const allowedRoles = ["BROKER_ADMIN", "BROKER_OFFICER"];

        const hasAccess = roles.some((role) =>
          allowedRoles.includes(role)
        );

        if (!hasAccess) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        const brokerOrgId = req.user.organizationId;
        const userId = req.user.id;

        /* ===============================
           INPUT
        =============================== */
        const email = req.body.email.trim().toLowerCase();
        const { password, firstName, lastName, phone } = req.body;

        /* ===============================
           CHECK EXISTING USER
        =============================== */
        const existingUser = await prisma.userAccount.findFirst({
          where: {
            email: {
              equals: email,
              mode: "insensitive",
            },
          },
          include: {
            roles: {
              include: { role: true },
            },
          },
        });

        if (existingUser && !existingUser.isDeleted) {
          return reply.code(400).send({
            success: false,
            message: "Email already exists",
          });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const role = await prisma.role.findFirst({
          where: { name: "SUB_BROKER" },
        });

        if (!role) {
          return reply.code(500).send({
            success: false,
            message: "SUB_BROKER role not found",
          });
        }

        let user;

        if (existingUser?.isDeleted) {
          const isSameOrgSubBroker =
            existingUser.organizationId === brokerOrgId &&
            existingUser.roles.some((entry) => entry.role.name === "SUB_BROKER");

          if (isSameOrgSubBroker) {
            user = await prisma.userAccount.update({
              where: { id: existingUser.id },
              data: {
                email,
                passwordHash: hashedPassword,
                firstName,
                lastName,
                phone,
                organizationId: brokerOrgId,
                createdById: userId,
                isDeleted: false,
                deletedAt: null,
                status: "ACTIVE",
              },
              include: {
                roles: {
                  include: { role: true },
                },
              },
            });
          } else {
            await prisma.userAccount.update({
              where: { id: existingUser.id },
              data: {
                email: buildFreedDeletedEmail(existingUser),
              },
            });

            user = await prisma.userAccount.create({
              data: {
                email,
                passwordHash: hashedPassword,
                firstName,
                lastName,
                phone,
                organizationId: brokerOrgId,
                createdById: userId,
                roles: {
                  create: {
                    roleId: role.id,
                  },
                },
              },
              include: {
                roles: {
                  include: { role: true },
                },
              },
            });
          }
        } else {
          user = await prisma.userAccount.create({
            data: {
              email,
              passwordHash: hashedPassword,
              firstName,
              lastName,
              phone,
              organizationId: brokerOrgId,
              createdById: userId,
              roles: {
                create: {
                  roleId: role.id,
                },
              },
            },
            include: {
              roles: {
                include: { role: true },
              },
            },
          });
        }

        await sendSubBrokerWelcomeEmail(fastify, prisma, {
          brokerOrgId,
          firstName,
          email,
          password,
          subBrokerId: user.id,
        });

        /* ===============================
           RESPONSE
        =============================== */
        return reply.send({
          success: true,
          message: "Sub broker created successfully",
          data: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            roles: user.roles.map((r) => r.role.name),
          },
        });

      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            body: req.body,
            user: req.user,
          },
          "❌ Create sub broker failed"
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );
}

module.exports = createSubBrokerRoutes;