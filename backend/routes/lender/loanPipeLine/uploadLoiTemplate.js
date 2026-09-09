const fs = require("fs");
const path = require("path");
const pump = require("pump");
const util = require("util");
const { validateFileMimetype } = require("../../../utils/security/fileValidator");

const pumpAsync = util.promisify(pump);

module.exports = async function (fastify) {
  fastify.post("/upload-loi-template", async (req, reply) => {
    const prisma = fastify.prisma;

    try {
      /* ===============================
         AUTH CHECK
      =============================== */
      if (!req.user || req.user.orgType !== "LENDER") {
        return reply.code(403).send({ message: "Unauthorized" });
      }

      const lenderOrgId = req.user.organizationId;

      const file = await req.file();

      if (!file) {
        return reply.code(400).send({ message: "File required" });
      }

      /* ===============================
         VALIDATION
      =============================== */
      const allowedMimeTypes = ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
      const validation = await validateFileMimetype(file.file, allowedMimeTypes);
      if (!validation.isValid) {
        return reply.code(400).send({
          message: `Invalid file type. Detected: ${validation.detectedMime || "unknown"}. Only .docx file allowed`,
        });
      }
      const validatedStream = validation.stream;

      /* ===============================
         CHECK EXISTING TEMPLATE
      =============================== */
      const existing = await prisma.lenderLoiTemplate.findUnique({
        where: { lenderOrgId },
      });

      /* ===============================
         DELETE OLD FILE FIRST
      =============================== */
      if (existing?.fileUrl) {
        try {
          const oldPath = path.join(
            process.cwd(),
            "public",
            existing.fileUrl.replace(/^\/+/, "")
          );

          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
          }
        } catch (err) {
          fastify.log.warn("Failed to delete old template:", err.message);
        }
      }

      /* ===============================
         SAVE NEW FILE
      =============================== */
      const fileName = `loi-${lenderOrgId}-${Date.now()}.docx`;

      const uploadDir = path.join(
        process.cwd(),
        "public",
        "lender",
        "templates"
      );

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, fileName);

      try {
        await pumpAsync(validatedStream, fs.createWriteStream(filePath));
      } catch (err) {
        fastify.log.error("File upload failed:", err);

        return reply.code(500).send({
          success: false,
          message: "File upload failed",
        });
      }

      const fileUrl = `/lender/templates/${fileName}`;

      /* ===============================
         DB UPSERT
      =============================== */
      let template;

      if (existing) {
        template = await prisma.lenderLoiTemplate.update({
          where: { lenderOrgId },
          data: { fileUrl, fileName },
        });
      } else {
        template = await prisma.lenderLoiTemplate.create({
          data: {
            lenderOrgId,
            fileUrl,
            fileName,
          },
        });
      }

      /* ===============================
         RESPONSE
      =============================== */
      return reply.send({
        success: true,
        message: "Template replaced successfully",
        template,
      });

    } catch (err) {
      fastify.log.error("Upload API error:", err);

      return reply.code(500).send({
        success: false,
        message: "Internal server error",
      });
    }
  });
};