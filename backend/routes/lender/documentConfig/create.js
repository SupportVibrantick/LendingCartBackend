const {
  createLenderDocumentConfigSchema,
} = require("../../../schemas/lender/documentConfig/create.schema");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function createLenderDocumentConfigRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Lender -> Document Config"],
        summary: "Create or update document config (UPSERT)",
        consumes: ["application/json"],
        body: {
          type: "object",
          required: ["lenderProductId"],
          additionalProperties: false,
          properties: {
            lenderProductId: { type: "string", format: "uuid" },
            documentTypeId: { type: "string", format: "uuid" },
            customDocumentName: { type: "string", minLength: 2, maxLength: 120 },
            isRequired: { type: "boolean" },
            minFiles: { type: "number" },
            maxFiles: { type: "number" },
            notes: { type: "string" },
            sortOrder: { type: "number" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ================= AUTH ================= */
        if (
          !req.user ||
          req.user.orgType !== "LENDER" ||
          !req.user.organizationId
        ) {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;

        /* ================= VALIDATION ================= */
        const parsed =
          createLenderDocumentConfigSchema.safeParse(req.body);

        if (!parsed.success) {
          return reply.code(400).send({
            success: false,
            message: "Invalid input",
            details: parsed.error.issues,
          });
        }

        const {
          lenderProductId,
          documentTypeId: inputDocumentTypeId,
          customDocumentName,
          isRequired,
          minFiles,
          maxFiles,
          notes,
          sortOrder,
        } = parsed.data;

        /* ================= VALIDATE PRODUCT ================= */
        const lenderProduct = await prisma.lenderProduct.findFirst({
          where: {
            id: lenderProductId,
            lenderOrgId,
          },
        });

        if (!lenderProduct) {
          return reply.code(404).send({
            success: false,
            message: "Lender product not found",
          });
        }

        /* ================= VALIDATE DOCUMENT ================= */
        let resolvedDocumentTypeId = inputDocumentTypeId;
        let docType = null;

        if (resolvedDocumentTypeId) {
          // Only shared (non-custom) docs or this lender's own custom docs
          docType = await prisma.documentType.findFirst({
            where: {
              id: resolvedDocumentTypeId,
              isActive: true,
              OR: [
                { isCustom: false },
                {
                  isCustom: true,
                  createdByOrgId: lenderOrgId,
                },
              ],
            },
          });
        } else {
          const normalizedName = String(customDocumentName || "").trim();
          const existingCustomType = await prisma.documentType.findFirst({
            where: {
              isActive: true,
              isCustom: true,
              createdByOrgId: lenderOrgId,
              name: {
                equals: normalizedName,
                mode: "insensitive",
              },
            },
          });

          if (existingCustomType) {
            docType = existingCustomType;
          } else {
            docType = await prisma.documentType.create({
              data: {
                name: normalizedName,
                isCustom: true,
                createdByOrgId: lenderOrgId,
                isActive: true,
              },
            });
          }
          resolvedDocumentTypeId = docType.id;
        }

        if (!docType) {
          return reply.code(404).send({
            success: false,
            message:
              "Document type not found or not accessible for your organization",
          });
        }

        /* ================= LINK CUSTOM DOC TO CATALOG PRODUCT ================= */
        if (
          docType.isCustom &&
          (lenderProduct.loanProductId || lenderProduct.loanProductCode)
        ) {
          const existingProductLink =
            await prisma.productDocumentRequirement.findFirst({
              where: {
                documentTypeId: docType.id,
                OR: [
                  ...(lenderProduct.loanProductId
                    ? [{ loanProductId: lenderProduct.loanProductId }]
                    : []),
                  ...(lenderProduct.loanProductCode
                    ? [{ loanProductCode: lenderProduct.loanProductCode }]
                    : []),
                ],
              },
            });

          if (!existingProductLink) {
            let catalogProduct = null;
            if (lenderProduct.loanProductId) {
              catalogProduct = await prisma.loanProduct.findUnique({
                where: { id: lenderProduct.loanProductId },
                select: { id: true, code: true },
              });
            } else if (lenderProduct.loanProductCode) {
              catalogProduct = await prisma.loanProduct.findFirst({
                where: { code: lenderProduct.loanProductCode },
                select: { id: true, code: true },
              });
            }

            if (catalogProduct) {
              await prisma.productDocumentRequirement.create({
                data: {
                  loanProductId: catalogProduct.id,
                  loanProductCode: catalogProduct.code,
                  documentTypeId: docType.id,
                  isRequired: isRequired ?? true,
                },
              });
            }
          }
        }

        /* ================= UPSERT ================= */
        const result =
          await prisma.lenderDocumentRequirement.upsert({
            where: {
              lenderProductId_documentTypeId: {
                lenderProductId,
                documentTypeId: resolvedDocumentTypeId,
              },
            },
            update: {
              isRequired: isRequired ?? true,
              minFiles: minFiles ?? 1,
              maxFiles: maxFiles ?? null,
              notes: notes ?? null,
              sortOrder: sortOrder ?? null,
            },
            create: {
              lenderProductId,
              documentTypeId: resolvedDocumentTypeId,
              isRequired: isRequired ?? true,
              minFiles: minFiles ?? 1,
              maxFiles: maxFiles ?? null,
              notes: notes ?? null,
              sortOrder: sortOrder ?? null,
            },
            include: {
              documentType: {
                select: {
                  id: true,
                  name: true,
                  isCustom: true,
                },
              },
            },
          });

        /* ================= RESPONSE ================= */
        return reply.send({
          success: true,
          message: "Document config saved successfully",
          data: {
            ...result,
            documentName: result.documentType?.name || null,
            isCustom: result.documentType?.isCustom || false,
          },
        });

      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            body: req.body,
            user: req.user,
          },
          "❌ Document config upsert failed"
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );
}

module.exports = createLenderDocumentConfigRoutes;