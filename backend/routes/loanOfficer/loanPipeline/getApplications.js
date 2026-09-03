const { officerPreHandler, getUserId, officerAssignedApplicationWhere } = require("../../../services/broker/loanOfficerAccess");

async function getApplicationsRoute(fastify) {
  fastify.get(
    "/",
    { preHandler: officerPreHandler(fastify) },
    async (request, reply) => {
      try {
        const userId = getUserId(request);
        const orgId = request.user.organizationId;

        const page = Math.max(1, Number(request.query.page) || 1);
        const limit = Math.max(1, Number(request.query.limit) || 10);
        const search = String(request.query.search || "").trim();
        const skip = Math.max(0, (page - 1) * limit);

        const OR = [];
        if (search) {
          OR.push(
            { applicationNumber: { contains: search, mode: "insensitive" } },
            { purpose: { contains: search, mode: "insensitive" } },
            {
              client: {
                is: { legalName: { contains: search, mode: "insensitive" } },
              },
            },
          );
        }

        const where = {
          brokerOrgId: orgId,
          AND: [
            officerAssignedApplicationWhere(userId),
            ...(OR.length > 0 ? [{ OR }] : []),
          ],
        };

        const total = await prisma.loanApplication.count({ where });

        const applications = await prisma.loanApplication.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            applicationNumber: true,
            amountRequested: true,
            purpose: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            submittedAt: true,
            loanProductCode: true,
            termMonthsRequested: true,
            brokerUser: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                profileImage: true,
              },
            },
            client: {
              select: {
                id: true,
                legalName: true,
                entityType: true,
                industry: true,
              },
            },
            submissions: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                status: true,
                createdAt: true,
                fields: { select: { fieldKey: true, value: true } },
              },
            },
            applicationLenders: {
              select: {
                id: true,
                lenderOrgId: true,
                status: true,
                sentAt: true,
                lender: { select: { id: true, name: true } },
              },
            },
          },
        });

        const formatted = applications.map((item) => {
          const latestSubmission = item.submissions?.[0];
          const fieldsMap = {};
          latestSubmission?.fields?.forEach((field) => {
            fieldsMap[field.fieldKey] = field.value;
          });

          return {
            submissionId: latestSubmission?.id || item.id,
            applicationId: item.id,
            borrower: item.client?.legalName || "Applicant",
            applicationNumber: item.applicationNumber || "-",
            loanInfo:
              fieldsMap.loanProductCode ||
              item.loanProductCode ||
              fieldsMap.purpose ||
              item.purpose ||
              "N/A",
            location:
              [fieldsMap.propertyCity, fieldsMap.propertyState, fieldsMap.propertyCountry]
                .filter(Boolean)
                .join(", ") || "N/A",
            amount: Number(fieldsMap.amountRequested || item.amountRequested || 0),
            purpose: fieldsMap.purpose || item.purpose || null,
            propertyCity: fieldsMap.propertyCity || null,
            propertyState: fieldsMap.propertyState || null,
            propertyCountry: fieldsMap.propertyCountry || null,
            loanProductCode: fieldsMap.loanProductCode || item.loanProductCode || null,
            termMonthsRequested:
              fieldsMap.termMonthsRequested || item.termMonthsRequested || null,
            status: item.status,
            submittedOn: item.submittedAt || item.createdAt,
            submissionStatus: latestSubmission?.status || null,
            dynamicFields: fieldsMap,
            assignedLoanOfficer: item.brokerUser
              ? {
                  firstName: item.brokerUser.firstName,
                  lastName: item.brokerUser.lastName,
                  email: item.brokerUser.email,
                  profileImage: item.brokerUser.profileImage,
                }
              : null,
            submittedToLenders: item.applicationLenders.map((lender) => ({
              lenderOrgId: lender.lenderOrgId,
              lenderName: lender.lender?.name || null,
              status: lender.status,
              sentAt: lender.sentAt,
            })),
          };
        });

        const totalPages = Math.ceil(total / limit) || 1;

        return reply.send({
          success: true,
          data: formatted,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
          },
        });
      } catch (err) {
        console.error(err);
        return reply.code(500).send({
          success: false,
          message: err.message || "Something went wrong",
        });
      }
    },
  );
}

module.exports = getApplicationsRoute;
