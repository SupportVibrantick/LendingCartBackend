module.exports = async function (fastify) {
  fastify.get("/", async (req, reply) => {
    const prisma = fastify.prisma;

    const [
      clmTotal,
      clmNew,
      clmConverted,

      landingTotal,
      landingNew,
      landingConverted,

      adminTotal,
      adminNew,
      adminConverted,
    ] = await Promise.all([
      // Commercial Lending Mastery
      prisma.commercialLendingMasteryLead.count(),
      prisma.commercialLendingMasteryLead.count({ where: { status: "NEW" } }),
      prisma.commercialLendingMasteryLead.count({ where: { status: "CONVERTED" } }),

      // CLM Landing Page
      prisma.clmLandingPageLead.count(),
      prisma.clmLandingPageLead.count({ where: { status: "NEW" } }),
      prisma.clmLandingPageLead.count({ where: { status: "CONVERTED" } }),

      // Admin Manual
      prisma.adminManualLead.count(),
      prisma.adminManualLead.count({ where: { status: "NEW" } }),
      prisma.adminManualLead.count({ where: { status: "CONVERTED" } }),
    ]);

    const totalLeads =
      clmTotal + landingTotal + adminTotal;

    const newLeads =
      clmNew + landingNew + adminNew;

    const convertedLeads =
      clmConverted + landingConverted + adminConverted;

    return reply.send({
      success: true,
      data: {
        totalLeads,
        newLeads,
        convertedLeads,
        breakdown: {
          commercialLendingMastery: {
            total: clmTotal,
            new: clmNew,
            converted: clmConverted,
          },
          clmLandingPage: {
            total: landingTotal,
            new: landingNew,
            converted: landingConverted,
          },
          adminManual: {
            total: adminTotal,
            new: adminNew,
            converted: adminConverted,
          },
        },
      },
    });
  });
};