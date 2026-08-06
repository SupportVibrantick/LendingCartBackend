module.exports = async function listActiveDocumentTypes(fastify) {
  fastify.get(
    "/active",
    {
      schema: {
        tags: ["Common -> Document Types"],
        summary: "Get active document types (optionally by loan product)",
        querystring: {
          type: "object",
          properties: {
            page: {
              type: "integer",
              minimum: 1,
              default: 1,
            },
            limit: {
              type: "integer",
              minimum: 1,
              maximum: 100,
              default: 50,
            },
            search: {
              type: "string",
            },
            all: {
              anyOf: [{ type: "boolean" }, { type: "string" }],
              default: false,
            },
            loanProductId: {
              type: "string",
              format: "uuid",
            },
            loanProductCode: {
              type: "string",
            },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      await fastify.authenticate(req, reply);

      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 50);
      const search = req.query.search?.trim();
      const all = req.query.all === true || req.query.all === "true";
      const loanProductId =
        typeof req.query.loanProductId === "string"
          ? req.query.loanProductId.trim()
          : "";
      const loanProductCode =
        typeof req.query.loanProductCode === "string"
          ? req.query.loanProductCode.trim()
          : "";

      const orgId = req.user?.organizationId || undefined;
      const isLender = req.user?.orgType === "LENDER" && Boolean(orgId);

      let loanProduct = null;
      let productScopedIds = null;

      if (loanProductId || loanProductCode) {
        loanProduct = await prisma.loanProduct.findFirst({
          where: {
            ...(loanProductId ? { id: loanProductId } : {}),
            ...(loanProductCode && !loanProductId
              ? { code: loanProductCode }
              : {}),
          },
          select: { id: true, code: true },
        });

        if (!loanProduct) {
          return reply.status(404).send({
            success: false,
            message: "Loan product not found",
          });
        }

        const requirements = await prisma.productDocumentRequirement.findMany({
          where: {
            OR: [
              { loanProductId: loanProduct.id },
              { loanProductCode: loanProduct.code },
            ],
          },
          select: { documentTypeId: true },
        });

        productScopedIds = [
          ...new Set(requirements.map((item) => item.documentTypeId)),
        ];
      }

      const searchFilter = search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                code: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                description: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : null;

      let productScopeFilter;

      if (productScopedIds !== null && loanProduct) {
        const productOr = [];

        // Admin / shared catalog docs linked to this loan product
        if (productScopedIds.length) {
          productOr.push({
            id: { in: productScopedIds },
            isCustom: false,
          });

          // This lender's custom docs explicitly linked to this product
          if (isLender) {
            productOr.push({
              id: { in: productScopedIds },
              isCustom: true,
              createdByOrgId: orgId,
            });
          }
        }

        // Custom docs already configured on this lender's offering of the product
        if (isLender) {
          productOr.push({
            isCustom: true,
            createdByOrgId: orgId,
            lenderRequirements: {
              some: {
                lenderProduct: {
                  lenderOrgId: orgId,
                  OR: [
                    { loanProductId: loanProduct.id },
                    { loanProductCode: loanProduct.code },
                  ],
                },
              },
            },
          });
        }

        productScopeFilter =
          productOr.length > 0
            ? { OR: productOr }
            : { id: { in: [] } };
      } else if (isLender) {
        productScopeFilter = {
          OR: [
            { isCustom: false },
            {
              isCustom: true,
              createdByOrgId: orgId,
            },
          ],
        };
      } else {
        productScopeFilter = { isCustom: false };
      }

      const where = {
        isActive: true,
        AND: [productScopeFilter, ...(searchFilter ? [searchFilter] : [])],
      };

      const [docs, total] = await Promise.all([
        prisma.documentType.findMany({
          where,
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
            isCustom: true,
          },
          orderBy: [
            { isCustom: "desc" },
            { createdAt: "desc" },
            { name: "asc" },
          ],
          ...(all
            ? {}
            : {
                skip: (page - 1) * limit,
                take: limit,
              }),
        }),
        prisma.documentType.count({ where }),
      ]);

      const response = {
        success: true,
        data: docs,
      };

      if (!all) {
        response.pagination = {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
          hasNextPage: page * limit < total,
          hasPreviousPage: page > 1,
        };
      }

      return response;
    },
  );
};
