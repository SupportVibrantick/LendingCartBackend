/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function updateLenderDocumentConfigRoutes(fastify) {
  fastify.put(
    "/:id",
    {
      schema: {
        tags: ["Lender -> Document Config"],
        summary: "Update document config",
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            documentName: { type: "string", minLength: 2, maxLength: 120 },
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
        const { id } = req.params;

        /* ================= FIND CONFIG ================= */
        const existing = await prisma.lenderDocumentRequirement.findUnique({
          where: { id },
          include: {
            lenderProduct: {
              select: { lenderOrgId: true },
            },
            documentType: {
              select: {
                id: true,
                name: true,
                isCustom: true,
                createdByOrgId: true,
              },
            },
          },
        });

        if (!existing) {
          return reply.code(404).send({
            success: false,
            message: "Document config not found",
          });
        }

        /* ================= OWNERSHIP CHECK ================= */
        if (existing.lenderProduct.lenderOrgId !== lenderOrgId) {
          return reply.code(403).send({
            success: false,
            message: "You do not have access to this config",
          });
        }

        const {
          documentName,
          isRequired,
          minFiles,
          maxFiles,
          notes,
          sortOrder,
        } = req.body || {};

        let nextDocumentTypeId = existing.documentTypeId;

        /* ================= RENAME DOCUMENT (lender-private) ================= */
        if (typeof documentName === "string") {
          const normalizedName = documentName.trim();
          if (normalizedName.length < 2) {
            return reply.code(400).send({
              success: false,
              message: "Document name must be at least 2 characters",
            });
          }

          const currentType = existing.documentType;
          const nameChanged =
            normalizedName.toLowerCase() !==
            String(currentType?.name || "").toLowerCase();

          if (nameChanged) {
            const canRenameInPlace =
              currentType?.isCustom === true &&
              currentType?.createdByOrgId === lenderOrgId;

            if (canRenameInPlace) {
              await prisma.documentType.update({
                where: { id: currentType.id },
                data: { name: normalizedName },
              });
            } else {
              let targetType = await prisma.documentType.findFirst({
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

              if (!targetType) {
                targetType = await prisma.documentType.create({
                  data: {
                    name: normalizedName,
                    isCustom: true,
                    createdByOrgId: lenderOrgId,
                    isActive: true,
                  },
                });
              }

              const duplicate = await prisma.lenderDocumentRequirement.findFirst({
                where: {
                  lenderProductId: existing.lenderProductId,
                  documentTypeId: targetType.id,
                  NOT: { id },
                },
              });

              if (duplicate) {
                return reply.code(409).send({
                  success: false,
                  message:
                    "This document name is already configured for this product",
                });
              }

              nextDocumentTypeId = targetType.id;
            }
          }
        }

        /* ================= UPDATE ================= */
        const updated = await prisma.lenderDocumentRequirement.update({
          where: { id },
          data: {
            documentTypeId: nextDocumentTypeId,
            isRequired: isRequired ?? existing.isRequired,
            minFiles: minFiles ?? existing.minFiles,
            maxFiles: maxFiles ?? existing.maxFiles,
            notes: notes ?? existing.notes,
            sortOrder: sortOrder ?? existing.sortOrder,
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

        return reply.send({
          success: true,
          message: "Document config updated successfully",
          data: {
            ...updated,
            documentName: updated.documentType?.name || null,
            isCustom: updated.documentType?.isCustom || false,
          },
        });

      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            id: req.params.id,
            user: req.user,
          },
          "❌ Update document config failed"
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );
}

module.exports = updateLenderDocumentConfigRoutes;