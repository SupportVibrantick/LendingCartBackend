/**
 * Smart /uploads/* proxy: serve from local disk first, then S3.
 * Keeps relative /uploads/... URLs working after switching providers.
 *
 * PDFs: sanitize LiveCycle / SBA templates so pdf.js and Chrome's viewer
 * can open them (production Celtic Bank forms otherwise show
 * "Invalid PDF structure").
 */

const path = require("path");
const {
  local,
  s3,
  canUseS3,
  keyFromFileUrl,
} = require("../../services/storage");
const {
  looksLikePdf,
  sanitizePdfBytes,
} = require("../../services/documents/signForm/pdfLoad");

const CONTENT_TYPES = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".jfif": "image/jpeg",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function contentTypeForKey(key) {
  const ext = path.extname(key).toLowerCase();
  return CONTENT_TYPES[ext] || "application/octet-stream";
}

function driverFor(provider) {
  return provider === "s3" ? s3 : local;
}

async function loadUploadBuffer(key) {
  if (await local.exists(key)) {
    return { buffer: await local.getBuffer(key), provider: "local" };
  }
  if (canUseS3() && (await s3.exists(key))) {
    return { buffer: await s3.getBuffer(key), provider: "s3" };
  }
  return null;
}

module.exports = async function storageProxyRoutes(fastify) {
  fastify.get("/uploads/*", async (req, reply) => {
    try {
      const wildcard = req.params["*"] || "";
      const key = keyFromFileUrl(`/uploads/${wildcard}`);
      if (!key || key.includes("..")) {
        return reply.code(400).send({ success: false, message: "Invalid path" });
      }

      const loaded = await loadUploadBuffer(key);
      if (!loaded) {
        return reply.code(404).send({ success: false, message: "File not found" });
      }

      let body = loaded.buffer;
      const type = contentTypeForKey(key);
      const isPdf = type === "application/pdf" || looksLikePdf(body);

      if (isPdf && looksLikePdf(body)) {
        try {
          const sanitized = await sanitizePdfBytes(body);
          const changed =
            sanitized.length !== body.length ||
            Buffer.compare(Buffer.from(body), sanitized) !== 0;
          if (changed) {
            body = sanitized;
            const driver = driverFor(loaded.provider);
            await driver
              .putBuffer({
                key,
                buffer: sanitized,
                contentType: "application/pdf",
              })
              .catch((err) => {
                req.log?.warn(
                  { err, key },
                  "Could not persist sanitized PDF template",
                );
              });
          }
        } catch (err) {
          req.log?.warn(
            { err, key },
            "PDF sanitize skipped; serving original bytes",
          );
        }
      }

      reply.header("Content-Type", isPdf ? "application/pdf" : type);
      reply.header("X-Content-Type-Options", "nosniff");
      reply.header("Cache-Control", "private, max-age=60, must-revalidate");
      if (isPdf) {
        reply.header(
          "Content-Disposition",
          `inline; filename="${path.basename(key)}"`,
        );
      }
      return reply.send(body);
    } catch (err) {
      req.log?.error({ err }, "storage proxy failed");
      return reply.code(err.statusCode || 500).send({
        success: false,
        message: err.message || "Failed to serve file",
      });
    }
  });
};
