const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { adminLogs } = require("../../../services/logger/contextLogger");

// Zod schema
const {
  createDocumentTypeSchema,
} = require("../../../schemas/admin/documentTypes/create.schema");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function createDocumentTypeRoutes(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Admin -> Document Types"],
        summary: "Create Document Type (Master)",
        description:
          "Super Admin creates global document types used across loan products and lenders",
        body: { type: "object" },
      },
    },
    async (request, reply) => {
      try {
        // ---------------------------
        // Validate request body
        // ---------------------------
        const parsed = createDocumentTypeSchema.safeParse(request.body);

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input data",
            details: parsed.error.issues,
          });
        }

        const { name, code, description, isActive } = parsed.data;

        // ---------------------------
        // Check duplicate (code)
        // ---------------------------
        const existing = await prisma.documentType.findFirst({
          where: {
            code,
          },
        });

        if (existing) {
          return reply.status(409).send({
            success: false,
            message: "Document type with this code already exists",
          });
        }

        // ---------------------------
        // Create document type
        // ---------------------------
        const documentType = await prisma.documentType.create({
          data: {
            name,
            code,
            description: description ?? null,
            isActive: isActive ?? true,
          },
        });

        adminLogs.info("Document type created", {
          documentTypeId: documentType.id,
          code: documentType.code,
        });

        return reply.status(201).send({
          success: true,
          message: "Document type created successfully",
          data: documentType,
        });
      } catch (error) {
        adminLogs.error("DocumentType create failed", error);

        return reply.status(500).send({
          success: false,
          message: "Server error while creating document type",
        });
      }
    }
  );
}

module.exports = createDocumentTypeRoutes;
