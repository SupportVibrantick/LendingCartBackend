/**
 * Smart /uploads/* proxy: serve from local disk first, then S3.
 * Keeps relative /uploads/... URLs working after switching providers.
 */

const path = require("path");
const { local, s3, canUseS3, keyFromFileUrl } = require("../../services/storage");

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

module.exports = async function storageProxyRoutes(fastify) {
  fastify.get("/uploads/*", async (req, reply) => {
    try {
      const wildcard = req.params["*"] || "";
      const key = keyFromFileUrl(`/uploads/${wildcard}`);
      if (!key || key.includes("..")) {
        return reply.code(400).send({ success: false, message: "Invalid path" });
      }

      if (await local.exists(key)) {
        const stream = await local.getStream(key);
        reply.header("Content-Type", contentTypeForKey(key));
        reply.header("Cache-Control", "private, max-age=300");
        return reply.send(stream);
      }

      if (canUseS3() && (await s3.exists(key))) {
        const stream = await s3.getStream(key);
        reply.header("Content-Type", contentTypeForKey(key));
        reply.header("Cache-Control", "private, max-age=300");
        return reply.send(stream);
      }

      return reply.code(404).send({ success: false, message: "File not found" });
    } catch (err) {
      req.log?.error({ err }, "storage proxy failed");
      return reply.code(err.statusCode || 500).send({
        success: false,
        message: err.message || "Failed to serve file",
      });
    }
  });
};
