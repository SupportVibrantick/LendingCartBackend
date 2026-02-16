const bcrypt = require("bcrypt");
const { logAudit } = require("../../../services/logger/auditLogger");

module.exports = async function updateBrokerUser(fastify) {
  fastify.put(
    "/:id",
    {
      schema: {
        tags: ["Broker -> Users"],
        summary: "Update Loan Officer profile",
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
        /* =====================================================
           1️⃣ AUTHORIZATION
        ===================================================== */

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

        /* =====================================================
           2️⃣ FETCH EXISTING USER
        ===================================================== */

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

        /* =====================================================
           3️⃣ EXTRACT UPDATE DATA
        ===================================================== */

        const {
          email,
          password,
          firstName,
          lastName,
          phone,
          allowedToLogin,

          // Profile fields
          company,
          tollFree,
          tollFreeExt,
          serviceProvider,
          address,
          suite,
          city,
          state,
          zipCode,
          agentType,
          licenseNumber,
          preferredComm,
          website,
          avatarUrl,
        } = req.body;

        /* =====================================================
           4️⃣ BUILD USER UPDATE OBJECT
        ===================================================== */

        const userUpdateData = {};

        if (email) userUpdateData.email = email;
        if (firstName !== undefined) userUpdateData.firstName = firstName;
        if (lastName !== undefined) userUpdateData.lastName = lastName;
        if (phone !== undefined) userUpdateData.phone = phone;

        if (allowedToLogin !== undefined) {
          userUpdateData.status = allowedToLogin
            ? "ACTIVE"
            : "DISABLED";
        }

        if (password) {
          userUpdateData.passwordHash = await bcrypt.hash(password, 10);
        }

        /* =====================================================
           5️⃣ BUILD PROFILE UPDATE OBJECT
        ===================================================== */

        const profileUpdateData = {};

        if (company !== undefined) profileUpdateData.company = company;
        if (tollFree !== undefined) profileUpdateData.tollFree = tollFree;
        if (tollFreeExt !== undefined)
          profileUpdateData.tollFreeExt = tollFreeExt;
        if (serviceProvider !== undefined)
          profileUpdateData.serviceProvider = serviceProvider;
        if (address !== undefined) profileUpdateData.address = address;
        if (suite !== undefined) profileUpdateData.suite = suite;
        if (city !== undefined) profileUpdateData.city = city;
        if (state !== undefined) profileUpdateData.state = state;
        if (zipCode !== undefined) profileUpdateData.zipCode = zipCode;
        if (agentType !== undefined)
          profileUpdateData.agentType = agentType;
        if (licenseNumber !== undefined)
          profileUpdateData.licenseNumber = licenseNumber;
        if (preferredComm !== undefined)
          profileUpdateData.preferredComm = preferredComm;
        if (website !== undefined) profileUpdateData.website = website;
        if (avatarUrl !== undefined)
          profileUpdateData.avatarUrl = avatarUrl;

        /* =====================================================
           6️⃣ TRANSACTION UPDATE
        ===================================================== */

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
        });

        /* =====================================================
           7️⃣ AUDIT LOG
        ===================================================== */

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

        /* =====================================================
           8️⃣ SUCCESS RESPONSE
        ===================================================== */

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
          "Update broker user failed"
        );

        return reply.code(500).send({
          success: false,
          message: "Internal server error while updating user",
        });
      }
    }
  );
};