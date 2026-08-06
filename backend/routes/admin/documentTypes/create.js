const { adminLogs } = require("../../../services/logger/contextLogger");

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
        summary: "Create Document Type for a Loan Product",
        description:
          "Creates a document type and links it to the selected loan product",
        body: { type: "object" },
      },
    },
    async (request, reply) => {
      const prisma = fastify.prisma;
      try {
        const parsed = createDocumentTypeSchema.safeParse(request.body);

        if (!parsed.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input data",
            details: parsed.error.issues,
          });
        }

        const {
          name,
          description,
          isActive,
          loanProductId,
          isRequired,
        } = parsed.data;

        const loanProduct = await prisma.loanProduct.findUnique({
          where: { id: loanProductId },
          select: { id: true, code: true, name: true, isActive: true },
        });

        if (!loanProduct) {
          return reply.status(404).send({
            success: false,
            message: "Loan product not found",
          });
        }

        const duplicateOnProduct = await prisma.productDocumentRequirement.findFirst({
          where: {
            loanProductId,
            documentType: {
              name: { equals: name.trim(), mode: "insensitive" },
            },
          },
          include: { documentType: { select: { id: true, name: true } } },
        });

        if (duplicateOnProduct) {
          return reply.status(409).send({
            success: false,
            message: `Document "${name.trim()}" is already linked to ${loanProduct.name}`,
          });
        }

        const result = await prisma.$transaction(async (tx) => {
          const documentType = await tx.documentType.create({
            data: {
              name: name.trim(),
              description: description?.trim() || null,
              isActive: isActive ?? true,
            },
          });

          const requirement = await tx.productDocumentRequirement.create({
            data: {
              loanProductId: loanProduct.id,
              loanProductCode: loanProduct.code,
              documentTypeId: documentType.id,
              isRequired: isRequired ?? true,
            },
          });

          return { documentType, requirement };
        });

        adminLogs.info("Document type created for loan product", {
          documentTypeId: result.documentType.id,
          name: result.documentType.name,
          loanProductId: loanProduct.id,
          loanProductCode: loanProduct.code,
        });

        return reply.status(201).send({
          success: true,
          message: "Document type created successfully",
          data: {
            ...result.documentType,
            requirementId: result.requirement.id,
            loanProductId: loanProduct.id,
            loanProductCode: loanProduct.code,
            loanProductName: loanProduct.name,
            isRequired: result.requirement.isRequired,
          },
        });
      } catch (error) {
        adminLogs.error("DocumentType create failed", error);

        return reply.status(500).send({
          success: false,
          message: "Server error while creating document type",
        });
      }
    },
  );
}

module.exports = createDocumentTypeRoutes;
