const path = require("path");
const fs = require("fs/promises");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
async function lenderUpdateProfileRoutes(fastify) {
  fastify.put(
    "/profile",
    {
      preHandler: fastify.authenticate,
      schema: {
        tags: ["Lender -> Auth"],
        summary: "Update lender profile (name & profile picture)",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        // 🔐 Lender check
        if (
          !req.user ||
          req.user.orgType !== "LENDER" ||
          !req.user.userId
        ) {
          return reply.status(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const parts = await req.parts();

        let firstName;
        let lastName;
        let profileImage;

        for await (const part of parts) {
          if (part.type === "field") {
            if (part.fieldname === "firstName") firstName = part.value;
            if (part.fieldname === "lastName") lastName = part.value;
          }

          if (part.type === "file" && part.fieldname === "profileImage") {
            const uploadDir = path.join(
              process.cwd(),
              "public/uploads/profile"
            );

            await fs.mkdir(uploadDir, { recursive: true });

            const fileName = `${req.user.userId}-${Date.now()}${path.extname(
              part.filename
            )}`;

            const filePath = path.join(uploadDir, fileName);

            await fs.writeFile(filePath, await part.toBuffer());

            profileImage = `/uploads/profile/${fileName}`;
          }
        }

        if (!firstName && !lastName && !profileImage) {
          return reply.status(400).send({
            success: false,
            message: "Nothing to update",
          });
        }

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
          message: "Profile updated successfully",
          data: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImage: user.profileImage,
          },
        });
      } catch (err) {
        console.error("UPDATE PROFILE ERROR:", err);
        return reply.status(500).send({
          success: false,
          message: "Failed to update profile",
        });
      }
    }
  );
}

module.exports = lenderUpdateProfileRoutes;
