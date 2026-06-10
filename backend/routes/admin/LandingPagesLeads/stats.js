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

      bookDemoTotal,
      bookDemoNew,
      bookDemoConverted,
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

      // Loan AI Book Demo
      prisma.loanAiBookDemoLead.count(),
      prisma.loanAiBookDemoLead.count({ where: { status: "NEW" } }),
      prisma.loanAiBookDemoLead.count({ where: { status: "CONVERTED" } }),
    ]);

    const totalLeads =
      clmTotal + landingTotal + adminTotal + bookDemoTotal;

    const newLeads =
      clmNew + landingNew + adminNew + bookDemoNew;

    const convertedLeads =
      clmConverted + landingConverted + adminConverted + bookDemoConverted;

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
          loanAiBookDemo: {
            total: bookDemoTotal,
            new: bookDemoNew,
            converted: bookDemoConverted,
          },
        },
      },
    });
  });
};