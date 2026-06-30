const bcrypt = require("bcrypt");
const { logAudit } = require("../../../services/logger/auditLogger");
const {
  buildProfileDataFromFields,
  parseBrokerUserMultipart,
  syncUserPermissions,
  parsePermissionsField,
  deletePublicFileIfExists,
} = require("../../../utils/brokerUserProfileHelpers");

module.exports = async function updateBrokerUser(fastify) {
  fastify.put(
    "/:id",
    {
      schema: {
        tags: ["Broker -> Users"],
        summary: "Update Loan Officer profile (with avatar)",
        consumes: ["multipart/form-data"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;
      const { id } = req.params;

      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        if (!req.user.roles?.includes("BROKER_ADMIN")) {
          return reply.code(403).send({
            success: false,
            message: "Only Broker Admin can update users",
          });
        }

        const brokerOrgId = req.user.organizationId;

        const existingUser = await prisma.userAccount.findUnique({
          where: { id },
          include: {
            brokerProfile: true,
          },
        });

        if (!existingUser) {
          return reply.code(404).send({
            success: false,
            message: "User not found",
          });
        }

        if (existingUser.organizationId !== brokerOrgId) {
          return reply.code(403).send({
            success: false,
            message: "Cannot update user from another organization",
          });
        }

        let fields;
        let avatarUrl;
        let w9Url;

        try {
          ({ fields, avatarUrl, w9Url } = await parseBrokerUserMultipart(req));
        } catch (uploadErr) {
          return reply.code(400).send({
            success: false,
            message: uploadErr.message || "Invalid upload",
          });
        }

        const {
          email,
          password,
          firstName,
          lastName,
          phone,
          allowedToLogin,
          company,
          address,
          agentType,
          licenseNumber,
          preferredComm,
          website,
        } = fields;

        let parsedPermissions = null;
        if (fields.permissions !== undefined) {
          try {
            parsedPermissions = parsePermissionsField(fields);
          } catch {
            return reply.code(400).send({
              success: false,
              message: "Invalid permissions format",
            });
          }
        }

        const userUpdateData = {};

        if (email) userUpdateData.email = email;
        if (firstName !== undefined) userUpdateData.firstName = firstName;
        if (lastName !== undefined) userUpdateData.lastName = lastName;
        if (phone !== undefined) userUpdateData.phone = phone;

        if (allowedToLogin !== undefined) {
          userUpdateData.status =
            allowedToLogin === "false" ? "DISABLED" : "ACTIVE";
        }

        if (password) {
          userUpdateData.passwordHash = await bcrypt.hash(password, 10);
        }

        const profileUpdateData = {};
        if (company !== undefined) profileUpdateData.company = company;
        if (address !== undefined) profileUpdateData.address = address;
        if (agentType !== undefined) profileUpdateData.agentType = agentType;
        if (licenseNumber !== undefined) {
          profileUpdateData.licenseNumber = licenseNumber;
        }
        if (preferredComm !== undefined) {
          profileUpdateData.preferredComm = preferredComm;
        }
        if (website !== undefined) profileUpdateData.website = website;

        if (avatarUrl !== null) profileUpdateData.avatarUrl = avatarUrl;
        if (w9Url !== null) profileUpdateData.w9Url = w9Url;

        const existingProfileData = existingUser.brokerProfile?.profileData || {};
        profileUpdateData.profileData = buildProfileDataFromFields(
          fields,
          existingProfileData,
        );

        await prisma.$transaction(async (tx) => {
          if (Object.keys(userUpdateData).length > 0) {
            await tx.userAccount.update({
              where: { id },
              data: userUpdateData,
            });
          }

          if (Object.keys(profileUpdateData).length > 0) {
            await tx.brokerUserProfile.update({
              where: { userId: id },
              data: profileUpdateData,
            });
          }

          if (parsedPermissions !== null) {
            await syncUserPermissions(tx, id, parsedPermissions);
          }
        });

        if (avatarUrl && existingUser.brokerProfile?.avatarUrl) {
          deletePublicFileIfExists(existingUser.brokerProfile.avatarUrl);
        }

        if (w9Url && existingUser.brokerProfile?.w9Url) {
          deletePublicFileIfExists(existingUser.brokerProfile.w9Url);
        }

        await logAudit({
          prisma,
          req,
          dashboard: "BROKER",
          category: "USER_MANAGEMENT",
          entityType: "UserAccount",
          entityId: id,
          action: "UPDATE_BROKER_OFFICER",
          newValue: {
            ...userUpdateData,
            ...profileUpdateData,
          },
        });

        return reply.send({
          success: true,
          message: "Loan Officer updated successfully",
        });
      } catch (error) {
        fastify.log.error(
          {
            error: error.message,
            stack: error.stack,
            userId: id,
          },
          "Update broker user failed",
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error while updating user",
        });
      }
    },
  );
};
