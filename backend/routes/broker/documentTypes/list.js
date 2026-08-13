/**
 * @param {import("fastify").FastifyInstance} fastify
 */
const {
  requireLoCustomDocumentsView,
} = require("../../../services/broker/loanOfficerAccess");
const {
  mapLoanProductsFromRequirements,
  resolveLoanProductFilter,
} = require("../../../utils/documents/brokerCustomDocumentProducts");

async function listBrokerCustomDocumentTypes(fastify) {
  fastify.get(
    "/",
    {
      preHandler: async (req, reply) => {
        await requireLoCustomDocumentsView(req, reply, fastify);
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user?.organizationId || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const brokerOrgId = req.user.organizationId;
        const page = Math.max(Number(req.query.page || 1), 1);
        const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100);
        const search = String(req.query.search || "").trim();
        const loanProductId = String(req.query.loanProductId || "").trim();
        const loanProductCode = String(req.query.loanProductCode || "").trim();
        const usage = String(req.query.usage || "all").trim().toLowerCase();
        const includeInactive =
          req.query.includeInactive === true ||
          req.query.includeInactive === "true";

        if (usage && !["all", "used", "unused"].includes(usage)) {
          return reply.code(400).send({
            success: false,
            message: "usage must be all, used, or unused",
          });
        }

        let productFilter = null;
        if (loanProductId || loanProductCode) {
          const resolved = await resolveLoanProductFilter(prisma, {
            loanProductId: loanProductId || null,
            loanProductCode: loanProductCode || null,
          });
          if (!resolved?.ok) {
            return reply.code(resolved?.status || 400).send({
              success: false,
              message: resolved?.message || "Invalid loan product filter",
            });
          }
          productFilter = resolved;
        }

        const where = {
          isCustom: true,
          createdByOrgId: brokerOrgId,
          ...(includeInactive ? {} : { isActive: true }),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { description: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
          ...(productFilter
            ? {
                productRequirements: {
                  some: {
                    OR: [
                      { loanProductId: { in: productFilter.productIds } },
                      { loanProductCode: { in: productFilter.productCodes } },
                    ],
                  },
                },
              }
            : {}),
          ...(usage === "used"
            ? {
                applicationRequirements: {
                  some: {
                    loanApplication: { brokerOrgId },
                  },
                },
              }
            : {}),
          ...(usage === "unused"
            ? {
                applicationRequirements: {
                  none: {
                    loanApplication: { brokerOrgId },
                  },
                },
              }
            : {}),
        };

        const total = await prisma.documentType.count({ where });
        const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
        const resolvedPage =
          totalPages === 0 ? 1 : Math.min(page, totalPages);

        const items = await prisma.documentType.findMany({
          where,
          select: {
            id: true,
            name: true,
            description: true,
            code: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            productRequirements: {
              select: {
                loanProductId: true,
                loanProductCode: true,
                loanProduct: {
                  select: { id: true, code: true, name: true },
                },
              },
              orderBy: { loanProductCode: "asc" },
            },
          },
          orderBy: [{ isActive: "desc" }, { name: "asc" }],
          skip: (resolvedPage - 1) * limit,
          take: limit,
        });

        const typeIds = items.map((item) => item.id);
        let usageMap = new Map();

        if (typeIds.length > 0) {
          const usageGroups =
            await prisma.applicationDocumentRequirement.groupBy({
              by: ["documentTypeId"],
              where: {
                documentTypeId: { in: typeIds },
                loanApplication: { brokerOrgId },
              },
              _count: { _all: true },
            });

          usageMap = new Map(
            usageGroups.map((group) => [
              group.documentTypeId,
              group._count._all,
            ]),
          );
        }

        const data = items.map((item) => {
          const { productRequirements, ...rest } = item;
          const loanProducts =
            mapLoanProductsFromRequirements(productRequirements);
          return {
            ...rest,
            usageCount: usageMap.get(item.id) || 0,
            isProtected: item.code === "BROKER_LOI_TERM_SHEET",
            loanProducts,
            loanProductIds: loanProducts.map((p) => p.id).filter(Boolean),
          };
        });

        return reply.send({
          success: true,
          data,
          meta: {
            search: search || null,
            loanProductId: loanProductId || null,
            loanProductCode: loanProductCode || null,
            usage,
          },
          pagination: {
            page: resolvedPage,
            limit,
            total,
            totalPages,
            hasNextPage: totalPages > 0 && resolvedPage < totalPages,
            hasPreviousPage: resolvedPage > 1,
          },
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          message: error.message || "Failed to list custom documents",
        });
      }
    },
  );
}

module.exports = listBrokerCustomDocumentTypes;
