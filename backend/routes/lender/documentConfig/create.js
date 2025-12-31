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
        summary: "Configure document for loan product",
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
        // 🔐 Auth check
        if (
          !req.user ||
          req.user.orgType !== "LENDER" ||
          !req.user.organizationId
        ) {
          return reply.status(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const lenderOrgId = req.user.organizationId;

        // ✅ Zod validation
        const parsed =
          createLenderDocumentConfigSchema.safeParse(req.body);
        if (!parsed.success) {
          return reply.status(400).send({
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

        // ✅ Validate lender product ownership (CORRECT FIELD)
        const lenderProduct = await prisma.lenderProduct.findFirst({
          where: {
            id: lenderProductId,
            lenderOrgId: lenderOrgId,
          },
        });

        if (!lenderProduct) {
          return reply.status(404).send({
            success: false,
            message: "Lender product not found",
          });
        }

        //  Validate document type
        const docType = await prisma.documentType.findFirst({
          where: { id: documentTypeId, isActive: true },
        });

        if (!docType) {
          return reply.status(404).send({
            success: false,
            message: "Document type not found",
          });
        }

        //  Prevent duplicates
        const exists = await prisma.lenderDocumentRequirement.findFirst({
          where: {
            lenderProductId,
            documentTypeId,
          },
        });

        if (exists) {
          return reply.status(409).send({
            success: false,
            message: "Document already configured for this product",
          });
        }

        // Create document requirement (CORRECT MODEL)
        const result = await prisma.lenderDocumentRequirement.create({
          data: {
            lenderProductId,
            documentTypeId,
            isRequired: isRequired ?? true,
            minFiles: minFiles ?? 1,
            maxFiles: maxFiles ?? null,
            notes: notes ?? null,
            sortOrder: sortOrder ?? null,
          },
        });

        return reply.status(201).send({
          success: true,
          message: "Document configured successfully",
          data: result,
        });
      } catch (error) {
        console.error("DOCUMENT CONFIG ERROR:", error);

        return reply.status(500).send({
          success: false,
          message: "Server error while configuring document",
        });
      }
    }
  );
}

module.exports = createLenderDocumentConfigRoutes;
