const path = require("path");
const fs = require("fs");

async function updateSubBrokerProfileRoutes(
  fastify,
) {
  fastify.put(
    "/me",
    {
      preHandler: [
        fastify.authenticate,

        fastify.requireRole([
          "SUB_BROKER",
        ]),
      ],
    },

    async (request, reply) => {
      const prisma =
        fastify.prisma;

      try {
        const userId =
          request.user.userId;

        /* ===============================
           GET CURRENT USER
        =============================== */

        const existingUser =
          await prisma.userAccount.findUnique(
            {
              where: {
                id: userId,
              },
            },
          );

        if (!existingUser) {
          return reply
            .code(404)
            .send({
              success: false,

              message:
                "User not found",
            });
        }

        /* ===============================
           MULTIPART FORM DATA
        =============================== */

        const parts =
          request.parts();

        let firstName =
          existingUser.firstName;

        let lastName =
          existingUser.lastName;

        let profileImage =
          existingUser.profileImage;

        for await (const part of parts) {
          /* TEXT FIELDS */

          if (
            part.type ===
            "field"
          ) {
            if (
              part.fieldname ===
              "firstName"
            ) {
              firstName =
                String(
                  part.value,
                ).trim();
            }

            if (
              part.fieldname ===
              "lastName"
            ) {
              lastName =
                String(
                  part.value,
                ).trim();
            }
          }

          /* FILE */

          if (
            part.type ===
              "file" &&
            part.fieldname ===
              "profileImage"
          ) {
            const uploadDir =
              path.join(
                process.cwd(),
                "public/uploads/profile",
              );

            /* CREATE DIR */

            if (
              !fs.existsSync(
                uploadDir,
              )
            ) {
              fs.mkdirSync(
                uploadDir,
                {
                  recursive: true,
                },
              );
            }

            /* EXTENSION */

            const ext =
              path.extname(
                part.filename,
              ) || ".png";

            const fileName = `${userId}-${Date.now()}${ext}`;

            const filePath =
              path.join(
                uploadDir,
                fileName,
              );

            /* SAVE FILE */

            await pump(
              part.file,
              fs.createWriteStream(
                filePath,
              ),
            );

            profileImage = `/public/uploads/profile/${fileName}`;
          }
        }

        /* ===============================
           VALIDATION
        =============================== */

        if (
          !firstName ||
          !firstName.trim()
        ) {
          return reply
            .code(400)
            .send({
              success: false,

              message:
                "First name is required",
            });
        }

        /* ===============================
           UPDATE USER
        =============================== */

        const updatedUser =
          await prisma.userAccount.update(
            {
              where: {
                id: userId,
              },

              data: {
                firstName,

                lastName,

                profileImage,
              },

              include: {
                organization: true,

                roles: {
                  include: {
                    role: true,
                  },
                },

                _count: {
                  select: {
                    assignedApplications:
                      true,
                  },
                },
              },
            },
          );

        /* ===============================
           RESPONSE
        =============================== */

        return reply.send({
          success: true,

          message:
            "Profile updated successfully",

          data: {
            id: updatedUser.id,

            email:
              updatedUser.email,

            firstName:
              updatedUser.firstName,

            lastName:
              updatedUser.lastName,

            name:
              `${updatedUser.firstName || ""} ${
                updatedUser.lastName ||
                ""
              }`.trim(),

            phone:
              updatedUser.phone,

            profileImage:
              updatedUser.profileImage,

            status:
              updatedUser.status,

            roles:
              updatedUser.roles.map(
                (r) =>
                  r.role.name,
              ),

            assignedApplications:
              updatedUser
                ._count
                .assignedApplications,

            organization:
              updatedUser
                .organization
                ? {
                    id:
                      updatedUser
                        .organization
                        .id,

                    name:
                      updatedUser
                        .organization
                        .name,

                    type:
                      updatedUser
                        .organization
                        .type,

                    status:
                      updatedUser
                        .organization
                        .status,
                  }
                : null,
          },
        });
      } catch (err) {
        console.error(err);

        return reply
          .code(500)
          .send({
            success: false,

            message:
              err.message ||
              "Something went wrong",
          });
      }
    },
  );
}

module.exports =
  updateSubBrokerProfileRoutes;