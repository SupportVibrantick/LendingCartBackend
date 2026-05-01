/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function getLenderDocumentConfigRoutes(fastify) {
  fastify.get(
    "/:lenderProductId",
    {
      schema: {
        tags: ["Lender -> Document Config"],
        summary: "Get document config for a lender product",
        params: {
          type: "object",
          required: ["lenderProductId"],
          properties: {
            lenderProductId: { type: "string", format: "uuid" },
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
        const { lenderProductId } = req.params;

        /* ================= VALIDATE OWNERSHIP ================= */
        const lenderProduct = await prisma.lenderProduct.findFirst({
          where: {
            id: lenderProductId,
            lenderOrgId,
          },
          select: { id: true },
        });

        if (!lenderProduct) {
          return reply.code(404).send({
            success: false,
            message: "Lender product not found",
          });
        }

        /* ================= FETCH CONFIG ================= */
        const docs = await prisma.lenderDocumentRequirement.findMany({
          where: {
            lenderProductId,
          },
          include: {
            documentType: {
              select: {
                id: true,
                name: true,
                code: true,
                isCustom: true,
                description: true,
              },
            },
          },
          orderBy: [
            { sortOrder: "asc" },
            { createdAt: "asc" },
          ],
        });

        /* ================= FORMAT RESPONSE ================= */
        const formatted = docs.map((doc) => ({
          id: doc.id,

          documentTypeId: doc.documentTypeId,
          documentName: doc.documentType?.name || null,
          documentCode: doc.documentType?.code || null,
          isCustom: doc.documentType?.isCustom || false,
          description: doc.documentType?.description || null,

          isRequired: doc.isRequired,
          minFiles: doc.minFiles,
          maxFiles: doc.maxFiles,
          notes: doc.notes,
          sortOrder: doc.sortOrder,

          createdAt: doc.createdAt,
        }));

        return reply.send({
          success: true,
          count: formatted.length,
          data: formatted,
        });

      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            lenderProductId: req.params.lenderProductId,
            user: req.user,
          },
          "❌ Fetch lender document config failed"
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );
}

module.exports = getLenderDocumentConfigRoutes;