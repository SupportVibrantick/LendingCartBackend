/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function updateSubBrokerRoutes(fastify) {
  const bcrypt = require("bcrypt");
  const {
    buildProfileDataFromFields,
    parseMultipartRequest,
    syncSubBrokerLoanOfficers,
    formatSubBrokerDetail,
    parseJsonField,
    validatePrimaryContactFields,
  } = require("../../../utils/subBrokerProfileHelpers");

  fastify.patch(
    "/:id/update",
    {
      schema: {
        tags: ["Broker -> Sub Broker"],
        summary: "Update Sub Broker profile",
        consumes: ["multipart/form-data", "application/json"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user) {
          return reply.code(401).send({
            success: false,
            message: "Authentication required",
          });
        }

        if (!req.user.organizationId || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const roles = req.user.roles || [];
        const allowedRoles = ["BROKER_ADMIN", "BROKER_OFFICER"];
        const hasAccess = roles.some((role) => allowedRoles.includes(role));

        if (!hasAccess) {
          return reply.code(403).send({
            success: false,
            message: "Access denied",
          });
        }

        const brokerOrgId = req.user.organizationId;
        const { id } = req.params;
        const { fields, logoUrl, w9Url } = await parseMultipartRequest(req);

        const existingUser = await prisma.userAccount.findFirst({
          where: {
            id,
            organizationId: brokerOrgId,
            isDeleted: false,
            roles: {
              some: {
                role: { name: "SUB_BROKER" },
              },
            },
          },
          include: {
            subBrokerProfile: true,
          },
        });

        if (!existingUser) {
          return reply.code(404).send({
            success: false,
            message: "Sub broker not found",
          });
        }

        const updateData = {};
        const contactValidation = validatePrimaryContactFields(fields);

        if (contactValidation.error) {
          return reply.code(400).send({
            success: false,
            message: contactValidation.error,
          });
        }

        const { account } = contactValidation;
        updateData.firstName = account.firstName;
        updateData.lastName = account.lastName;
        updateData.phone = account.phone;

        if (fields.password) {
          if (String(fields.password).length < 8) {
            return reply.code(400).send({
              success: false,
              message: "Password must be at least 8 characters",
            });
          }
          updateData.passwordHash = await bcrypt.hash(fields.password, 10);
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.userAccount.update({
            where: { id },
            data: updateData,
          });
        }

        const profileData = buildProfileDataFromFields(fields);
        const mergedProfileData = {
          ...(existingUser.subBrokerProfile?.profileData || {}),
          ...profileData,
        };

        await prisma.subBrokerProfile.upsert({
          where: { userId: id },
          create: {
            userId: id,
            profileData: mergedProfileData,
            logoUrl,
            w9Url,
          },
          update: {
            profileData: mergedProfileData,
            ...(logoUrl ? { logoUrl } : {}),
            ...(w9Url ? { w9Url } : {}),
          },
        });

        if (fields.assignedLoanOfficerIds !== undefined) {
          const assignedLoanOfficerIds = parseJsonField(
            fields.assignedLoanOfficerIds,
            [],
          );
          await syncSubBrokerLoanOfficers(
            prisma,
            id,
            assignedLoanOfficerIds,
            brokerOrgId,
          );
        }

        const detail = await prisma.userAccount.findUnique({
          where: { id },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            createdById: true,
            subBrokerProfile: true,
            subBrokerLoanOfficers: {
              include: {
                loanOfficer: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    profileImage: true,
                  },
                },
              },
            },
          },
        });

        return reply.send({
          success: true,
          message: "Sub broker updated successfully",
          data: formatSubBrokerDetail(
            detail,
            detail.subBrokerProfile,
            detail.subBrokerLoanOfficers,
          ),
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            params: req.params,
            user: req.user,
          },
          "Update sub broker failed",
        );

        return reply.code(500).send({
          success: false,
          message: error.message || "Internal server error",
        });
      }
    },
  );
};
