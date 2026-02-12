async function getAdminApplicationDetails(fastify) {
  fastify.get("/:applicationId", async (req, reply) => {
    const prisma = fastify.prisma;
    const { applicationId } = req.params;

    const application = await prisma.loanApplication.findUnique({
      where: { id: applicationId },
      include: {
        client: true,
        brokerOrg: true,
        submissions: {
          include: {
            fields: true,
          },
        },
        financials: true,
        collaterals: true,
        documentUploads: true,
        applicationLenders: {
          include: {
            lender: true,
            lenderReviews: {
              include: {
                conditions: true,
              },
            },
          },
        },
      },
    });

    if (!application) {
      return reply.code(404).send({
        success: false,
        message: "Application not found",
      });
    }

    return reply.send({
      success: true,
      data: application,
    });
  });
}

module.exports = getAdminApplicationDetails;