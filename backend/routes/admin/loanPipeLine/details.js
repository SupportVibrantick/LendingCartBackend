const {
  resolveClientDisplayNameFromData,
  resolveClientEntityLabelFromData,
} = require("../../../services/messaging/resolveClientDisplayName");

function submissionFieldValue(fields, ...keys) {
  for (const field of fields || []) {
    const key = field.builderField?.fieldKey || field.fieldKey;
    if (!keys.includes(key)) continue;

    const raw = field.value;
    if (raw == null || raw === "") continue;

    if (typeof raw === "string") return raw.trim();
    if (typeof raw === "number") return String(raw);
    if (typeof raw === "object" && raw !== null) {
      if (typeof raw.value === "string" || typeof raw.value === "number") {
        return String(raw.value).trim();
      }
      return String(raw).trim();
    }

    return String(raw).trim();
  }

  return null;
}

async function getAdminApplicationDetails(fastify) {
  fastify.get("/:applicationId", async (req, reply) => {
    try {
      const prisma = fastify.prisma;
      const { applicationId } = req.params;

      const application = await prisma.loanApplication.findUnique({
        where: { id: applicationId },
        include: {
          client: {
            include: {
              contacts: {
                orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
              },
            },
          },
          brokerOrg: true,
          submissions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              createdAt: true,
              fields: {
                select: {
                  id: true,
                  value: true,
                  fieldKey: true,
                  builderField: { select: { fieldKey: true } },
                },
              },
            },
          },
          financials: true,
          collaterals: true,
          documentUploads: true,
          applicationLenders: {
            select: {
              id: true,
              lenderOrgId: true,
              status: true,
              sentAt: true,
              lender: { select: { name: true } },
              lenderProduct: { select: { loanProductCode: true } },
              lenderReviews: {
                orderBy: { createdAt: "desc" },
                select: { decision: true },
                take: 1,
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

      let purpose = application.purpose || null;
      let entityType = application.client?.entityType || null;

      if (application.submissions?.length) {
        const fields = application.submissions[0].fields || [];

        const amountRaw = submissionFieldValue(
          fields,
          "amountRequested",
          "loanAmount",
          "requestedAmount",
          "loan_amount",
        );
        amountRequested = amountRaw
          ? Number(String(amountRaw).replace(/[,$]/g, "")) || null
          : null;

        minTermMonths = Number(submissionFieldValue(fields, "minTermMonths")) || null;
        maxTermMonths = Number(submissionFieldValue(fields, "maxTermMonths")) || null;

        const termYears = Number(submissionFieldValue(fields, "requested_term_years"));
        if (!maxTermMonths && termYears) {
          maxTermMonths = termYears * 12;
        }

        purpose =
          purpose ||
          submissionFieldValue(fields, "purpose", "loanPurpose", "useOfFunds");

        entityType =
          submissionFieldValue(
            fields,
            "entityType",
            "borrowerEntityType",
            "businessEntityType",
          ) || entityType;
      }

      const borrowerName = resolveClientDisplayNameFromData(
        application.client,
        application.submissions,
      );
      const entityLabel = resolveClientEntityLabelFromData(
        application.client,
        application.submissions,
      );

      const termMonthsRequested =
        minTermMonths && maxTermMonths
          ? `${minTermMonths}–${maxTermMonths}`
          : maxTermMonths
            ? String(maxTermMonths)
            : minTermMonths
              ? String(minTermMonths)
              : null;

      const lenders = (application.applicationLenders || []).map((al) => ({
        lenderOrgId: al.lenderOrgId,
        lenderName: al.lender?.name,
        lenderProduct: al.lenderProduct?.loanProductCode,
        lenderStatus: al.status,
        sentAt: al.sentAt,
        decision: al.lenderReviews?.[0]?.decision || null,
      }));

      return reply.send({
        success: true,
        data: {
          ...application,
          borrowerName,
          entityLabel,
          entityType,
          purpose,
          amountRequested,
          minTermMonths,
          maxTermMonths,
          termMonthsRequested,
          lenders,
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