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
        summary: "Update lender user + lender profile",
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        // LENDER GUARD
        if (!req.user || req.user.orgType !== "LENDER") {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const parts = await req.parts();

        // USER FIELDS
        let firstName;
        let lastName;
        let profileImage;

        // LENDER PROFILE FIELDS
        let summary;
        let loanTypes;
        let minFunding;
        let maxFunding;
        let statesSupported;
        let industries;
        let fundingSpeedDays;

        for await (const part of parts) {
          if (part.type === "field") {
            switch (part.fieldname) {
              case "firstName":
                firstName = part.value;
                break;
              case "lastName":
                lastName = part.value;
                break;

              case "summary":
                summary = part.value;
                break;
              case "loanTypes":
                loanTypes = JSON.parse(part.value); // expects array
                break;
              case "minFunding":
                minFunding = part.value;
                break;
              case "maxFunding":
                maxFunding = part.value;
                break;
              case "statesSupported":
                statesSupported = part.value;
                break;
              case "industries":
                industries = part.value;
                break;
              case "fundingSpeedDays":
                fundingSpeedDays = Number(part.value);
                break;
            }
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

        if (
          !firstName &&
          !lastName &&
          !profileImage &&
          !summary &&
          !loanTypes &&
          !minFunding &&
          !maxFunding &&
          !statesSupported &&
          !industries &&
          !fundingSpeedDays
        ) {
          return reply.code(400).send({
            success: false,
            message: "Nothing to update",
          });
        }

        /* ===============================
           UPDATE USER ACCOUNT
        =============================== */
        const user = await prisma.userAccount.update({
          where: { id: req.user.userId },
          data: {
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(profileImage && { profileImage }),
          },
        });

        /* ===============================
           UPSERT LENDER PROFILE
        =============================== */
        const profileData = {
          ...(summary && { summary }),
          ...(loanTypes && { loanTypes }),
          ...(minFunding && { minFunding }),
          ...(maxFunding && { maxFunding }),
          ...(statesSupported && { statesSupported }),
          ...(industries && { industries }),
          ...(fundingSpeedDays && { fundingSpeedDays }),
        };

        let profileStatus = "INCOMPLETE";

        if (
          summary &&
          loanTypes?.length &&
          minFunding &&
          maxFunding &&
          statesSupported
        ) {
          profileStatus = "COMPLETED";
        }

        const lenderProfile = await prisma.lenderProfile.upsert({
          where: { lenderOrgId: req.user.organizationId },
          create: {
            lenderOrgId: req.user.organizationId,
            ...profileData,
            profileStatus,
            isVisible: profileStatus === "COMPLETED",
          },
          update: {
            ...profileData,
            profileStatus,
            isVisible: profileStatus === "COMPLETED",
          },
        });

        return reply.send({
          success: true,
          message: "Profile updated successfully",
          data: {
            user: {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              profileImage: user.profileImage,
            },
            lenderProfile,
          },
        });
      } catch (err) {
        console.error("UPDATE PROFILE ERROR:", err);
        return reply.code(500).send({
          success: false,
          message: "Failed to update profile",
        });
      }
    }
  );
}

module.exports = lenderUpdateProfileRoutes;
