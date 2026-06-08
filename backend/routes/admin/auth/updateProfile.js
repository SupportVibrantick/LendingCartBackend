const path = require("path");
const fs = require("fs");
const { pipeline } = require("stream/promises");

module.exports = async function adminUpdateProfileRoute(fastify) {
  const safeAuthPreHandler = async (req, reply) => {
    if (typeof fastify.authenticate !== "function") {
      return reply.code(500).send({ ok: false, message: "Auth middleware missing" });
    }
    return fastify.authenticate(req, reply);
  };

  fastify.put(
    "/profile",
    { preHandler: [safeAuthPreHandler] },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) {
          return reply.code(401).send({ ok: false, message: "Unauthorized" });
        }

        const parts = req.parts();
        let firstName;
        let lastName;
        let phone;
        let profileImage;

        for await (const part of parts) {
          if (part.type === "field") {
            if (part.fieldname === "firstName") firstName = part.value;
            if (part.fieldname === "lastName") lastName = part.value;
            if (part.fieldname === "phone") phone = part.value;
          }

          if (part.type === "file" && part.fieldname === "profileImage") {
            const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
            if (!allowedMimeTypes.includes(part.mimetype)) {
              return reply.code(400).send({
                ok: false,
                message: "Only JPG, PNG, WEBP images allowed",
              });
            }

            const uploadDir = path.join(process.cwd(), "public", "uploads", "profile");
            await fs.promises.mkdir(uploadDir, { recursive: true });

            const fileExt = path.extname(part.filename || "") || ".jpg";
            const fileName = `${userId}-${Date.now()}${fileExt}`;
            const filePath = path.join(uploadDir, fileName);

            await pipeline(part.file, fs.createWriteStream(filePath));
            profileImage = `/public/uploads/profile/${fileName}`;
          }
        }

        if (!firstName && !lastName && phone === undefined && !profileImage) {
          return reply.code(400).send({ ok: false, message: "Nothing to update" });
        }

        const user = await prisma.userAccount.update({
          where: { id: userId },
          data: {
            ...(firstName !== undefined && { firstName: firstName || null }),
            ...(lastName !== undefined && { lastName: lastName || null }),
            ...(phone !== undefined && { phone: phone || null }),
            ...(profileImage && { profileImage }),
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            profileImage: true,
            status: true,
          },
        });

        return reply.send({
          ok: true,
          message: "Profile updated successfully",
          user,
        });
      } catch (err) {
        fastify.log.error(err);
        return reply.code(500).send({ ok: false, message: "Failed to update profile" });
      }
    }
  );
};
