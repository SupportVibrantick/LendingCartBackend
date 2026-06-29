const path = require("path");
const fs = require("fs");
const { pipeline } = require("stream/promises");
const {
  resolveCoBrokerBranding,
} = require("../../../utils/resolveCoBrokerBranding");
const {
  formatCoBrokerAuthResponse,
  mergeSelfEditableProfileData,
  subBrokerAuthInclude,
} = require("../../../utils/subBrokerProfileHelpers");

async function updateSubBrokerProfileRoutes(fastify) {
  fastify.put(
    "/me",
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(["SUB_BROKER"]),
      ],
    },
    async (request, reply) => {
      const prisma = fastify.prisma;

      try {
        const userId = request.user.userId || request.user.id;

        const existingUser = await prisma.userAccount.findUnique({
          where: { id: userId },
          include: { subBrokerProfile: true },
        });

        if (!existingUser) {
          return reply.code(404).send({
            success: false,
            message: "User not found",
          });
        }

        const parts = request.parts();

        let firstName = existingUser.firstName;
        let lastName = existingUser.lastName;
        let phone = existingUser.phone;
        let profileImage = existingUser.profileImage;
        const profileFields = {};

        for await (const part of parts) {
          if (part.type === "field") {
            const value = String(part.value ?? "").trim();

            if (part.fieldname === "firstName") {
              firstName = value;
            } else if (part.fieldname === "lastName") {
              lastName = value;
            } else if (part.fieldname === "phone") {
              phone = value.replace(/\D/g, "");
            } else if (
              [
                "address",
                "website",
                "linkedinUrl",
                "preferredComm",
                "tollFree",
              ].includes(part.fieldname)
            ) {
              profileFields[part.fieldname] = value;
            }

            continue;
          }

          if (part.type === "file" && part.fieldname === "profileImage") {
            const uploadDir = path.join(
              process.cwd(),
              "public/uploads/profile",
            );

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

        if (phone && phone.length > 0 && phone.length < 10) {
          return reply.code(400).send({
            success: false,
            message: "Enter a valid 10-digit phone number",
          });
        }

        const existingProfileData =
          existingUser.subBrokerProfile?.profileData || {};
        const nextProfileData = mergeSelfEditableProfileData(
          existingProfileData,
          profileFields,
        );

        const updatedUser = await prisma.$transaction(async (tx) => {
          await tx.userAccount.update({
            where: { id: userId },
            data: {
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              phone: phone || null,
              profileImage,
            },
          });

          await tx.subBrokerProfile.upsert({
            where: { userId },
            create: {
              userId,
              profileData: nextProfileData,
            },
            update: {
              profileData: nextProfileData,
            },
          });

          return tx.userAccount.findUnique({
            where: { id: userId },
            include: subBrokerAuthInclude,
          });
        });

        const [branding, assignedApplications] = await Promise.all([
          resolveCoBrokerBranding(
            prisma,
            updatedUser.id,
            updatedUser.organizationId,
          ),
          prisma.subBrokerApplication.count({
            where: { subBrokerId: userId },
          }),
        ]);

        return reply.send({
          ok: true,
          success: true,
          message: "Profile updated successfully",
          data: formatCoBrokerAuthResponse(
            updatedUser,
            branding,
            assignedApplications,
          ),
        });
      } catch (err) {
        request.log.error(err);

        return reply.code(500).send({
          success: false,
          message: err.message || "Something went wrong",
        });
      }
    },
  );
}

module.exports = updateSubBrokerProfileRoutes;
