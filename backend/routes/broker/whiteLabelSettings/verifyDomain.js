const {
  checkDomainDns,
  getDnsInstructions,
  buildCustomDomainBaseUrl,
} = require("../../../services/broker/customDomain.service");
const {
  rememberHostname,
  forgetHostname,
} = require("../../../services/broker/verifiedCustomDomainCache");

async function requireLoanOfficerBrandingManage(req, reply, fastify) {
  if (!req.user?.roles?.includes("BROKER_OFFICER")) return;
  await fastify.requirePermission("MANAGE_BRANDING")(req, reply);
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function verifyCustomDomain(fastify) {
  // Allow empty POST body when clients send Content-Type: application/json
  // (Postman / fetch with auth JSON headers and no payload).
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      try {
        const raw = typeof body === "string" ? body.trim() : "";
        done(null, raw ? JSON.parse(raw) : {});
      } catch (err) {
        err.statusCode = 400;
        done(err, undefined);
      }
    },
  );

  fastify.post(
    "/verify-domain",
    {
      preHandler: async (req, reply) => {
        await requireLoanOfficerBrandingManage(req, reply, fastify);
      },
      schema: {
        tags: ["Broker -> White Label"],
        summary: "Verify broker custom domain DNS",
        description:
          "Checks public DNS (CNAME / A / TXT) for the saved custom domain and marks it verified when records match.",
        body: {
          type: "object",
          additionalProperties: true,
        },
      },
    },
    async (req, reply) => {
      if (!req.user || req.user.orgType !== "BROKER") {
        return reply.code(403).send({
          success: false,
          message: "Broker access only",
        });
      }

      const brokerOrgId = req.user.organizationId;
      const prisma = fastify.prisma;

      try {
        const settings = await prisma.brokerWhiteLabelSetting.findFirst({
          where: { brokerOrgId },
        });

        if (!settings?.customDomain) {
          return reply.code(400).send({
            success: false,
            message: "Save a custom domain first, then verify DNS.",
          });
        }

        const hostname = settings.customDomain;
        const { verified, details, cnameTarget, aTarget } =
          await checkDomainDns(hostname, brokerOrgId);

        if (!verified) {
          await prisma.brokerWhiteLabelSetting.update({
            where: { id: settings.id },
            data: {
              domainVerified: false,
              sslStatus: "PENDING",
              updatedAt: new Date(),
            },
          });
          forgetHostname(hostname);

          return reply.code(400).send({
            success: false,
            message:
              "DNS not verified yet. Confirm your CNAME (or TXT) record, wait for propagation, then try again.",
            data: {
              customDomain: hostname,
              domainVerified: false,
              sslStatus: "PENDING",
              dnsInstructions: getDnsInstructions(hostname, brokerOrgId),
              dnsCheck: {
                cnameTarget: cnameTarget || null,
                aTarget: aTarget || null,
                ...details,
              },
              publicBaseUrl: null,
            },
          });
        }

        const updated = await prisma.brokerWhiteLabelSetting.update({
          where: { id: settings.id },
          data: {
            domainVerified: true,
            // App-level ready; edge TLS still depends on your CDN/proxy config.
            sslStatus: "ACTIVE",
            updatedAt: new Date(),
          },
        });
        rememberHostname(hostname);

        return reply.send({
          success: true,
          message: "Custom domain verified. Share links and portals will use it.",
          data: {
            customDomain: updated.customDomain,
            domainVerified: updated.domainVerified,
            sslStatus: updated.sslStatus,
            dnsInstructions: getDnsInstructions(hostname, brokerOrgId),
            dnsCheck: details,
            publicBaseUrl: buildCustomDomainBaseUrl(hostname),
          },
        });
      } catch (err) {
        fastify.log.error(
          { err, route: "verify-custom-domain" },
          "Custom domain verification failed",
        );
        return reply.code(err.statusCode || 500).send({
          success: false,
          message: err.message || "Failed to verify custom domain DNS",
        });
      }
    },
  );
}

module.exports = verifyCustomDomain;
