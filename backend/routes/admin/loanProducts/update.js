const { updateLoanProductSchema } = require("../../../schemas/admin/loanProducts/update.schema.js");
const { LoanProductCode } = require("@prisma/client");
const { adminLogs } = require("../../../services/logger/contextLogger.js");

async function updateLoanProduct(fastify) {
  fastify.patch(
    "/:id",
    {
      schema: {
        tags: ["Admin -> Loan Products"],
        summary: "Update loan product details",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const validation = updateLoanProductSchema.safeParse(req.body);

        if (!validation.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid input",
          });
        }

        const { code, name, description } = validation.data;

        const updateData = {};

        // ✅ ENUM Handling
        if (code) {
          const enumCode = LoanProductCode[code];

          if (!enumCode) {
            return reply.status(400).send({
              success: false,
              message: "Invalid loan product code",
            });
          }

          // ✅ Proper duplicate check for UUID
          const exists = await prisma.loanProduct.findFirst({
            where: {
              code: enumCode,
              NOT: {
                id: req.params.id, // 👈 FIXED (NO Number())
              },
            },
          });

          if (exists) {
            return reply.status(409).send({
              success: false,
              message: "Loan product with this code already exists",
            });
          }

          updateData.code = enumCode;
        }

        if (name) updateData.name = name;
        if (description !== undefined) updateData.description = description;

        const product = await prisma.loanProduct.update({
          where: { id: req.params.id }, // 👈 UUID string
          data: updateData,
        });

        adminLogs.info("Loan product updated", { productId: product.id });

        return reply.send({
          success: true,
          message: "Loan product updated successfully",
          data: product,
        });

      } catch (error) {
        adminLogs.error("Loan product update failed", error);

        return reply.status(500).send({
          success: false,
          message: "Server Error",
        });
      }
    }
  );
}

module.exports = updateLoanProduct;