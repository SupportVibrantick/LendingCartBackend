const {
  STORAGE_PROVIDER_KEY,
  resolveStorageProvider,
  invalidateStorageProviderCache,
  canUseS3,
  getStorageStatus,
} = require("../../../services/storage");

/**
 * @param {import("fastify").FastifyInstance} fastify
 */
module.exports = async function storageSettingsRoutes(fastify) {
  fastify.get("/storage", async (req, reply) => {
    try {
      const activeProvider = await resolveStorageProvider(fastify.prisma);
      const status = getStorageStatus();

      let dbOverride = null;
      const row = await fastify.prisma.platformConfig.findUnique({
        where: { key: STORAGE_PROVIDER_KEY },
        select: { value: true, updatedAt: true },
      });
      if (row?.value) {
        dbOverride = String(row.value).trim().toLowerCase();
      }

      return reply.send({
        success: true,
        data: {
          activeProvider,
          dbOverride,
          envProvider: status.envProvider,
          s3Configured: status.s3Configured,
          s3Bucket: status.s3Bucket,
          s3Region: status.s3Region,
          s3PublicBaseUrl: status.s3PublicBaseUrl,
          secretsFromEnv: status.secretsFromEnv,
          canSwitchToS3: canUseS3(),
          updatedAt: row?.updatedAt || null,
        },
      });
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({
        success: false,
        message: "Failed to load storage settings",
      });
    }
  });

  fastify.put("/storage", async (req, reply) => {
    try {
      const provider = String(req.body?.provider || "")
        .trim()
        .toLowerCase();

      if (provider !== "local" && provider !== "s3") {
        return reply.code(400).send({
          success: false,
          message: "provider must be 'local' or 's3'",
        });
      }

      if (provider === "s3" && !canUseS3()) {
        return reply.code(400).send({
          success: false,
          message:
            "S3 is not configured. Set S3_BUCKET and AWS_REGION (and credentials) in server environment first.",
        });
      }

      const updatedBy = req.user?.id || req.user?.userId || null;

      const row = await fastify.prisma.platformConfig.upsert({
        where: { key: STORAGE_PROVIDER_KEY },
        create: {
          key: STORAGE_PROVIDER_KEY,
          value: provider,
          updatedBy,
        },
        update: {
          value: provider,
          updatedBy,
        },
      });

      invalidateStorageProviderCache();

      const activeProvider = await resolveStorageProvider(fastify.prisma);

      return reply.send({
        success: true,
        message:
          provider === "s3"
            ? "New uploads will go to S3. Existing local files remain on disk."
            : "New uploads will go to local disk. Existing S3 files remain in the bucket.",
        data: {
          activeProvider,
          dbOverride: row.value,
          updatedAt: row.updatedAt,
        },
      });
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({
        success: false,
        message: "Failed to update storage settings",
      });
    }
  });
};
