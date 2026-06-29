const bcrypt = require("bcrypt");
const crypto = require("crypto");
const {
  sendSubBrokerCredentialsEmail,
} = require("../../../services/subBrokerCredentialsEmail");
const {
  buildProfileDataFromFields,
  parseMultipartRequest,
  syncSubBrokerLoanOfficers,
  formatSubBrokerDetail,
  parseJsonField,
  validatePrimaryContactFields,
} = require("../../../utils/subBrokerProfileHelpers");

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

function validateCreateFields(fields) {
  if (!fields.agentType) return { error: "Agent type is required" };

  const contactValidation = validatePrimaryContactFields(fields);
  if (contactValidation.error) {
    return { error: contactValidation.error };
  }

  const allowedToLogin =
    fields.allowedToLogin === true ||
    fields.allowedToLogin === "true" ||
    fields.allowedToLogin === "1";
  const password = String(fields.password || "");
  const confirmPassword = String(fields.confirmPassword || password);

  if (allowedToLogin) {
    if (!password) return { error: "Password is required when login is enabled" };
    if (password.length < 8) return { error: "Password must be at least 8 characters" };
    if (password !== confirmPassword) return { error: "Passwords do not match" };
  }

  const { account } = contactValidation;

  return {
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    phone: account.phone,
    password: allowedToLogin ? password : crypto.randomBytes(16).toString("hex"),
    allowedToLogin,
  };
}

async function createSubBrokerRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Broker -> Sub Broker"],
        summary: "Create Sub Broker with full profile",
        consumes: ["multipart/form-data", "application/json"],
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Authentication required",
          });
        }

        if (!req.user.organizationId || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const roles = req.user.roles || [];
        const allowedRoles = ["BROKER_ADMIN", "BROKER_OFFICER"];
        const hasAccess = roles.some((role) => allowedRoles.includes(role));

        if (!hasAccess) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        const brokerOrgId = req.user.organizationId;
        const userId = req.user.id;

        const { fields, logoUrl, w9Url } = await parseMultipartRequest(req);
        const validation = validateCreateFields(fields);

        if (validation.error) {
          return reply.code(400).send({
            success: false,
            message: validation.error,
          });
        }

        const {
          email,
          firstName,
          lastName,
          phone,
          password,
          allowedToLogin,
        } = validation;

        const assignedLoanOfficerIds = parseJsonField(
          fields.assignedLoanOfficerIds,
          [],
        );

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
          });
        }

        const profileData = buildProfileDataFromFields(fields);
        profileData.allowedToLogin = allowedToLogin;

        await prisma.subBrokerProfile.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            profileData,
            logoUrl,
            w9Url,
          },
          update: {
            profileData,
            ...(logoUrl ? { logoUrl } : {}),
            ...(w9Url ? { w9Url } : {}),
          },
        });

        await syncSubBrokerLoanOfficers(
          prisma,
          user.id,
          assignedLoanOfficerIds,
          brokerOrgId,
        );

        if (allowedToLogin) {
          await sendSubBrokerWelcomeEmail(fastify, prisma, {
            brokerOrgId,
            firstName,
            email,
            password,
            subBrokerId: user.id,
          });
        }

        const detail = await prisma.userAccount.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            createdById: true,
            subBrokerProfile: true,
            subBrokerLoanOfficers: {
              include: {
                loanOfficer: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    profileImage: true,
                  },
                },
              },
            },
          },
        });

        return reply.send({
          success: true,
          message: "Sub broker created successfully",
          data: formatSubBrokerDetail(
            detail,
            detail.subBrokerProfile,
            detail.subBrokerLoanOfficers,
          ),
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            user: req.user,
          },
          "Create sub broker failed",
        );

        return reply.code(500).send({
          success: false,
          message: error.message || "Internal server error",
        });
      }
    },
  );
}

module.exports = createSubBrokerRoutes;
