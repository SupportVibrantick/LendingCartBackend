const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const jwtSecret = require("../../../utils/auth/jwtSecret");
const {
  findInviteByToken,
  splitFullName,
} = require("../../../services/lenderInvites/adminLenderInviteHelpers");
const {
  notifyPlatform,
  PLATFORM_NOTIFICATION_EVENTS,
} = require("../../../services/notifications/platformNotifications");
const {
  createAndSendEmailVerification,
} = require("../../../services/auth/emailVerification");
const {
  checkRateLimit,
  getClientIp,
} = require("../../../utils/security/rateLimit");
const {
  verifyRecaptchaToken,
  isCaptchaConfigured,
  getCaptchaSiteKey,
} = require("../../../utils/security/recaptcha");

function issueLenderToken(user, roles) {
  return jwt.sign(
    {
      id: user.id,
      organizationId: user.organizationId,
      orgType: "LENDER",
      roles,
    },
    jwtSecret,
    {
      expiresIn: "7d",
      issuer: "lendingcart",
      audience: "lender-app",
    },
  );
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function lenderRegisterRoutes(fastify) {
  fastify.get(
    "/public-config",
    {
      schema: {
        tags: ["Lender -> Auth"],
        summary: "Public lender signup config",
      },
    },
    async (_req, reply) => {
      const captchaConfigured = isCaptchaConfigured();
      return reply.send({
        success: true,
        data: {
          captchaRequired: captchaConfigured,
          captchaSiteKey: captchaConfigured ? getCaptchaSiteKey() : "",
          publicSignupEnabled: true,
        },
      });
    },
  );

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
            password: { type: "string", minLength: 8 },
            inviteToken: { type: "string" },
            source: { type: "string", enum: ["public", "invite", "direct"] },
            captchaToken: { type: "string" },
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
        captchaToken,
      } = req.body || {};

      const source = inviteToken
        ? "invite"
        : String(req.body?.source || "public").toLowerCase() === "direct"
          ? "direct"
          : "public";

      if (!organizationName || !organizationEmail || !adminEmail || !password) {
        return reply.status(400).send({
          success: false,
          message: "Missing required fields",
        });
      }

      if (String(password).length < 8) {
        return reply.status(400).send({
          success: false,
          message: "Password must be at least 8 characters",
          field: "password",
        });
      }

      const clientIp = getClientIp(req);
      const normalizedOrgEmail = String(organizationEmail).trim().toLowerCase();
      const normalizedAdminEmail = String(adminEmail).trim().toLowerCase();

      if (source === "public") {
        // Rate limit per email (not global/IP), so different emails are not blocked together.
        const limit = checkRateLimit(
          `lender-public-register:email:${normalizedAdminEmail}`,
          {
            windowMs: 15 * 60 * 1000,
            max: Number(process.env.PUBLIC_SIGNUP_RATE_MAX || 5),
          },
        );
        if (!limit.allowed) {
          reply.header("Retry-After", String(limit.retryAfterSec));
          return reply.status(429).send({
            success: false,
            message: "Too many signup attempts. Please try again later.",
            code: "RATE_LIMITED",
            retryAfterSec: limit.retryAfterSec,
          });
        }

        try {
          const captcha = await verifyRecaptchaToken(captchaToken, clientIp);
          if (!captcha.ok) {
            return reply.status(400).send({
              success: false,
              message: captcha.message || "Captcha verification failed",
              code: "CAPTCHA_FAILED",
            });
          }
        } catch (captchaErr) {
          req.log.error(captchaErr, "reCAPTCHA verify error");
          return reply.status(400).send({
            success: false,
            message: "Captcha verification failed",
            code: "CAPTCHA_FAILED",
          });
        }
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
        if (normalizedAdminEmail !== inviteEmail) {
          return reply.status(400).send({
            success: false,
            message: "Registration email must match the invitation email",
            field: "adminEmail",
          });
        }
      }

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
          code: "ORG_EXISTS",
        });
      }

      const userExists = await prisma.userAccount.findFirst({
        where: { email: normalizedAdminEmail, isDeleted: false },
      });

      if (userExists) {
        return reply.status(409).send({
          success: false,
          message: "Email already registered",
          code: "EMAIL_EXISTS",
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
              phone: organizationPhone || invite?.phone || null,
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
              emailVerifiedAt: invite ? new Date() : null,
              ...(invite ? { lastLoginAt: new Date() } : {}),
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

      const roles = ["LENDER_ADMIN"];

      if (!invite) {
        try {
          await createAndSendEmailVerification(prisma, {
            id: adminUser.id,
            email: adminUser.email,
            firstName: adminUser.firstName,
            lastName: adminUser.lastName,
          });
        } catch (mailErr) {
          req.log.error(mailErr, "Email verification send failed after register");
        }
      }

      try {
        await notifyPlatform(prisma, fastify.io, {
          eventType: PLATFORM_NOTIFICATION_EVENTS.LENDER_REGISTERED,
          category: "ORGANIZATION",
          subject: "New lender registered",
          body: `Lender organization "${organizationName}" registered via ${source === "invite" ? "invitation" : "public partner link"} (${normalizedAdminEmail}).`,
          metadata: {
            organizationId: lenderOrg.id,
            organizationName: String(organizationName).trim(),
            adminEmail: normalizedAdminEmail,
            source: source === "invite" ? "LENDER_INVITE" : "PUBLIC_PARTNER_LINK",
          },
        });
      } catch (notifyErr) {
        req.log.error(notifyErr, "Lender register platform notification failed");
      }

      // Hard gate: public signup must verify email before receiving a session token
      if (!invite) {
        return reply.status(201).send({
          success: true,
          message:
            "Account created. Please verify your email before signing in.",
          data: {
            organizationId: lenderOrg.id,
            adminUserId: adminUser.id,
            inviteAccepted: false,
            emailVerified: false,
            emailVerificationRequired: true,
            email: adminUser.email,
          },
        });
      }

      const token = issueLenderToken(adminUser, roles);

      return reply.status(201).send({
        success: true,
        message: "Lender registered successfully",
        data: {
          organizationId: lenderOrg.id,
          adminUserId: adminUser.id,
          inviteAccepted: true,
          emailVerified: true,
          emailVerificationRequired: false,
          token,
          user: {
            id: adminUser.id,
            email: adminUser.email,
            name: `${adminUser.firstName || ""} ${adminUser.lastName || ""}`.trim(),
            organizationId: lenderOrg.id,
            organizationName: lenderOrg.name,
            roles,
            emailVerified: true,
          },
        },
      });
    },
  );
}

module.exports = lenderRegisterRoutes;
