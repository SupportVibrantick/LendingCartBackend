/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function listDocumentTypesRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Admin -> Document Types"],
        summary: "List Document Types (optionally by loan product / source)",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      try {
        const {
          page = 1,
          limit = 20,
          search,
          isActive,
          loanProductId,
          source,
        } = req.query;

        const skip = (Number(page) - 1) * Number(limit);
        const productId =
          typeof loanProductId === "string" && loanProductId.trim()
            ? loanProductId.trim()
            : null;

        const sourceFilter =
          typeof source === "string" ? source.trim().toLowerCase() : "all";

        const sourceDocumentFilter =
          sourceFilter === "admin"
            ? { isCustom: false }
            : sourceFilter === "lender"
              ? { isCustom: true }
              : {};

        const documentTypeFilter = {
          ...sourceDocumentFilter,
          ...(typeof isActive !== "undefined"
            ? { isActive: isActive === "true" }
            : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { code: { contains: search, mode: "insensitive" } },
                  {
                    description: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                ],
              }
            : {}),
        };

        const enrichRows = async (rows, getFallbackProduct) => {
          const orgIds = [
            ...new Set(
              rows
                .map((row) => row.documentType?.createdByOrgId)
                .filter(Boolean),
            ),
          ];

          const orgs =
            orgIds.length > 0
              ? await prisma.organization.findMany({
                  where: { id: { in: orgIds } },
                  select: { id: true, name: true },
                })
              : [];

          const orgById = new Map(orgs.map((org) => [org.id, org]));

          return rows.map((row) => {
            const docType = row.documentType;
            const fallback =
              typeof getFallbackProduct === "function"
                ? getFallbackProduct(row)
                : getFallbackProduct || null;
            const isCustom = Boolean(docType.isCustom);
            const createdByOrg = docType.createdByOrgId
              ? orgById.get(docType.createdByOrgId)
              : null;

            return {
              id: docType.id,
              name: docType.name,
              code: docType.code,
              description: docType.description,
              isActive: docType.isActive,
              isCustom,
              source: isCustom ? "LENDER" : "ADMIN",
              createdByOrgId: docType.createdByOrgId || null,
              createdByOrgName: createdByOrg?.name || null,
              createdAt: docType.createdAt,
              updatedAt: docType.updatedAt,
              requirementId: row.id,
              isRequired: row.isRequired,
              loanProductId:
                row.loanProductId ||
                row.loanProduct?.id ||
                fallback?.id ||
                null,
              loanProductCode:
                row.loanProductCode ||
                row.loanProduct?.code ||
                fallback?.code ||
                null,
              loanProductName:
                row.loanProduct?.name || fallback?.name || null,
            };
          });
        };

        if (productId) {
          const loanProduct = await prisma.loanProduct.findUnique({
            where: { id: productId },
            select: { id: true, code: true, name: true },
          });

          if (!loanProduct) {
            return reply.status(404).send({
              success: false,
              message: "Loan product not found",
            });
          }

          const where = {
            OR: [
              { loanProductId: loanProduct.id },
              { loanProductCode: loanProduct.code },
            ],
            documentType: documentTypeFilter,
          };

          const [total, rows] = await Promise.all([
            prisma.productDocumentRequirement.count({ where }),
            prisma.productDocumentRequirement.findMany({
              where,
              skip,
              take: Number(limit),
              orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
              include: {
                documentType: true,
                loanProduct: {
                  select: { id: true, code: true, name: true },
                },
              },
            }),
          ]);

          return reply.send({
            success: true,
            data: await enrichRows(rows, loanProduct),
            meta: {
              total,
              page: Number(page),
              limit: Number(limit),
              source: sourceFilter,
              loanProductId: loanProduct.id,
              loanProductCode: loanProduct.code,
              loanProductName: loanProduct.name,
            },
          });
        }

        /* ================= ALL LOAN PROGRAMS ================= */
        const whereAll =
          Object.keys(documentTypeFilter).length > 0
            ? { documentType: documentTypeFilter }
            : {};

        const [totalAll, rowsAll, catalogProducts] = await Promise.all([
          prisma.productDocumentRequirement.count({ where: whereAll }),
          prisma.productDocumentRequirement.findMany({
            where: whereAll,
            skip,
            take: Number(limit),
            orderBy: [{ createdAt: "desc" }, { sortOrder: "asc" }],
            include: {
              documentType: true,
              loanProduct: {
                select: { id: true, code: true, name: true },
              },
            },
          }),
          prisma.loanProduct.findMany({
            select: { id: true, code: true, name: true },
          }),
        ]);

        const productById = new Map(
          catalogProducts.map((product) => [product.id, product]),
        );
        const productByCode = new Map(
          catalogProducts.map((product) => [product.code, product]),
        );

        return reply.send({
          success: true,
          data: await enrichRows(rowsAll, (row) => {
            if (row.loanProductId && productById.get(row.loanProductId)) {
              return productById.get(row.loanProductId);
            }
            if (row.loanProductCode && productByCode.get(row.loanProductCode)) {
              return productByCode.get(row.loanProductCode);
            }
            return null;
          }),
          meta: {
            total: totalAll,
            page: Number(page),
            limit: Number(limit),
            source: sourceFilter,
          },
        });
      } catch (error) {
        console.error(error);
        return reply.status(500).send({
          success: false,
          message: "Failed to fetch document types",
        });
      }
    },
  );
}

module.exports = listDocumentTypesRoutes;
