module.exports = async function addTemplateProduct(fastify) {
  fastify.post("/", async (req, reply) => {
    const { templateId } = req.params;
    const { loanProductCode, loanProductCodes } = req.body;

    // Normalize input → always an array
    let codes = [];

    if (Array.isArray(loanProductCodes) && loanProductCodes.length > 0) {
      codes = loanProductCodes;
    } else if (typeof loanProductCode === "string") {
      codes = [loanProductCode];
    }

    if (codes.length === 0) {
      return reply.code(400).send({
        success: false,
        message:
          "Provide either loanProductCode (string) or loanProductCodes (non-empty array)",
      });
    }

    // Prepare bulk insert
    const data = codes.map((code) => ({
      applicationTemplateId: templateId,
      loanProductCode: code,
    }));

    // Insert (bulk-safe)
    const result = await fastify.prisma.applicationTemplateProduct.createMany({
      data,
      skipDuplicates: true,
    });

    return reply.send({
      success: true,
      insertedCount: result.count,
    });
  });
};
