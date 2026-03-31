// schemas/admin/lenderProducts/update.schema.js

const { z } = require("zod");
const { LoanProductCode } = require("@prisma/client");

const decimalField = z.union([z.string(), z.number()]).optional();

// -----------------------------
// Nested Schemas
// -----------------------------
const businessTypeSchema = z.object({
  name: z.string(),
  subTypes: z.array(z.string()),
});

const propertyTypeSchema = z.object({
  type: z.string(),
  subTypes: z.array(z.string()),
});

// -----------------------------
// Product Schema (UPSERT)
// -----------------------------
const productSchema = z.object({
  id: z.string().uuid().optional(), // update
  loanProductCode: z.nativeEnum(LoanProductCode).optional(), // create

  businessTypes: z.array(businessTypeSchema).optional(),
  propertyTypes: z.array(propertyTypeSchema).optional(),

  equipmentTypes: z.array(z.string()).optional(),
  otherEquipmentExplanation: z.string().optional(),

  minLoanAmount: decimalField,
  maxLoanAmount: decimalField,

  minTermMonths: z.number().int().nonnegative().optional(),
  maxTermMonths: z.number().int().nonnegative().optional(),

  minLtvPercent: decimalField,
  maxLtvPercent: decimalField,

  minCreditScore: z.number().int().nonnegative().optional(),

  // ✅ FIXED TYPE
  minExperience: z.union([z.string(), z.number()]).optional(),

  interestRateRange: z.string().optional(),

  // ✅ FIXED TYPE
  statesSupported: z.array(z.string()).optional(),

  isActive: z.boolean().optional(),
})
.refine((data) => data.id || data.loanProductCode, {
  message: "Either id or loanProductCode is required",
});

// -----------------------------
// Main Schema
// -----------------------------
const updateLenderProductSchema = z.object({
  lenderOrgId: z.string().uuid(),
  products: z.array(productSchema).min(1),
});

module.exports = { updateLenderProductSchema };