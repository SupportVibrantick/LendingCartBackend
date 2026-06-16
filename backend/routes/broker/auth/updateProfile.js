const path = require("path");
const fs = require("fs");
const { pipeline } = require("stream/promises");

const PROFILE_FIELDS = [
  "company",
  "tollFree",
  "tollFreeExt",
  "serviceProvider",
  "address",
  "suite",
  "city",
  "state",
  "zipCode",
  "agentType",
  "licenseNumber",
  "preferredComm",
  "website",
  "phone",
];

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function brokerUpdateProfileRoutes(fastify) {
  fastify.put(
    "/profile",
    {
      preHandler: fastify.authenticate,
      schema: {
        tags: ["Broker -> Auth"],
        summary: "Update broker user profile",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const userId = req.user.userId || req.user.id;

        const existingUser = await prisma.userAccount.findUnique({
          where: { id: userId },
          include: { brokerProfile: true },
        });

        if (!existingUser) {
          return reply.code(404).send({
            success: false,
            message: "User not found",
          });
        }

        const parts = req.parts();
        let firstName = existingUser.firstName;
        let lastName = existingUser.lastName;
        let phone = existingUser.phone;
        let profileImage = existingUser.profileImage;
        const profileData = {};

        for await (const part of parts) {
          if (part.type === "field") {
            if (part.fieldname === "firstName") {
              firstName = String(part.value).trim();
            }
            if (part.fieldname === "lastName") {
              lastName = String(part.value).trim();
            }
            if (part.fieldname === "phone") {
              phone = String(part.value).trim();
            }
            if (PROFILE_FIELDS.includes(part.fieldname)) {
              profileData[part.fieldname] = String(part.value).trim();
            }
          }

          if (part.type === "file" && part.fieldname === "profileImage") {
            const allowedMimeTypes = [
              "image/jpeg",
              "image/png",
              "image/webp",
            ];

            if (!allowedMimeTypes.includes(part.mimetype)) {
              return reply.code(400).send({
                success: false,
                message: "Only JPG, PNG, WEBP images allowed",
              });
            }

            const uploadDir = path.join(
              process.cwd(),
              "public",
              "uploads",
              "profile",
            );

            await fs.promises.mkdir(uploadDir, { recursive: true });

            const fileExt = path.extname(part.filename || "") || ".jpg";
            const fileName = `${userId}-${Date.now()}${fileExt}`;
            const filePath = path.join(uploadDir, fileName);

            await pipeline(part.file, fs.createWriteStream(filePath));
            profileImage = `/public/uploads/profile/${fileName}`;
          }
        }

        if (!firstName?.trim()) {
          return reply.code(400).send({
            success: false,
            message: "First name is required",
          });
        }

        const updatedUser = await prisma.$transaction(async (tx) => {
          await tx.userAccount.update({
            where: { id: userId },
            data: {
              firstName,
              lastName,
              phone: profileData.phone ?? phone,
              profileImage,
            },
          });

          const brokerFields = { ...profileData };
          delete brokerFields.phone;

          if (Object.keys(brokerFields).length > 0 || existingUser.brokerProfile) {
            await tx.brokerUserProfile.upsert({
              where: { userId },
              update: brokerFields,
              create: {
                userId,
                ...brokerFields,
              },
            });
          }

          return tx.userAccount.findUnique({
            where: { id: userId },
            include: {
              organization: true,
              roles: { include: { role: true } },
              brokerProfile: true,
            },
          });
        });

        return reply.send({
          success: true,
          message: "Broker profile updated successfully",
          data: {
            user: {
              id: updatedUser.id,
              email: updatedUser.email,
              firstName: updatedUser.firstName,
              lastName: updatedUser.lastName,
              name: `${updatedUser.firstName || ""} ${updatedUser.lastName || ""}`.trim(),
              phone: updatedUser.phone,
              profileImage: updatedUser.profileImage,
              status: updatedUser.status,
              roles: updatedUser.roles.map((r) => r.role.name),
              brokerProfile: updatedUser.brokerProfile,
            },
            organization: updatedUser.organization
              ? {
                  id: updatedUser.organization.id,
                  name: updatedUser.organization.name,
                  type: updatedUser.organization.type,
                  status: updatedUser.organization.status,
                }
              : null,
          },
        });
      } catch (err) {
        req.log.error(err);

        return reply.code(500).send({
          success: false,
          message: "Failed to update broker profile",
        });
      }
    },
  );
}

module.exports = brokerUpdateProfileRoutes;
