const path = require("path");
const fs = require("fs");
const { pipeline } = require("stream/promises");

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
        // ===============================
        // BROKER GUARD
        // ===============================
        if (!req.user || req.user.orgType !== "BROKER") {
          return reply.code(403).send({
            success: false,
            message: "Broker access only",
          });
        }

        const parts = req.parts();

        // ===============================
        // USER FIELDS
        // ===============================
        let firstName;
        let lastName;
        let profileImage;

        for await (const part of parts) {
          // ===============================
          // HANDLE TEXT FIELDS
          // ===============================
          if (part.type === "field") {
            switch (part.fieldname) {
              case "firstName":
                firstName = part.value;
                break;

              case "lastName":
                lastName = part.value;
                break;
            }
          }

          // ===============================
          // HANDLE FILE (PROFILE IMAGE)
          // ===============================
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
              "profile"
            );

            await fs.promises.mkdir(uploadDir, { recursive: true });

            const fileExt = path.extname(part.filename || "") || ".jpg";

            const fileName = `${req.user.userId}-${Date.now()}${fileExt}`;

            const filePath = path.join(uploadDir, fileName);

            // stream file safely
            await pipeline(part.file, fs.createWriteStream(filePath));

            profileImage = `/public/uploads/profile/${fileName}`;
          }
        }

        // ===============================
        // NOTHING TO UPDATE CHECK
        // ===============================
        if (!firstName && !lastName && !profileImage) {
          return reply.code(400).send({
            success: false,
            message: "Nothing to update",
          });
        }

        // ===============================
        // UPDATE USER ACCOUNT
        // ===============================
        const user = await prisma.userAccount.update({
          where: { id: req.user.userId },
          data: {
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(profileImage && { profileImage }),
          },
        });

        return reply.send({
          success: true,
          message: "Broker profile updated successfully",
          data: {
            user: {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              profileImage: user.profileImage,
            },
          },
        });
      } catch (err) {
        req.log.error(err);

        return reply.code(500).send({
          success: false,
          message: "Failed to update broker profile",
        });
      }
    }
  );
}

module.exports = brokerUpdateProfileRoutes;