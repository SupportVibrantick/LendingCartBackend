const { z } = require("zod");

const ghlContactWriteSchema = z
  .object({
    firstName: z.string().trim().max(120).optional(),
    lastName: z.string().trim().max(120).optional(),
    email: z.string().trim().email().max(320).optional(),
    phone: z.string().trim().max(40).optional(),
    companyName: z.string().trim().max(200).optional(),
    source: z.string().trim().max(120).optional(),
    tags: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  })
  .superRefine((data, ctx) => {
    const isCreate = !ctx.path.length;
    void isCreate;
  });

const ghlContactCreateSchema = ghlContactWriteSchema.superRefine((data, ctx) => {
  if (!data.email && !data.phone) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "email or phone is required",
      path: ["email"],
    });
  }
});

const ghlContactUpdateSchema = ghlContactWriteSchema;

const ghlContactListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  query: z.string().trim().max(200).optional(),
  startAfterId: z.string().trim().max(120).optional(),
});

module.exports = {
  ghlContactCreateSchema,
  ghlContactUpdateSchema,
  ghlContactListQuerySchema,
};
