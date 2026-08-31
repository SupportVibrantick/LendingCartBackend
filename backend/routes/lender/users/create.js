const bcrypt = require("bcrypt");
const { logAudit } = require("../../../services/logger/auditLogger");
const {
  sendLenderTeamCredentialsEmail,
} = require("../../../services/emails/lenderTeamCredentialsEmail");
const {
  isLenderAdmin,
  LENDER_TEAM_ASSIGNABLE_ROLES,
  generateTemporaryPassword,
} = require("../../../utils/lender/lenderTeamRoles");
const {
  ensureLenderTeamRole,
} = require("../../../services/lender/ensureLenderTeamRole");

module.exports = async function createLenderUser(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Lender -> Team Members"],
        summary: "Invite a lender team member",
        body: {
          type: "object",
          required: ["firstName", "lastName", "email", "role"],
          properties: {
            firstName: { type: "string", minLength: 1 },
            lastName: { type: "string", minLength: 1 },
            email: { type: "string", format: "email" },
            role: {
              type: "string",
              enum: LENDER_TEAM_ASSIGNABLE_ROLES,
            },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user || req.user.orgType !== "LENDER") {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        if (!isLenderAdmin(req.user)) {
          return reply.code(403).send({
            success: false,
            message: "Only lender admins can invite team members",
          });
        }

        const lenderOrgId = req.user.organizationId;
        const { firstName, lastName, email, role } = req.body;
        const normalizedEmail = String(email).trim().toLowerCase();

        const existingUser = await prisma.userAccount.findUnique({
          where: { email: normalizedEmail },
        });

        if (existingUser && !existingUser.isDeleted) {
          return reply.code(400).send({
            success: false,
            message: "A user with this email already exists",
          });
        }

        if (
          existingUser?.isDeleted &&
          existingUser.organizationId !== lenderOrgId
        ) {
          return reply.code(400).send({
            success: false,
            message:
              "This email is already registered with another organization",
          });
        }

        const roleRecord = await ensureLenderTeamRole(prisma, role);

        if (!roleRecord?.id) {
          return reply.code(400).send({
            success: false,
            message: "Selected role is not configured",
          });
        }

        const temporaryPassword = generateTemporaryPassword();
        const passwordHash = await bcrypt.hash(temporaryPassword, 12);
        const trimmedFirstName = String(firstName).trim();
        const trimmedLastName = String(lastName).trim();
        const isReinvite = Boolean(existingUser?.isDeleted);

        const invitedUser = await prisma.$transaction(async (tx) => {
          if (isReinvite && existingUser) {
            const user = await tx.userAccount.update({
              where: { id: existingUser.id },
              data: {
                email: normalizedEmail,
                passwordHash,
                firstName: trimmedFirstName,
                lastName: trimmedLastName,
                organizationId: lenderOrgId,
                status: "ACTIVE",
                isDeleted: false,
                deletedAt: null,
                lastLoginAt: null,
                createdById: req.user.userId || req.user.id,
              },
            });

            await tx.userRole.deleteMany({ where: { userId: user.id } });
            await tx.userRole.create({
              data: {
                userId: user.id,
                roleId: roleRecord.id,
              },
            });

            return user;
          }

          const user = await tx.userAccount.create({
            data: {
              email: normalizedEmail,
              passwordHash,
              firstName: trimmedFirstName,
              lastName: trimmedLastName,
              organizationId: lenderOrgId,
              status: "ACTIVE",
              createdById: req.user.userId || req.user.id,
            },
          });

          await tx.userRole.create({
            data: {
              userId: user.id,
              roleId: roleRecord.id,
            },
          });

          return user;
        });

        const organization = await prisma.organization.findUnique({
          where: { id: lenderOrgId },
          select: { name: true },
        });

        try {
          await sendLenderTeamCredentialsEmail({
            firstName: invitedUser.firstName,
            email: invitedUser.email,
            password: temporaryPassword,
            organizationName: organization?.name,
            roleName: role,
            invitationKey: `${invitedUser.id}:${invitedUser.updatedAt.toISOString()}`,
            prisma,
          });
        } catch (mailErr) {
          if (isReinvite && existingUser) {
            await prisma.$transaction([
              prisma.userRole.deleteMany({ where: { userId: invitedUser.id } }),
              prisma.userAccount.update({
                where: { id: invitedUser.id },
                data: {
                  isDeleted: true,
                  deletedAt: new Date(),
                  status: "DISABLED",
                },
              }),
            ]);
          } else {
            await prisma.$transaction([
              prisma.userRole.deleteMany({ where: { userId: invitedUser.id } }),
              prisma.userAccount.delete({ where: { id: invitedUser.id } }),
            ]);
          }

          fastify.log.error(
            {
              error: mailErr.message,
              userId: invitedUser.id,
              email: invitedUser.email,
            },
            "Lender team invite rolled back because invitation email failed",
          );

          return reply.code(502).send({
            success: false,
            message:
              mailErr.message ||
              "Invitation email could not be sent. Please check SMTP settings and try again.",
          });
        }

        await logAudit({
          prisma,
          req,
          dashboard: "LENDER",
          category: "USER_MANAGEMENT",
          entityType: "UserAccount",
          entityId: invitedUser.id,
          action: isReinvite
            ? "REINVITE_LENDER_TEAM_MEMBER"
            : "INVITE_LENDER_TEAM_MEMBER",
          newValue: {
            email: invitedUser.email,
            firstName: invitedUser.firstName,
            lastName: invitedUser.lastName,
            role,
          },
        });

        return reply.code(201).send({
          success: true,
          message: "Team member invited successfully. Invitation email sent.",
          data: {
            id: invitedUser.id,
            email: invitedUser.email,
            firstName: invitedUser.firstName,
            lastName: invitedUser.lastName,
            role,
            status: invitedUser.status,
          },
        });
      } catch (error) {
        if (error.code === "INVALID_ROLE") {
          return reply.code(400).send({
            success: false,
            message: "Invalid team role selected",
          });
        }

        fastify.log.error(error, "Failed to invite lender team member");

        return reply.code(500).send({
          success: false,
          message: "Failed to invite team member",
        });
      }
    },
  );
};
