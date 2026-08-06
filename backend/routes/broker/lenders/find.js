/**
 * @param {import("fastify").FastifyInstance} fastify
 */
const { requireLoMarketplaceView } = require("../../../services/broker/loanOfficerAccess");

async function findBrokerLendersRoutes(fastify) {
  fastify.get(
    "/",
    {
      preHandler: [
        fastify.authenticate,
        async (req, reply) => {
          await requireLoMarketplaceView(req, reply, fastify);
        },
      ],
      schema: {
        tags: ["Broker -> Lenders"],
        summary: "Find lenders",
        description:
          "Search lenders to invite (excludes already assigned lenders)",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ===============================
           1. AUTH / BROKER GUARD
        =============================== */
        if (!req.user || !req.user.organizationId) {
          return reply.status(403).send({
            success: false,
            message: "Unauthorized",
          });
        }

        const brokerOrg = await prisma.organization.findFirst({
          where: {
            id: req.user.organizationId,
            type: "BROKER",
            isDeleted: { not: true },
          },
          select: { id: true },
        });

        if (!brokerOrg) {
          return reply.status(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = brokerOrg.id;

        /* ===============================
           2. PAGINATION & SEARCH
        =============================== */
        const q = req.query.q || "";
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const loanProduct = (req.query.loanProduct || "").trim();
        const state = (req.query.state || "").trim().toUpperCase();
        const fundingMax = req.query.fundingMax
          ? Number(req.query.fundingMax)
          : null;
        const minAmount = req.query.minAmount
          ? Number(req.query.minAmount)
          : null;
        const maxAmount = req.query.maxAmount
          ? Number(req.query.maxAmount)
          : null;
        const industry = (req.query.industry || "").trim();
        const eligibleOnly = req.query.eligible === "true";

        /* ===============================
           3. CONNECTED LENDERS
        =============================== */
        const connected = await prisma.brokerLenderAccess.findMany({
          where: {
            brokerOrgId,
            isActive: true,
          },
          select: {
            lenderOrgId: true,
          },
        });

        const connectedLenderIds = connected.map(c => c.lenderOrgId);

        /* ===============================
           4. SEARCH FILTER
        =============================== */
        const searchFilter = q.trim()
          ? {
              OR: [
                {
                  name: {
                    contains: q.trim(),
                    mode: "insensitive",
                  },
                },
                {
                  lenderProfile: {
                    is: {
                      summary: {
                        contains: q.trim(),
                        mode: "insensitive",
                      },
                    },
                  },
                },
                {
                  lenderProfile: {
                    is: {
                      statesSupported: {
                        contains: q.trim(),
                        mode: "insensitive",
                      },
                    },
                  },
                },
                {
                  lenderProfile: {
                    is: {
                      industries: {
                        contains: q.trim(),
                        mode: "insensitive",
                      },
                    },
                  },
                },
              ],
            }
          : {};

        const where = {
          type: "LENDER",
          status: "ACTIVE",
          isDeleted: { not: true },

          lenderProfile: {
            isVisible: true,
            ...(loanProduct && {
              loanTypes: { has: loanProduct },
            }),
            ...(state && {
              statesSupported: {
                contains: state,
                mode: "insensitive",
              },
            }),
            ...(Number.isFinite(fundingMax) &&
              fundingMax > 0 && {
                fundingSpeedDays: { lte: fundingMax },
              }),
            ...(Number.isFinite(minAmount) &&
              minAmount > 0 && {
                maxFunding: { gte: minAmount },
              }),
            ...(Number.isFinite(maxAmount) &&
              maxAmount > 0 && {
                minFunding: { lte: maxAmount },
              }),
            ...(industry && {
              industries: {
                contains: industry,
                mode: "insensitive",
              },
            }),
            ...(eligibleOnly && {
              profileStatus: "COMPLETED",
            }),
          },

          ...(connectedLenderIds.length && {
            id: { notIn: connectedLenderIds },
          }),

          ...searchFilter,
        };

        /* ===============================
           5. QUERY
        =============================== */
        const [lenders, total] = await Promise.all([
          prisma.organization.findMany({
            where,
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              createdAt: true,

              //  lender discovery profile
              lenderProfile: {
                select: {
                  summary: true,
                  loanTypes: true,
                  minFunding: true,
                  maxFunding: true,
                  statesSupported: true,
                  industries: true,
                  fundingSpeedDays: true,
                  profileStatus: true,
                },
              },

              // admin profile image + brand logo
              lenderBrandingSettings: {
                select: {
                  logoUrl: true,
                  brandName: true,
                },
              },
              users: {
                select: {
                  profileImage: true,
                },
                take: 1,
              },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          }),
          prisma.organization.count({ where }),
        ]);

        /* ===============================
           6. RESPONSE
        =============================== */
        return reply.send({
          success: true,
          meta: { page, limit, total },
          data: lenders.map(l => ({
            id: l.id,
            name: l.name,
            email: l.email
              ? l.email.replace(/(.{2}).+(@.+)/, "$1***$2")
              : null,
            phone: l.phone,

            brandLogoUrl: l.lenderBrandingSettings?.logoUrl || null,
            brandName: l.lenderBrandingSettings?.brandName || null,
            profileImage: l.users[0]?.profileImage || null,

            //  lender discovery info
            lenderProfile: l.lenderProfile
              ? {
                  summary: l.lenderProfile.summary,
                  loanTypes: l.lenderProfile.loanTypes,
                  minFunding: l.lenderProfile.minFunding,
                  maxFunding: l.lenderProfile.maxFunding,
                  statesSupported: l.lenderProfile.statesSupported,
                  industries: l.lenderProfile.industries,
                  fundingSpeedDays: l.lenderProfile.fundingSpeedDays,
                  profileStatus: l.lenderProfile.profileStatus,
                }
              : null,

            status: "NOT_CONNECTED",
          })),
        });
      } catch (error) {
        req.log.error(error);
        return reply.status(500).send({
          success: false,
          message: "Server error while searching lenders",
        });
      }
    }
  );
}

module.exports = findBrokerLendersRoutes;
