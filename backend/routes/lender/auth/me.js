// backend/routes/lender/auth/me.js
const {
  mapExtendedFields,
} = require("../../../services/lender/lenderProfileExtendedFields");

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatProfileProductSummary(product) {
  const minLoanAmount = toNumberOrNull(product.minLoanAmount);
  const maxLoanAmount = toNumberOrNull(product.maxLoanAmount);
  const minDscr = toNumberOrNull(product.minDscr);

  return {
    id: product.id,
    isActive: product.isActive,
    code: product.loanProduct?.code || product.loanProductCode || null,
    name: product.loanProduct?.name || null,
    minLoanAmount,
    maxLoanAmount:
      maxLoanAmount && maxLoanAmount > 0 ? maxLoanAmount : null,
    minCreditScore: product.minCreditScore ?? null,
    minDscr,
    interestRateRange:
      typeof product.interestRateRange === "string"
        ? product.interestRateRange.replace(/%/g, "")
        : product.interestRateRange,
  };
}

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function lenderMeRoutes(fastify) {
  fastify.get(
    "/me",
    {
      preHandler: fastify.authenticate,
      schema: {
        tags: ["Lender -> Auth"],
        summary: "Get logged-in lender user + lender profile",
        querystring: {
          type: "object",
          properties: {
            includeProductSummary: {
              type: "boolean",
              default: false,
              description:
                "Include a lightweight active loan-product summary for profile views",
            },
          },
        },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        const { userId, organizationId } = request.user;
        const includeProductSummaryRaw = request.query?.includeProductSummary;
        const includeProductSummary =
          includeProductSummaryRaw === true ||
          includeProductSummaryRaw === "true" ||
          includeProductSummaryRaw === "1";

        const userPromise = prisma.userAccount.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            status: true,
            emailVerifiedAt: true,
            organizationId: true,
            organization: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                type: true,
                status: true,
                lenderProfile: true,
              },
            },
            roles: {
              select: {
                role: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        });

        const productsPromise = includeProductSummary
          ? prisma.lenderProduct.findMany({
              where: {
                lenderOrgId: organizationId,
                isActive: true,
              },
              select: {
                id: true,
                isActive: true,
                minLoanAmount: true,
                maxLoanAmount: true,
                minCreditScore: true,
                minDscr: true,
                interestRateRange: true,
                loanProductCode: true,
                loanProduct: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
              orderBy: {
                createdAt: "desc",
              },
              take: 100,
            })
          : Promise.resolve(null);

        const [user, products] = await Promise.all([
          userPromise,
          productsPromise,
        ]);

        if (!user || user.organizationId !== organizationId) {
          return reply.code(404).send({
            ok: false,
            message: "User not found",
          });
        }

        if (!user.emailVerifiedAt && !request.user.impersonatedBy) {
          return reply.code(403).send({
            ok: false,
            success: false,
            message: "Please verify your email before continuing",
            code: "EMAIL_NOT_VERIFIED",
            data: { email: user.email },
          });
        }

        const lenderProfile = user.organization?.lenderProfile || null;
        const extendedProfileFields = mapExtendedFields(lenderProfile || {});

        return reply.send({
          ok: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
              profileImage: user.profileImage || null,
              status: user.status,
              emailVerified: Boolean(user.emailVerifiedAt),
              roles: user.roles.map((r) => r.role.name),
            },

            organization: {
              id: user.organization.id,
              name: user.organization.name,
              email: user.organization.email,
              phone: user.organization.phone,
              type: user.organization.type,
              status: user.organization.status,
            },

            lenderProfile: lenderProfile
              ? {
                  summary: lenderProfile.summary,
                  loanTypes: lenderProfile.loanTypes,
                  minFunding: lenderProfile.minFunding,
                  maxFunding: lenderProfile.maxFunding,
                  statesSupported: lenderProfile.statesSupported,
                  industries: lenderProfile.industries,
                  fundingSpeedDays: lenderProfile.fundingSpeedDays,
                  lendingCriteria: extendedProfileFields.lendingCriteria,
                  lendingGuidelines: extendedProfileFields.lendingGuidelines,
                  creditRequirements: extendedProfileFields.creditRequirements,
                  propertyRequirements:
                    extendedProfileFields.propertyRequirements,
                  website: extendedProfileFields.website,
                  nmls: extendedProfileFields.nmls,
                  address: extendedProfileFields.address,
                  city: extendedProfileFields.city,
                  state: extendedProfileFields.state,
                  zip: extendedProfileFields.zip,
                  lenderType: extendedProfileFields.lenderType,
                  profileStatus: lenderProfile.profileStatus,
                  isVisible: lenderProfile.isVisible,
                  updatedAt: lenderProfile.updatedAt,
                }
              : {
                  profileStatus: "DRAFT",
                  isVisible: false,
                  ...extendedProfileFields,
                },

            ...(includeProductSummary
              ? {
                  loanProducts: (products || []).map(
                    formatProfileProductSummary,
                  ),
                }
              : {}),
          },
        });
      } catch (err) {
        request.log.error(err);
        return reply.code(500).send({
          ok: false,
          message: "Failed to fetch user profile",
        });
      }
    },
  );
}

module.exports = lenderMeRoutes;
