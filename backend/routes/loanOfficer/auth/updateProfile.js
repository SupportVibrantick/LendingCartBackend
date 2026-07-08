const path = require("path");
const fs = require("fs");
const { pipeline } = require("stream/promises");
const { officerPreHandler } = require("../../../services/broker/loanOfficerAccess");

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

async function updateLoanOfficerProfileRoutes(fastify) {
  fastify.put(
    "/me",
    { preHandler: officerPreHandler(fastify) },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        const userId = request.user.userId || request.user.id;

        const existingUser = await prisma.userAccount.findUnique({
          where: { id: userId },
          include: { brokerProfile: true },
        });

        if (!existingUser) {
          return reply.code(404).send({ success: false, message: "User not found" });
        }

        const parts = request.parts();
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
            const uploadDir = path.join(process.cwd(), "public/uploads/profile");
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }

            const ext = path.extname(part.filename) || ".png";
            const fileName = `${userId}-${Date.now()}${ext}`;
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
          const user = await tx.userAccount.update({
            where: { id: userId },
            data: {
              firstName,
              lastName,
              phone: profileData.phone ?? phone,
              profileImage,
            },
            include: {
              organization: true,
              roles: { include: { role: true } },
              brokerProfile: true,
            },
          });

          const brokerFields = { ...profileData };
          delete brokerFields.phone;

          if (Object.keys(brokerFields).length > 0 || user.brokerProfile) {
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
          message: "Profile updated successfully",
          data: {
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
        console.error(err);
        return reply.code(500).send({
          success: false,
          message: err.message || "Something went wrong",
        });
      }
    },
  );
}

module.exports = updateLoanOfficerProfileRoutes;
