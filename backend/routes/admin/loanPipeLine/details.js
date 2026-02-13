async function getAdminApplicationDetails(fastify) {
  fastify.get("/:applicationId", async (req, reply) => {
    try {
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

      // ===============================
      // Extract Values From Submission
      // ===============================

      let amountRequested = null;
      let minTermMonths = null;
      let maxTermMonths = null;

      if (application.submissions?.length) {
        const fields = application.submissions[0].fields || [];

        const getField = (key) =>
          fields.find((f) => f.fieldKey === key)?.value;

        // Prefer dynamic value first
        amountRequested =
          Number(getField("loan_amount_requested")) ||
          Number(getField("amountRequested")) ||
          null;

        minTermMonths = Number(getField("minTermMonths")) || null;
        maxTermMonths = Number(getField("maxTermMonths")) || null;

        // If term years exists convert to months
        const termYears = Number(getField("requested_term_years"));
        if (!maxTermMonths && termYears) {
          maxTermMonths = termYears * 12;
        }
      }

      return reply.send({
        success: true,
        data: {
          ...application,
          amountRequested,
          minTermMonths,
          maxTermMonths,
        },
      });
    } catch (error) {
      req.log.error(error);

      return reply.code(500).send({
        success: false,
        message: "Something went wrong while fetching application details",
      });
    }
  });
}

module.exports = getAdminApplicationDetails;