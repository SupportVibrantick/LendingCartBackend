const bcrypt = require("bcrypt");
const {
  findInviteByToken,
  splitFullName,
} = require("../../../services/lenderInvites/adminLenderInviteHelpers");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function lenderRegisterRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Lender -> Auth"],
        summary: "Lender self registration",
        body: {
          type: "object",
          required: [
            "organizationName",
            "organizationEmail",
            "adminEmail",
            "password",
          ],
          properties: {
            organizationName: { type: "string" },
            organizationEmail: { type: "string" },
            organizationPhone: { type: "string" },
            adminFirstName: { type: "string" },
            adminLastName: { type: "string" },
            adminEmail: { type: "string" },
            password: { type: "string" },
            inviteToken: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const {
        organizationName,
        organizationEmail,
        organizationPhone,
        adminFirstName,
        adminLastName,
        adminEmail,
        password,
        inviteToken,
      } = req.body || {};

      if (!organizationName || !organizationEmail || !adminEmail || !password) {
        return reply.status(400).send({
          success: false,
          message: "Missing required fields",
        });
      }

      let invite = null;
      if (inviteToken) {
        invite = await findInviteByToken(prisma, inviteToken);

        if (!invite) {
          return reply.status(404).send({
            success: false,
            message: "Invitation not found or invalid",
            code: "NOT_FOUND",
          });
        }

        if (invite.status !== "PENDING") {
          return reply.status(400).send({
            success: false,
            message: `Invitation is not available (status: ${invite.status})`,
            code: invite.status,
          });
        }

        const inviteEmail = String(invite.email).toLowerCase();
        if (String(adminEmail).trim().toLowerCase() !== inviteEmail) {
          return reply.status(400).send({
            success: false,
            message: "Registration email must match the invitation email",
            field: "adminEmail",
          });
        }
      } else {
        // Open self-signup remains available unless you later lock it down
      }

      const normalizedOrgEmail = String(organizationEmail).trim().toLowerCase();
      const normalizedAdminEmail = String(adminEmail).trim().toLowerCase();

      const orgExists = await prisma.organization.findFirst({
        where: {
          OR: [{ name: organizationName }, { email: normalizedOrgEmail }],
          isDeleted: false,
        },
      });

      if (orgExists) {
        return reply.status(409).send({
          success: false,
          message: "Organization already exists",
        });
      }

      const userExists = await prisma.userAccount.findFirst({
        where: { email: normalizedAdminEmail, isDeleted: false },
      });

      if (userExists) {
        return reply.status(409).send({
          success: false,
          message: "Email already registered",
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const nameParts = splitFullName(
        [adminFirstName, adminLastName].filter(Boolean).join(" ") ||
          invite?.fullName ||
          "Lender Admin",
      );

      let lenderOrg;
      let adminUser;

      try {
        await prisma.$transaction(async (tx) => {
          lenderOrg = await tx.organization.create({
            data: {
              name: String(organizationName).trim(),
              email: normalizedOrgEmail,
              phone:
                organizationPhone ||
                invite?.phone ||
                null,
              type: "LENDER",
              status: "ACTIVE",
            },
          });

          adminUser = await tx.userAccount.create({
            data: {
              organizationId: lenderOrg.id,
              email: normalizedAdminEmail,
              passwordHash,
              firstName: adminFirstName || nameParts.firstName,
              lastName: adminLastName || nameParts.lastName,
              phone: organizationPhone || invite?.phone || null,
              status: "ACTIVE",
            },
          });

          const role = await tx.role.findFirst({
            where: { name: "LENDER_ADMIN" },
          });

          if (!role) throw new Error("LENDER_ADMIN role missing");

          await tx.userRole.create({
            data: {
              userId: adminUser.id,
              roleId: role.id,
            },
          });

          await tx.lenderProfile.create({
            data: {
              lenderOrgId: lenderOrg.id,
              profileStatus: "DRAFT",
              isVisible: false,
            },
          });

          if (invite) {
            await tx.adminLenderInvite.update({
              where: { id: invite.id },
              data: {
                status: "ACCEPTED",
                acceptedAt: new Date(),
                lenderOrgId: lenderOrg.id,
              },
            });
          }
        });
      } catch (error) {
        req.log.error(error, "Lender registration failed");
        return reply.status(500).send({
          success: false,
          message: error.message || "Registration failed",
        });
      }

      return reply.status(201).send({
        success: true,
        message: "Lender registered successfully",
        data: {
          organizationId: lenderOrg.id,
          adminUserId: adminUser.id,
          inviteAccepted: Boolean(invite),
        },
      });
    },
  );
}

module.exports = lenderRegisterRoutes;
