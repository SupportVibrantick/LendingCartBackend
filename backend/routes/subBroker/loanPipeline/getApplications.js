const prisma = require("../../../config/prisma");

async function getApplicationsRoute(fastify, options) {
  fastify.get(
    "/",

    {
      preHandler: [fastify.authenticate, fastify.requireRole(["SUB_BROKER"])],
    },

    async (request, reply) => {
      try {
        const userId = request.user.userId;

        /* QUERY PARAMS */
        const page = Number(request.query.page || 1);

        const limit = Number(request.query.limit || 10);

        const search = String(request.query.search || "").trim();

        const skip = (page - 1) * limit;

        /* FILTER */
        const where = {
          subBrokerAssignments: {
            some: {
              subBrokerId: userId,
            },
          },

          isDeleted: false,

          ...(search && {
            OR: [
              {
                applicationNumber: {
                  contains: search,
                  mode: "insensitive",
                },
              },

              {
                borrower: {
                  firstName: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },

              {
                borrower: {
                  lastName: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },

              {
                borrower: {
                  email: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },

              {
                loanPurpose: {
                  contains: search,
                  mode: "insensitive",
                },
              },

              {
                status: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          }),
        };

        /* TOTAL COUNT */
        const total = await prisma.loanApplication.count({
          where,
        });

        /* GET APPLICATIONS */
        const applications = await prisma.loanApplication.findMany({
          where,

          skip,

          take: limit,

          orderBy: {
            createdAt: "desc",
          },

          select: {
            id: true,

            applicationNumber: true,

            loanAmount: true,

            loanPurpose: true,

            status: true,

            createdAt: true,

            updatedAt: true,

            propertyCity: true,

            propertyState: true,

            propertyCountry: true,

            borrower: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },

            assignedLoanOfficer: {
              select: {
                firstName: true,
                lastName: true,
                profileImage: true,
              },
            },
          },
        });

        /* PAGINATION */
        const totalPages = Math.ceil(total / limit);

        const hasNextPage = page < totalPages;

        const hasPreviousPage = page > 1;

        const totalPages = Math.ceil(total / limit);

        return reply.code(200).send({
          success: true,

          data: applications,

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
