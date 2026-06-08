const { z } = require("zod");

const updateAdminUserSchema = z
  .object({
    firstName: z.string().min(2).optional(),
    lastName: z.string().min(2).optional().nullable(),
    email: z.string().email().optional(),
    accessLevel: z.enum(["FULL", "CUSTOM"]).optional(),
    permissions: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.accessLevel === "CUSTOM" && data.permissions !== undefined && data.permissions.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one permission for custom access",
        path: ["permissions"],
      });
    }
  });

module.exports = { updateAdminUserSchema };
