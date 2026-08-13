/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function createCustomDocumentTypeRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Lender -> Document Config"],
        summary: "Create lender custom document type (optionally product-linked)",
        body: {
          type: "object",
          required: ["name"],
          additionalProperties: false,
          properties: {
            name: { type: "string", minLength: 2, maxLength: 120 },
            description: { type: "string", maxLength: 500 },
            loanProductId: { type: "string", format: "uuid" },
            loanProductCode: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
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
        const name = String(req.body?.name || "").trim();
        const description = String(req.body?.description || "").trim();
        const loanProductId =
          typeof req.body?.loanProductId === "string"
            ? req.body.loanProductId.trim()
            : "";
        const loanProductCode =
          typeof req.body?.loanProductCode === "string"
            ? req.body.loanProductCode.trim()
            : "";

        if (name.length < 2) {
          return reply.code(400).send({
            success: false,
            message: "Document name must be at least 2 characters",
          });
        }

        let loanProduct = null;
        if (loanProductId || loanProductCode) {
          loanProduct = await prisma.loanProduct.findFirst({
            where: {
              ...(loanProductId ? { id: loanProductId } : {}),
              ...(loanProductCode && !loanProductId
                ? { code: loanProductCode }
                : {}),
            },
            select: { id: true, code: true, name: true },
          });

          if (!loanProduct) {
            return reply.code(404).send({
              success: false,
              message: "Loan product not found",
            });
          }
        }

        let documentType = await prisma.documentType.findFirst({
          where: {
            isActive: true,
            isCustom: true,
            createdByOrgId: lenderOrgId,
            name: {
              equals: name,
              mode: "insensitive",
            },
          },
        });

        let createdNew = false;
        if (!documentType) {
          documentType = await prisma.documentType.create({
            data: {
              name,
              description: description || null,
              isCustom: true,
              createdByOrgId: lenderOrgId,
              isActive: true,
            },
          });
          createdNew = true;
        }

        let requirement = null;
        let lenderRequirement = null;
        if (loanProduct) {
          requirement = await prisma.productDocumentRequirement.findFirst({
            where: {
              documentTypeId: documentType.id,
              OR: [
                { loanProductId: loanProduct.id },
                { loanProductCode: loanProduct.code },
              ],
            },
          });

          if (!requirement) {
            requirement = await prisma.productDocumentRequirement.create({
              data: {
                loanProductId: loanProduct.id,
                loanProductCode: loanProduct.code,
                documentTypeId: documentType.id,
                isRequired: true,
              },
            });
          }

          // Keep custom docs private to this lender via lender product config.
          const lenderProduct = await prisma.lenderProduct.findFirst({
            where: {
              lenderOrgId,
              isActive: true,
              OR: [
                { loanProductId: loanProduct.id },
                { loanProductCode: loanProduct.code },
              ],
            },
            select: { id: true },
          });

          if (lenderProduct) {
            lenderRequirement =
              await prisma.lenderDocumentRequirement.findUnique({
                where: {
                  lenderProductId_documentTypeId: {
                    lenderProductId: lenderProduct.id,
                    documentTypeId: documentType.id,
                  },
                },
              });

            if (!lenderRequirement) {
              lenderRequirement =
                await prisma.lenderDocumentRequirement.create({
                  data: {
                    lenderProductId: lenderProduct.id,
                    documentTypeId: documentType.id,
                    isRequired: true,
                  },
                });
            }
          }
        }

        return reply.code(createdNew ? 201 : 200).send({
          success: true,
          message: createdNew
            ? "Custom document created"
            : "Custom document already exists",
          data: {
            ...documentType,
            loanProductId: loanProduct?.id || null,
            loanProductCode: loanProduct?.code || null,
            requirementId: requirement?.id || null,
            lenderRequirementId: lenderRequirement?.id || null,
          },
        });
      } catch (error) {
        fastify.log.error(
          { error: error.message, stack: error.stack },
          "Create custom document type failed",
        );
        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    },
  );
}

module.exports = createCustomDocumentTypeRoutes;
