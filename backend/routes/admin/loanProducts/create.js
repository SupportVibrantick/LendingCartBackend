const { adminLogs } = require("../../../services/logger/contextLogger.js");
const { createLoanProductSchema } = require("../../../schemas/admin/loanProducts/create.schema.js");
const { LoanProductCode } = require("@prisma/client"); // 👈 IMPORTANT

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function createLoanProduct(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Admin -> Loan Products"],
        summary: "Create new Loan Product",
        description: "Super Admin can create loan products globally",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const validation = createLoanProductSchema.safeParse(req.body);
        if (!validation.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
            details: validation.error,
          });
        }

        const { code, name, description } = validation.data;

        // ✅ Convert string → enum
        const enumCode = LoanProductCode[code];

        if (!enumCode) {
          return reply.status(400).send({
            success: false,
            message: "Invalid loan product code",
          });
        }

        const exists = await prisma.loanProduct.findFirst({
          where: { code: enumCode },
        });

        if (exists) {
          return reply.status(409).send({
            success: false,
            message: "Loan product already exists",
          });
        }

        const product = await prisma.loanProduct.create({
          data: {
            code: enumCode,
            name,
            description,
          },
        });

        adminLogs.info("Loan product created", { productId: product.id });

        return reply.status(201).send({
          success: true,
          message: "Loan product created",
          data: product,
        });
      } catch (error) {
        adminLogs.error("Loan product creation failed", error);
        return reply.status(500).send({
          success: false,
          message: "Server Error",
        });
      }
    }
  );
}

module.exports = createLoanProduct;