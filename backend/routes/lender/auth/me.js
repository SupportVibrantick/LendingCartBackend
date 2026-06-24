// backend/routes/lender/auth/me.js
const {
  readExtendedLenderProfileFields,
} = require("../../../services/lenderProfileExtendedFields");

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
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        const { userId, organizationId } = request.user;

        const user = await prisma.userAccount.findUnique({
          where: { id: userId },
          include: {
            organization: {
              include: {
                lenderProfile: true, // 👈 IMPORTANT
              },
            },
            roles: {
              include: { role: true },
            },
          },
        });

        if (!user || user.organizationId !== organizationId) {
          return reply.code(404).send({
            ok: false,
            message: "User not found",
          });
        }

        const lenderProfile = user.organization?.lenderProfile || null;
        const extendedProfileFields = await readExtendedLenderProfileFields(
          user.organizationId,
        );

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
                  lendingCriteria: extendedProfileFields?.lendingCriteria ?? null,
                  lendingGuidelines:
                    extendedProfileFields?.lendingGuidelines ?? null,
                  creditRequirements:
                    extendedProfileFields?.creditRequirements ?? null,
                  propertyRequirements:
                    extendedProfileFields?.propertyRequirements ?? null,
                  website: extendedProfileFields?.website ?? null,
                  nmls: extendedProfileFields?.nmls ?? null,
                  address: extendedProfileFields?.address ?? null,
                  city: extendedProfileFields?.city ?? null,
                  state: extendedProfileFields?.state ?? null,
                  zip: extendedProfileFields?.zip ?? null,
                  lenderType: extendedProfileFields?.lenderType ?? null,
                  profileStatus: lenderProfile.profileStatus,
                  isVisible: lenderProfile.isVisible,
                  updatedAt: lenderProfile.updatedAt,
                }
              : {
                  profileStatus: "DRAFT",
                  isVisible: false,
                  lendingCriteria: extendedProfileFields.lendingCriteria,
                  lendingGuidelines: extendedProfileFields.lendingGuidelines,
                  creditRequirements: extendedProfileFields.creditRequirements,
                  propertyRequirements: extendedProfileFields.propertyRequirements,
                  website: extendedProfileFields.website,
                  nmls: extendedProfileFields.nmls,
                  address: extendedProfileFields.address,
                  city: extendedProfileFields.city,
                  state: extendedProfileFields.state,
                  zip: extendedProfileFields.zip,
                  lenderType: extendedProfileFields.lenderType,
                },
          },
        });
      } catch (err) {
        request.log.error(err);
        return reply.code(500).send({
          ok: false,
          message: "Failed to fetch user profile",
        });
      }
    }
  );
}

module.exports = lenderMeRoutes;
