const path = require("path");
const fs = require("fs");
const { pipeline } = require("stream/promises");
const {
  ensureLenderProfileFields,
} = require("../../../prisma/ensureLenderProfileFields");
const {
  pickExtendedFields,
  writeExtendedLenderProfileFields,
  readExtendedLenderProfileFields,
} = require("../../../services/lender/lenderProfileExtendedFields");
const {
  syncProfileFundingToProducts,
} = require("../../../utils/lender/evaluateLenderEligibility");
const { hasLenderPermission, LENDER_PERMISSION } = require("../../../utils/lender/lenderPermissions");

async function readFieldValue(part) {
  if (part.value === undefined || part.value === null) {
    return "";
  }

  if (typeof part.value === "string") {
    return part.value;
  }

  if (Buffer.isBuffer(part.value)) {
    return part.value.toString("utf8");
  }

  if (typeof part.value.then === "function") {
    const resolved = await part.value;
    return resolved === undefined || resolved === null
      ? ""
      : String(resolved);
  }

  return String(part.value);
}

function parseOptionalNumber(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return undefined;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveProfileStatus(profile) {
  if (
    profile?.summary &&
    Array.isArray(profile.loanTypes) &&
    profile.loanTypes.length > 0 &&
    profile.minFunding &&
    profile.maxFunding &&
    profile.statesSupported
  ) {
    return "COMPLETED";
  }

  return "INCOMPLETE";
}

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
        consumes: ["multipart/form-data"],
      },
    },
    async (req, reply) => {
      const prisma = fastify.prisma;

      try {
        if (!req.user || req.user.orgType !== "LENDER") {
          return reply.code(403).send({
            success: false,
            message: "Lender access only",
          });
        }

        if (!hasLenderPermission(req.user, LENDER_PERMISSION.MANAGE_LENDER_PROFILE)) {
          return reply.code(403).send({
            success: false,
            message:
              "You do not have permission to update the lender profile.",
          });
        }

        const userId = req.user.userId || req.user.id;
        const organizationId = req.user.organizationId;

        if (!userId || !organizationId) {
          return reply.code(401).send({
            success: false,
            message: "Invalid auth context",
          });
        }

        const parts = req.parts();
        const sentFields = new Set();

        let firstName;
        let lastName;
        let profileImage;

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
        let website;
        let nmls;
        let address;
        let city;
        let state;
        let zip;
        let lenderType;

        await ensureLenderProfileFields();

        for await (const part of parts) {
          if (part.type === "field") {
            const value = await readFieldValue(part);

            switch (part.fieldname) {
              case "firstName":
                firstName = value;
                sentFields.add("firstName");
                break;

              case "lastName":
                lastName = value;
                sentFields.add("lastName");
                break;

              case "summary":
                summary = value;
                sentFields.add("summary");
                break;

              case "loanTypes":
                try {
                  loanTypes = JSON.parse(value);
                  sentFields.add("loanTypes");
                } catch {
                  return reply.code(400).send({
                    success: false,
                    message: "Invalid loanTypes format (must be JSON array)",
                  });
                }
                break;

              case "minFunding":
                minFunding = parseOptionalNumber(value);
                sentFields.add("minFunding");
                break;

              case "maxFunding":
                maxFunding = parseOptionalNumber(value);
                sentFields.add("maxFunding");
                break;

              case "statesSupported":
                statesSupported = value;
                sentFields.add("statesSupported");
                break;

              case "industries":
                industries = value;
                sentFields.add("industries");
                break;

              case "fundingSpeedDays":
                fundingSpeedDays = parseOptionalNumber(value);
                sentFields.add("fundingSpeedDays");
                break;

              case "lendingCriteria":
                lendingCriteria = value;
                sentFields.add("lendingCriteria");
                break;

              case "lendingGuidelines":
                lendingGuidelines = value;
                sentFields.add("lendingGuidelines");
                break;

              case "creditRequirements":
                creditRequirements = value;
                sentFields.add("creditRequirements");
                break;

              case "propertyRequirements":
                propertyRequirements = value;
                sentFields.add("propertyRequirements");
                break;

              case "organizationEmail":
                organizationEmail = value;
                sentFields.add("organizationEmail");
                break;

              case "organizationPhone":
                organizationPhone = value;
                sentFields.add("organizationPhone");
                break;

              case "website":
                website = value;
                sentFields.add("website");
                break;

              case "nmls":
                nmls = value;
                sentFields.add("nmls");
                break;

              case "address":
                address = value;
                sentFields.add("address");
                break;

              case "city":
                city = value;
                sentFields.add("city");
                break;

              case "state":
                state = value;
                sentFields.add("state");
                break;

              case "zip":
                zip = value;
                sentFields.add("zip");
                break;

              case "lenderType":
                lenderType = value;
                sentFields.add("lenderType");
                break;

              default:
                break;
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

        const extendedProfileFields = pickExtendedFields({
          lendingCriteria,
          lendingGuidelines,
          creditRequirements,
          propertyRequirements,
          website,
          nmls,
          address,
          city,
          state,
          zip,
          lenderType,
        });

        if (
          sentFields.size === 0 &&
          !profileImage &&
          Object.keys(extendedProfileFields).length === 0
        ) {
          return reply.code(400).send({
            success: false,
            message: "Nothing to update",
          });
        }

        const userData = {};
        if (sentFields.has("firstName")) {
          userData.firstName = firstName?.trim() || null;
        }
        if (sentFields.has("lastName")) {
          userData.lastName = lastName?.trim() || null;
        }
        if (profileImage) {
          userData.profileImage = profileImage;
        }

        let user = await prisma.userAccount.findUnique({
          where: { id: userId },
        });

        if (!user) {
          return reply.code(404).send({
            success: false,
            message: "User not found",
          });
        }

        if (Object.keys(userData).length > 0) {
          user = await prisma.userAccount.update({
            where: { id: userId },
            data: userData,
          });
        }

        const organizationData = {};
        if (sentFields.has("organizationEmail")) {
          organizationData.email = organizationEmail?.trim() || null;
        }
        if (sentFields.has("organizationPhone")) {
          organizationData.phone = organizationPhone?.trim() || null;
        }

        let organization = await prisma.organization.findUnique({
          where: { id: organizationId },
        });

        if (Object.keys(organizationData).length > 0) {
          organization = await prisma.organization.update({
            where: { id: organizationId },
            data: organizationData,
          });
        }

        const profileData = {};
        if (sentFields.has("summary")) {
          profileData.summary = summary?.trim() || null;
        }
        if (sentFields.has("loanTypes")) {
          profileData.loanTypes = Array.isArray(loanTypes) ? loanTypes : [];
        }
        if (sentFields.has("minFunding")) {
          profileData.minFunding = minFunding ?? null;
        }
        if (sentFields.has("maxFunding")) {
          profileData.maxFunding = maxFunding ?? null;
        }
        if (sentFields.has("statesSupported")) {
          profileData.statesSupported = statesSupported?.trim() || null;
        }
        if (sentFields.has("industries")) {
          profileData.industries = industries?.trim() || null;
        }
        if (sentFields.has("fundingSpeedDays")) {
          profileData.fundingSpeedDays = fundingSpeedDays ?? null;
        }

        const existingProfile = await prisma.lenderProfile.findUnique({
          where: { lenderOrgId: organizationId },
        });

        let lenderProfile = existingProfile;

        if (Object.keys(profileData).length > 0) {
          const mergedProfile = {
            summary: sentFields.has("summary")
              ? profileData.summary
              : existingProfile?.summary,
            loanTypes: sentFields.has("loanTypes")
              ? profileData.loanTypes
              : existingProfile?.loanTypes,
            minFunding: sentFields.has("minFunding")
              ? profileData.minFunding
              : existingProfile?.minFunding,
            maxFunding: sentFields.has("maxFunding")
              ? profileData.maxFunding
              : existingProfile?.maxFunding,
            statesSupported: sentFields.has("statesSupported")
              ? profileData.statesSupported
              : existingProfile?.statesSupported,
          };

          const profileStatus = resolveProfileStatus(mergedProfile);

          lenderProfile = await prisma.lenderProfile.upsert({
            where: { lenderOrgId: organizationId },
            create: {
              lenderOrgId: organizationId,
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
        }

        if (Object.keys(extendedProfileFields).length > 0) {
          await writeExtendedLenderProfileFields(
            organizationId,
            extendedProfileFields,
          );
        }

        if (
          lenderProfile &&
          (sentFields.has("minFunding") ||
            sentFields.has("maxFunding") ||
            sentFields.has("statesSupported"))
        ) {
          await syncProfileFundingToProducts(
            prisma,
            organizationId,
            lenderProfile,
          );
        }

        const extendedFields = await readExtendedLenderProfileFields(
          organizationId,
        );

        return reply.send({
          success: true,
          message: "Profile updated successfully",
          data: {
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              profileImage: user.profileImage,
            },
            organization: {
              id: organization.id,
              name: organization.name,
              email: organization.email,
              phone: organization.phone,
            },
            lenderProfile: lenderProfile
              ? {
                  summary: lenderProfile.summary,
                  loanTypes: lenderProfile.loanTypes,
                  minFunding: lenderProfile.minFunding,
                  maxFunding: lenderProfile.maxFunding,
                  statesSupported: lenderProfile.statesSupported,
                  industries: lenderProfile.industries,
                  fundingSpeedDays: lenderProfile.fundingSpeedDays,
                  lendingCriteria: extendedFields.lendingCriteria,
                  lendingGuidelines: extendedFields.lendingGuidelines,
                  creditRequirements: extendedFields.creditRequirements,
                  propertyRequirements: extendedFields.propertyRequirements,
                  website: extendedFields.website,
                  nmls: extendedFields.nmls,
                  address: extendedFields.address,
                  city: extendedFields.city,
                  state: extendedFields.state,
                  zip: extendedFields.zip,
                  lenderType: extendedFields.lenderType,
                  profileStatus: lenderProfile.profileStatus,
                  isVisible: lenderProfile.isVisible,
                  updatedAt: lenderProfile.updatedAt,
                }
              : {
                  ...extendedFields,
                  profileStatus: "DRAFT",
                  isVisible: false,
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
    },
  );
}

module.exports = lenderUpdateProfileRoutes;
