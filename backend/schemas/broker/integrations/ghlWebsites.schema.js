const { z } = require("zod");

const ghlWebsiteListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional().default(20),
  offset: z.coerce.number().int().min(0).max(10000).optional().default(0),
  name: z.string().trim().max(200).optional(),
});

const ghlWebsitePageListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional().default(20),
  offset: z.coerce.number().int().min(0).max(10000).optional().default(0),
  name: z.string().trim().max(200).optional(),
});

module.exports = {
  ghlWebsiteListQuerySchema,
  ghlWebsitePageListQuerySchema,
};
