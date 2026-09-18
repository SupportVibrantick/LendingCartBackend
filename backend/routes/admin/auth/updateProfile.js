const path = require("path");
const fs = require("fs");
const { pipeline } = require("stream/promises");
const { validateFileMimetype } = require("../../../utils/security/fileValidator");

module.exports = async function adminUpdateProfileRoute(fastify) {
  const safeAuthPreHandler = async (req, reply) => {
    if (typeof fastify.authenticate !== "function") {
      return reply.code(500).send({ ok: false, message: "Auth middleware missing" });
    }
    await fastify.authenticate(req, reply);
    if (reply.sent) return;
    const roleChecker = fastify.requireRole(["PLATFORM_ADMIN"]);
    return roleChecker(req, reply);
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

        const existingUser = await prisma.userAccount.findUnique({
          where: { id: userId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            profileImage: true,
          },
        });

        if (!existingUser) {
          return reply.code(404).send({ ok: false, message: "User not found" });
        }

        const parts = req.parts();
        let firstName;
        let lastName;
        let phone;
        let profileImage;
        let removeProfileImage = false;
        let uploadedNewImage = false;

        for await (const part of parts) {
          if (part.type === "field") {
            if (part.fieldname === "firstName") firstName = part.value;
            if (part.fieldname === "lastName") lastName = part.value;
            if (part.fieldname === "phone") phone = part.value;
            if (part.fieldname === "removeProfileImage") {
              const raw = String(part.value ?? "").trim().toLowerCase();
              removeProfileImage = ["1", "true", "yes", "on"].includes(raw);
            }
          }

          if (part.type === "file" && part.fieldname === "profileImage") {
            const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
            const validation = await validateFileMimetype(part.file, allowedMimeTypes);
            if (!validation.isValid) {
              return reply.code(400).send({
                ok: false,
                message: `Invalid file type. Detected: ${validation.detectedMime || "unknown"}. Only JPG, PNG, WEBP images allowed`,
              });
            }
            const validatedStream = validation.stream;

            const uploadDir = path.join(process.cwd(), "public", "uploads", "profile");
            await fs.promises.mkdir(uploadDir, { recursive: true });

            const fileExt = path.extname(part.filename || "") || ".jpg";
            const fileName = `${userId}-${Date.now()}${fileExt}`;
            const filePath = path.join(uploadDir, fileName);

            await pipeline(validatedStream, fs.createWriteStream(filePath));
            profileImage = `/public/uploads/profile/${fileName}`;
            uploadedNewImage = true;
          }
        }

        if (removeProfileImage && !uploadedNewImage) {
          const previous = existingUser.profileImage;
          profileImage = null;

          if (
            previous &&
            typeof previous === "string" &&
            previous.startsWith("/public/uploads/profile/") &&
            previous.includes(userId)
          ) {
            const absolute = path.join(
              process.cwd(),
              previous.replace(/^\//, ""),
            );
            await fs.promises.unlink(absolute).catch(() => {});
          }
        }

        const hasProfileImageUpdate =
          uploadedNewImage || (removeProfileImage && !uploadedNewImage);

        if (
          firstName === undefined &&
          lastName === undefined &&
          phone === undefined &&
          !hasProfileImageUpdate
        ) {
          return reply.code(400).send({ ok: false, message: "Nothing to update" });
        }

        const user = await prisma.userAccount.update({
          where: { id: userId },
          data: {
            ...(firstName !== undefined && { firstName: firstName || null }),
            ...(lastName !== undefined && { lastName: lastName || null }),
            ...(phone !== undefined && { phone: phone || null }),
            ...(hasProfileImageUpdate && { profileImage }),
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
