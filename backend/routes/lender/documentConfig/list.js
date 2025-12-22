const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function listLenderDocumentConfigRoutes(fastify) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Lender -> Document Config"],
        summary: "List document configurations for lender products",
      },
    },
    async (req, reply) => {
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

        // ✅ Fetch document configs (CORRECT MODEL)
        const data =
          await prisma.lenderDocumentRequirement.findMany({
            where: {
              lenderProduct: {
                lenderOrgId,
              },
            },
            include: {
              documentType: true,
              lenderProduct: {
                select: {
                  loanProductCode: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          });

        return reply.send({
          success: true,
          data,
        });
      } catch (error) {
        console.error("DOCUMENT CONFIG LIST ERROR:", error);

        return reply.status(500).send({
          success: false,
          message: "Server error while fetching document configs",
        });
      }
    }
  );
}

module.exports = listLenderDocumentConfigRoutes;
