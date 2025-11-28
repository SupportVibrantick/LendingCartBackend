const { z } = require("zod");

const createBrokerSchema = z.object({
  organizationName: z.string(),
  organizationEmail: z.string().email().optional(),
  organizationPhone: z.string().optional(),
  adminFirstName: z.string(),
  adminLastName: z.string().optional(),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8)
});


module.exports = { createBrokerSchema };
