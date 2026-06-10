const path = require("path");
const fs = require("fs");
const { pipeline } = require("stream/promises");
const {
  ensureLenderProfileFields,
} = require("../../../prisma/ensureLenderProfileFields");
const {
  pickExtendedFields,
  writeExtendedLenderProfileFields,
} = require("../../../services/lenderProfileExtendedFields");

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
        // ===============================
        // LENDER GUARD
        // ===============================
        if (!req.user || req.user.orgType !== "LENDER") {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        const parts = req.parts();

        // ===============================
        // USER FIELDS
        // ===============================
        let firstName;
        let lastName;
        let profileImage;

        // ===============================
        // LENDER PROFILE FIELDS
        // ===============================
        let summary;
        let loanTypes;
        let minFunding;
        let maxFunding;
        let statesSupported;
        let industries;
        let fundingSpeedDays;
        let lendingCriteria;
        let lendingGuidelines;
        let creditRequirements;
        let propertyRequirements;
        let organizationEmail;
        let organizationPhone;

        await ensureLenderProfileFields();

        for await (const part of parts) {
          // ===============================
          // HANDLE FIELDS
          // ===============================
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
                try {
                  loanTypes = JSON.parse(part.value);
                } catch {
                  return reply.code(400).send({
                    success: false,
                    message: "Invalid loanTypes format (must be JSON array)",
                  });
                }
                break;

              case "minFunding":
                minFunding = Number(part.value);
                break;

              case "maxFunding":
                maxFunding = Number(part.value);
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

              case "lendingCriteria":
                lendingCriteria = part.value;
                break;

              case "lendingGuidelines":
                lendingGuidelines = part.value;
                break;

              case "creditRequirements":
                creditRequirements = part.value;
                break;

              case "propertyRequirements":
                propertyRequirements = part.value;
                break;

              case "organizationEmail":
                organizationEmail = part.value;
                break;

              case "organizationPhone":
                organizationPhone = part.value;
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

            // Stream file safely (no buffer overload)
            await pipeline(part.file, fs.createWriteStream(filePath));

            profileImage = `/public/uploads/profile/${fileName}`;
          }
        }

        // ===============================
        // NOTHING TO UPDATE CHECK
        // ===============================
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
          !fundingSpeedDays &&
          lendingCriteria === undefined &&
          lendingGuidelines === undefined &&
          creditRequirements === undefined &&
          propertyRequirements === undefined &&
          organizationEmail === undefined &&
          organizationPhone === undefined
        ) {
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

        // ===============================
        // PREPARE PROFILE DATA
        // ===============================
        const extendedProfileFields = pickExtendedFields({
          lendingCriteria,
          lendingGuidelines,
          creditRequirements,
          propertyRequirements,
        });

        const profileData = {
          ...(summary !== undefined && summary !== null && { summary }),
          ...(loanTypes && { loanTypes }),
          ...(minFunding && { minFunding }),
          ...(maxFunding && { maxFunding }),
          ...(statesSupported !== undefined && { statesSupported }),
          ...(industries !== undefined && { industries }),
          ...(fundingSpeedDays && { fundingSpeedDays }),
        };

        if (organizationEmail || organizationPhone) {
          await prisma.organization.update({
            where: { id: req.user.organizationId },
            data: {
              ...(organizationEmail && { email: organizationEmail }),
              ...(organizationPhone && { phone: organizationPhone }),
            },
          });
        }

        // ===============================
        // PROFILE COMPLETION LOGIC
        // ===============================
        let profileStatus = "INCOMPLETE";

        if (
          summary &&
          Array.isArray(loanTypes) &&
          loanTypes.length > 0 &&
          minFunding &&
          maxFunding &&
          statesSupported
        ) {
          profileStatus = "COMPLETED";
        }

        // ===============================
        // UPSERT LENDER PROFILE
        // ===============================
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

        if (Object.keys(extendedProfileFields).length > 0) {
          await writeExtendedLenderProfileFields(
            req.user.organizationId,
            extendedProfileFields,
          );
        }

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
            lenderProfile: {
              ...lenderProfile,
              ...extendedProfileFields,
            },
          },
        });
      } catch (err) {
        console.error("UPDATE PROFILE ERROR:", err);

        return reply.code(500).send({
          success: false,
          message: err.message || "Failed to update profile",
        });
      }
    }
  );
}

module.exports = lenderUpdateProfileRoutes;