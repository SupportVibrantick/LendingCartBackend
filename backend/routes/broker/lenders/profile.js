/**
 * @param {import("fastify").FastifyInstance} fastify
 */
const {
  mapLenderDocumentRequirements,
} = require("../../../utils/lender/syncLenderProductDocuments");

async function lenderProfileRoutes(fastify) {
  fastify.get(
    "/:lenderOrgId/profile",
    {
      preHandler: fastify.authenticate,
      schema: {
        tags: ["Broker -> Lenders"],
        summary: "Get lender marketplace profile",
        params: {
          type: "object",
          required: ["lenderOrgId"],
          properties: {
            lenderOrgId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { lenderOrgId } = req.params;

      if (!req.user?.organizationId) {
        return reply.code(403).send({
          success: false,
          message: "Unauthorized",
        });
      }

      const lender = await prisma.organization.findFirst({
        where: {
          id: lenderOrgId,
          type: "LENDER",
          status: "ACTIVE",
          isDeleted: { not: true },
          lenderProfile: {
            isVisible: true,
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
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
              lendingCriteria: true,
              lendingGuidelines: true,
              creditRequirements: true,
              propertyRequirements: true,
              website: true,
              nmls: true,
              address: true,
              city: true,
              state: true,
              zip: true,
              lenderType: true,
            },
          },
          lenderBrandingSettings: {
            select: {
              logoUrl: true,
              brandName: true,
            },
          },
          users: {
            select: { profileImage: true },
            take: 1,
          },
          lenderProducts: {
            where: { isActive: true },
            include: {
              loanProduct: {
                select: { name: true },
              },
              lenderDocumentRequirements: {
                include: {
                  documentType: {
                    select: {
                      id: true,
                      name: true,
                      code: true,
                      isCustom: true,
                    },
                  },
                },
                orderBy: { sortOrder: "asc" },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!lender || !lender.lenderProfile) {
        return reply.code(404).send({
          success: false,
          message: "Lender profile not found",
        });
      }

      const p = lender.lenderProfile;
      const activeProducts = (lender.lenderProducts || []).map((product) => {
        const documents = mapLenderDocumentRequirements(
          product.lenderDocumentRequirements,
        );

        return {
          id: product.id,
          loanProductCode: product.loanProductCode,
          loanProductName: product.loanProduct?.name || product.loanProductCode,
          minLoanAmount:
            product.minLoanAmount?.toString?.() ?? product.minLoanAmount,
          maxLoanAmount:
            product.maxLoanAmount?.toString?.() ?? product.maxLoanAmount,
          minCreditScore: product.minCreditScore ?? null,
          minDscr: product.minDscr?.toString?.() ?? product.minDscr ?? null,
          interestRateRange: product.interestRateRange ?? null,
          statesSupported: product.statesSupported ?? null,
          termRange:
            product.minTermMonths && product.maxTermMonths
              ? `${product.minTermMonths}–${product.maxTermMonths} months`
              : null,
          documents: documents.map((doc) => ({
            id: doc.documentTypeId || doc.id,
            name: doc.documentName || doc.name,
            code: doc.documentCode,
            isRequired: doc.isRequired ?? true,
          })),
        };
      });

      return reply.send({
        success: true,
        data: {
          id: lender.id,
          name: lender.name,
          email: lender.email
            ? lender.email.replace(/(.{2}).+(@.+)/, "$1***$2")
            : null,
          phone: lender.phone,
          brandLogoUrl: lender.lenderBrandingSettings?.logoUrl || null,
          brandName: lender.lenderBrandingSettings?.brandName || null,
          profileImage: lender.users[0]?.profileImage || null,
          products: activeProducts,
          profile: {
            summary: p.summary,
            loanTypes: p.loanTypes,
            minFunding: p.minFunding,
            maxFunding: p.maxFunding,
            statesSupported: p.statesSupported,
            industries: p.industries,
            fundingSpeedDays: p.fundingSpeedDays,
            profileStatus: p.profileStatus,
            lendingCriteria: p.lendingCriteria,
            lendingGuidelines: p.lendingGuidelines,
            creditRequirements: p.creditRequirements,
            propertyRequirements: p.propertyRequirements,
            website: p.website,
            nmls: p.nmls,
            address: p.address,
            city: p.city,
            state: p.state,
            zip: p.zip,
            lenderType: p.lenderType,
          },
        },
      });
    }
  );
}

module.exports = lenderProfileRoutes;
