// schemas/admin/lenderProducts/update.schema.js

const { z } = require("zod");
const { LoanProductCode } = require("@prisma/client");

// -----------------------------
// Common
// -----------------------------
const decimalField = z.union([z.string(), z.number()]).optional();

// -----------------------------
// Nested Schemas (JSON fields)
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
const productSchema = z
  .object({
    // ✅ UPDATE
    id: z.string().uuid().optional(),

    // ✅ CREATE
    loanProductCode: z.nativeEnum(LoanProductCode).optional(),

    // JSON fields
    businessTypes: z.array(businessTypeSchema).optional(),
    propertyTypes: z.array(propertyTypeSchema).optional(),

    // Equipment
    equipmentTypes: z.array(z.string()).optional(),
    otherEquipmentExplanation: z.string().optional(),

    // Financial
    minLoanAmount: decimalField,
    maxLoanAmount: decimalField,

    minTermMonths: z.number().int().nonnegative().optional(),
    maxTermMonths: z.number().int().nonnegative().optional(),

    minLtvPercent: decimalField,
    maxLtvPercent: decimalField,

    minCreditScore: z.number().int().nonnegative().optional(),

    // ✅ Important fix
    minExperience: z.union([z.string(), z.number()]).optional(),

    interestRateRange: z.string().optional(),

    // ✅ Array (will convert to CSV in controller)
    statesSupported: z.array(z.string()).optional(),

    isActive: z.boolean().optional(),
  })
  .refine((data) => data.id || data.loanProductCode, {
    message: "Either id (update) or loanProductCode (create) is required",
  });

// -----------------------------
// Main Schema
// -----------------------------
const updateLenderProductSchema = z.object({
  lenderOrgId: z.string().uuid(),

  // ✅ REQUIRED (matches your API)
  products: z.array(productSchema).min(1),
});

module.exports = { updateLenderProductSchema };