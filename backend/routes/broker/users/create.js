// backend/routes/broker/users/create.js

const bcrypt = require("bcrypt");

module.exports = async function createBrokerUser(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Broker -> Users"],
        summary: "Create Loan Officer with full profile",
        body: {
          type: "object",
          required: [
            "email",
            "confirmEmail",
            "password",
            "confirmPassword",
            "firstName",
            "lastName"
          ],
          properties: {
            email: { type: "string", format: "email" },
            confirmEmail: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            confirmPassword: { type: "string", minLength: 8 },
            firstName: { type: "string" },
            lastName: { type: "string" },
            phone: { type: "string" },
            allowedToLogin: { type: "boolean" },

            // Profile fields
            company: { type: "string" },
            tollFree: { type: "string" },
            tollFreeExt: { type: "string" },
            serviceProvider: { type: "string" },
            address: { type: "string" },
            suite: { type: "string" },
            city: { type: "string" },
            state: { type: "string" },
            zipCode: { type: "string" },
            agentType: { type: "string" },
            licenseNumber: { type: "string" },
            preferredComm: { type: "string" },
            website: { type: "string" },
            avatarUrl: { type: "string" }
          }
        }
      }
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* =====================================================
           1️⃣ AUTHORIZATION
        ===================================================== */

        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only"
          });
        }

        if (!req.user.roles?.includes("BROKER_ADMIN")) {
          return reply.code(403).send({
            success: false,
            message: "Only Broker Admin can create users"
          });
        }

        const brokerOrgId = req.user.organizationId;

        /* =====================================================
           2️⃣ VALIDATION
        ===================================================== */

        const {
          email,
          confirmEmail,
          password,
          confirmPassword,
          firstName,
          lastName,
          phone,
          allowedToLogin = true,
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
          avatarUrl
        } = req.body;

        if (email !== confirmEmail) {
          return reply.code(400).send({
            success: false,
            message: "Email and Confirm Email do not match"
          });
        }

        if (password !== confirmPassword) {
          return reply.code(400).send({
            success: false,
            message: "Password and Confirm Password do not match"
          });
        }

        const existingUser = await prisma.userAccount.findUnique({
          where: { email }
        });

        if (existingUser) {
          return reply.code(400).send({
            success: false,
            message: "Email already registered"
          });
        }

        /* =====================================================
           3️⃣ HASH PASSWORD
        ===================================================== */

        const passwordHash = await bcrypt.hash(password, 10);

        /* =====================================================
           4️⃣ FETCH ROLE
        ===================================================== */

        const roleRecord = await prisma.role.findFirst({
          where: { name: "BROKER_OFFICER" }
        });

        if (!roleRecord) {
          return reply.code(400).send({
            success: false,
            message: "Role configuration error"
          });
        }

        /* =====================================================
           5️⃣ TRANSACTION CREATE USER + PROFILE
        ===================================================== */

        const newUser = await prisma.$transaction(async (tx) => {
          const user = await tx.userAccount.create({
            data: {
              email,
              passwordHash,
              firstName,
              lastName,
              phone,
              organizationId: brokerOrgId,
              status: allowedToLogin ? "ACTIVE" : "DISABLED"
            }
          });

          await tx.userRole.create({
            data: {
              userId: user.id,
              roleId: roleRecord.id
            }
          });

          await tx.brokerUserProfile.create({
            data: {
              userId: user.id,
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
              avatarUrl
            }
          });

          return user;
        });

        /* =====================================================
           6️⃣ AUDIT LOG
        ===================================================== */

        await prisma.auditLog.create({
          data: {
            actorUserId: req.user.id,
            actorOrgId: brokerOrgId,
            entityType: "UserAccount",
            entityId: newUser.id,
            action: "CREATE_BROKER_OFFICER",
            newValueJson: JSON.stringify({
              email,
              firstName,
              lastName
            })
          }
        });

        /* =====================================================
           7️⃣ SUCCESS RESPONSE
        ===================================================== */

        return reply.code(201).send({
          success: true,
          message: "Loan Officer created successfully",
          data: {
            id: newUser.id,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            status: newUser.status
          }
        });

      } catch (error) {
        fastify.log.error(error);

        return reply.code(500).send({
          success: false,
          message: "Internal server error while creating user"
        });
      }
    }
  );
};