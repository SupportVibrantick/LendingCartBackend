const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const { pipeline } = require("stream/promises");
const { logAudit } = require("../../../services/logger/auditLogger");

module.exports = async function createBrokerUser(fastify) {
  fastify.post(
    "/",
    {
      schema: {
        tags: ["Broker -> Users"],
        summary: "Create Loan Officer with full profile",
        consumes: ["multipart/form-data"]
      }
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        /* ================= AUTHORIZATION ================= */

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

        /* ================= MULTIPART PARSE ================= */

        const parts = req.parts();
        const fields = {};
        let avatarPath = null;

        for await (const part of parts) {
          if (part.type === "file") {
            if (part.fieldname === "avatar") {
              const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

              if (!allowedTypes.includes(part.mimetype)) {
                return reply.code(400).send({
                  success: false,
                  message: "Invalid image type. Only jpg, png, webp allowed."
                });
              }

              const uploadDir = path.join(
                process.cwd(),
                "public/broker/loanofficer"
              );

              if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
              }

              const fileName =
                Date.now() +
                "-" +
                part.filename.replace(/\s+/g, "_");

              const filePath = path.join(uploadDir, fileName);

              await pipeline(part.file, fs.createWriteStream(filePath));

              avatarPath = `/public/broker/loanofficer/${fileName}`;
            }
          } else {
            fields[part.fieldname] = part.value;
          }
        }

        /* ================= VALIDATION ================= */

        const {
          email,
          confirmEmail,
          password,
          confirmPassword,
          firstName,
          lastName,
          phone,
          allowedToLogin,
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
          website
        } = fields;

        if (!email || !confirmEmail || !password || !confirmPassword || !firstName || !lastName) {
          return reply.code(400).send({
            success: false,
            message: "Required fields missing"
          });
        }

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

        /* ================= HASH PASSWORD ================= */

        const passwordHash = await bcrypt.hash(password, 10);

        /* ================= FETCH ROLE ================= */

        const roleRecord = await prisma.role.findFirst({
          where: { name: "BROKER_OFFICER" }
        });

        if (!roleRecord) {
          return reply.code(500).send({
            success: false,
            message: "Role configuration error"
          });
        }

        /* ================= TRANSACTION ================= */

        const newUser = await prisma.$transaction(async (tx) => {
          const user = await tx.userAccount.create({
            data: {
              email,
              passwordHash,
              firstName,
              lastName,
              phone,
              organizationId: brokerOrgId,
              status: allowedToLogin === "false" ? "DISABLED" : "ACTIVE"
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
              avatarUrl: avatarPath
            }
          });

          return user;
        });

        /* ================= AUDIT LOG ================= */

        await logAudit({
          prisma,
          req,
          dashboard: "BROKER",
          category: "USER_MANAGEMENT",
          entityType: "UserAccount",
          entityId: newUser.id,
          action: "CREATE_BROKER_OFFICER",
          newValue: {
            email,
            firstName,
            lastName
          }
        });

        /* ================= SUCCESS ================= */

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
        fastify.log.error({
          error: error.message,
          stack: error.stack
        });

        return reply.code(500).send({
          success: false,
          message: "Internal server error while creating user"
        });
      }
    }
  );
};