const { z } = require("zod");

const uuidSchema = z.string().uuid();

const JoinConversationSchema = z.object({
  conversationId: uuidSchema,
});

const SendMessageSchema = z
  .object({
    conversationId: uuidSchema,
    type: z.enum(["TEXT", "FILE"]),
    text: z.string().trim().max(5000).optional(),
    fileUrl: z.string().url().max(2048).optional(),
    fileName: z.string().max(255).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "TEXT" && !data.text?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Text message cannot be empty",
        path: ["text"],
      });
    }

    if (data.type === "FILE" && !data.fileUrl) {
      ctx.addIssue({
        code: "custom",
        message: "File URL is required",
        path: ["fileUrl"],
      });
    }
  });

const MarkAsReadSchema = z.object({
  conversationId: uuidSchema,
});

function parseSocketPayload(schema, payload) {
  const result = schema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const message = result.error.issues[0]?.message || "Invalid payload";
  return { success: false, message };
}

module.exports = {
  JoinConversationSchema,
  SendMessageSchema,
  MarkAsReadSchema,
  parseSocketPayload,
};
