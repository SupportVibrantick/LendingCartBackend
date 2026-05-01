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
          required: ["lenderProductId", "documentTypeId"],
          additionalProperties: false,
          properties: {
            lenderProductId: { type: "string", format: "uuid" },
            documentTypeId: { type: "string", format: "uuid" },
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
          documentTypeId,
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
        const docType = await prisma.documentType.findFirst({
          where: {
            id: documentTypeId,
            isActive: true,
          },
        });

        if (!docType) {
          return reply.code(404).send({
            success: false,
            message: "Document type not found",
          });
        }

        /* ================= UPSERT ================= */
        const result =
          await prisma.lenderDocumentRequirement.upsert({
            where: {
              lenderProductId_documentTypeId: {
                lenderProductId,
                documentTypeId,
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
              documentTypeId,
              isRequired: isRequired ?? true,
              minFiles: minFiles ?? 1,
              maxFiles: maxFiles ?? null,
              notes: notes ?? null,
              sortOrder: sortOrder ?? null,
            },
          });

        /* ================= RESPONSE ================= */
        return reply.send({
          success: true,
          message: "Document config saved successfully",
          data: result,
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