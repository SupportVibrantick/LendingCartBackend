const bcrypt = require("bcrypt");
const { logAudit } = require("../../../services/logger/auditLogger");
const {
  sendLoanOfficerCredentialsEmail,
} = require("../../../services/emails/loanOfficerCredentialsEmail");
const {
  buildProfileDataFromFields,
  parseBrokerUserMultipart,
  syncUserPermissions,
  parsePermissionsField,
} = require("../../../utils/broker/brokerUserProfileHelpers");
const {
  parseJsonField,
  syncLoanOfficerSubBrokers,
} = require("../../../utils/broker/subBrokerProfileHelpers");

module.exports = async function createBrokerUser(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Broker -> Users"],
        summary: "Create Loan Officer with full profile",
        consumes: ["multipart/form-data"],
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        if (!req.user.roles?.includes("BROKER_ADMIN")) {
          return reply.code(403).send({
            success: false,
            message: "Only Broker Admin can create users",
          });
        }

        const brokerOrgId = req.user.organizationId;

        let fields;
        let avatarUrl;
        let w9Url;

        try {
          ({ fields, avatarUrl, w9Url } = await parseBrokerUserMultipart(req));
        } catch (uploadErr) {
          return reply.code(400).send({
            success: false,
            message: uploadErr.message || "Invalid upload",
          });
        }

        const {
          email,
          confirmEmail,
          password,
          confirmPassword,
          firstName,
          lastName,
          phone,
          allowedToLogin,
          company,
          address,
          agentType,
          licenseNumber,
          preferredComm,
          website,
        } = fields;

        let parsedPermissions = [];
        try {
          parsedPermissions = parsePermissionsField(fields);
        } catch {
          return reply.code(400).send({
            success: false,
            message: "Invalid permissions format",
          });
        }

        if (
          !email ||
          !confirmEmail ||
          !firstName ||
          !lastName
        ) {
          return reply.code(400).send({
            success: false,
            message: "Required fields missing",
          });
        }

        const loginEnabled = allowedToLogin !== "false";

        if (loginEnabled && (!password || !confirmPassword)) {
          return reply.code(400).send({
            success: false,
            message: "Password is required when login is enabled",
          });
        }

        if (email !== confirmEmail) {
          return reply.code(400).send({
            success: false,
            message: "Email and Confirm Email do not match",
          });
        }

        if (loginEnabled && password !== confirmPassword) {
          return reply.code(400).send({
            success: false,
            message: "Password and Confirm Password do not match",
          });
        }

        const existingUser = await prisma.userAccount.findUnique({
          where: { email },
        });

        if (existingUser) {
          return reply.code(400).send({
            success: false,
            message: "Email already registered",
          });
        }

        const passwordHash = loginEnabled
          ? await bcrypt.hash(password, 10)
          : await bcrypt.hash(
              `disabled-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              10,
            );
        const profileData = buildProfileDataFromFields(fields);
        const assignedCoBrokerIds = parseJsonField(
          fields.assignedCoBrokerIds,
          [],
        );

        const roleRecord = await prisma.role.findFirst({
          where: { name: "BROKER_OFFICER" },
        });

        if (!roleRecord) {
          return reply.code(500).send({
            success: false,
            message: "Role configuration error",
          });
        }

        const newUser = await prisma.$transaction(async (tx) => {
          const user = await tx.userAccount.create({
            data: {
              email,
              passwordHash,
              firstName,
              lastName,
              phone,
              organizationId: brokerOrgId,
              status: allowedToLogin === "false" ? "DISABLED" : "ACTIVE",
            },
          });

          await tx.userRole.create({
            data: {
              userId: user.id,
              roleId: roleRecord.id,
            },
          });

          await tx.brokerUserProfile.create({
            data: {
              userId: user.id,
              company,
              address,
              agentType: agentType || "Loan Officer",
              licenseNumber,
              preferredComm,
              website,
              avatarUrl,
              w9Url,
              profileData,
            },
          });

          await syncUserPermissions(tx, user.id, parsedPermissions);

          await syncLoanOfficerSubBrokers(
            tx,
            user.id,
            assignedCoBrokerIds,
            brokerOrgId,
          );

          return user;
        });

        await logAudit({
          prisma,
          req,
          dashboard: "BROKER",
          category: "USER_MANAGEMENT",
          entityType: "UserAccount",
          entityId: newUser.id,
          action: "CREATE_BROKER_OFFICER",
          newValue: {
            email,
            firstName,
            lastName,
          },
        });

        if (newUser.status === "ACTIVE" && loginEnabled) {
          try {
            const organization = await prisma.organization.findUnique({
              where: { id: brokerOrgId },
              select: { name: true },
            });

            await sendLoanOfficerCredentialsEmail({
              firstName,
              email,
              password,
              organizationName: organization?.name,
              prisma,
            });
          } catch (mailErr) {
            fastify.log.error(
              {
                error: mailErr.message,
                to: email,
                loanOfficerId: newUser.id,
              },
              "Loan officer created but welcome email failed",
            );
          }
        }

        return reply.code(201).send({
          success: true,
          message: "Loan Officer created successfully",
          data: {
            id: newUser.id,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            status: newUser.status,
          },
        });
      } catch (error) {
        fastify.log.error({
          error: error.message,
          stack: error.stack,
        });

        return reply.code(500).send({
          success: false,
          message: error.message ||"Internal server error while creating user",
        });
      }
    },
  );
};
