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
                  builderField: {
                    select: {
                      fieldKey: true,
                      label: true,
                      fieldType: true,
                      sortOrder: true,
                      section: {
                        select: {
                          id: true,
                          name: true,
                          sortOrder: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          financials: true,
          collaterals: true,
          documentUploads: {
            orderBy: { uploadedAt: "desc" },
            select: {
              id: true,
              fileName: true,
              fileUrl: true,
              fileMimeType: true,
              uploadedAt: true,
              isSignedOutput: true,
            },
          },
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
                select: { reviewStatus: true },
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

      let amountRequested =
        application.amountRequested != null
          ? Number(application.amountRequested)
          : null;
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
        if (amountRequested == null && amountRaw) {
          amountRequested =
            Number(String(amountRaw).replace(/[,$]/g, "")) || null;
        }

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
              : application.termMonthsRequested != null
                ? String(application.termMonthsRequested)
                : null;

      const lenders = (application.applicationLenders || []).map((al) => ({
        lenderOrgId: al.lenderOrgId,
        lenderName: al.lender?.name,
        lenderProduct: al.lenderProduct?.loanProductCode,
        lenderStatus: al.status,
        sentAt: al.sentAt,
        decision: al.lenderReviews?.[0]?.reviewStatus || null,
      }));

      const mappedSubmissions = (application.submissions || []).map((submission) => {
        const fields = (submission.fields || []).map((field) => {
          const fieldKey =
            field.builderField?.fieldKey || field.fieldKey || null;
          return {
            id: field.id,
            fieldKey,
            label: field.builderField?.label || null,
            fieldType: field.builderField?.fieldType || null,
            sortOrder: field.builderField?.sortOrder ?? null,
            value: field.value,
            sectionId: field.builderField?.section?.id || null,
            sectionName: field.builderField?.section?.name || null,
            sectionSortOrder: field.builderField?.section?.sortOrder ?? null,
          };
        });

        return {
          id: submission.id,
          createdAt: submission.createdAt,
          fields,
        };
      });

      // Avoid spreading raw Prisma Decimals / nested graph into the response.
      const {
        amountRequested: _dbAmount,
        applicationLenders: _applicationLenders,
        financials,
        collaterals,
        documentUploads,
        submissions: _submissions,
        client,
        brokerOrg,
        ...applicationRest
      } = application;

      return reply.send({
        success: true,
        data: {
          ...applicationRest,
          amountRequested,
          borrowerName,
          entityLabel,
          entityType,
          purpose,
          minTermMonths,
          maxTermMonths,
          termMonthsRequested,
          lenders,
          client,
          brokerOrg,
          submissions: mappedSubmissions,
          financials: financials
            ? {
                ...financials,
                annualRevenue:
                  financials.annualRevenue != null
                    ? Number(financials.annualRevenue)
                    : null,
                netIncome:
                  financials.netIncome != null
                    ? Number(financials.netIncome)
                    : null,
                ebitda:
                  financials.ebitda != null ? Number(financials.ebitda) : null,
                totalDebt:
                  financials.totalDebt != null
                    ? Number(financials.totalDebt)
                    : null,
                dscr: financials.dscr != null ? Number(financials.dscr) : null,
              }
            : null,
          collaterals: (collaterals || []).map((c) => ({
            ...c,
            valueEstimated:
              c.valueEstimated != null ? Number(c.valueEstimated) : null,
          })),
          documentUploads,
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