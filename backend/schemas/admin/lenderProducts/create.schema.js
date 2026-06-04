const { z } = require("zod");
const { LoanProductCode } = require("@prisma/client");

const loanProductEnum = z.nativeEnum(LoanProductCode);
const decimalField = z.union([z.string(), z.number()]).optional();

const businessTypeSchema = z.object({
  name: z.string(),
  subTypes: z.array(z.string()).optional(),
});

const propertyTypeSchema = z.object({
  type: z.string(),
  subTypes: z.array(z.string()).optional(),
});

const productSchema = z.object({
  loanProductCode: loanProductEnum,

  businessTypes: z.array(businessTypeSchema).optional(),
  propertyTypes: z.array(propertyTypeSchema).optional(),

  equipmentTypes: z.array(z.string()).optional(),
  otherEquipmentExplanation: z.string().optional(),

  minLoanAmount: decimalField,
  maxLoanAmount: decimalField,

  minTermMonths: z.number().int().nonnegative().optional(),
  maxTermMonths: z.number().int().nonnegative().optional(),

  maxLtvPercent: decimalField,
  maxArvPercent: decimalField,
  maxLtcPercent: decimalField,

  minCreditScore: z.number().int().nonnegative().optional(),
  minExperience: z.string().optional(),

  interestRateRange: z.string().optional(),

  statesSupported: z.array(z.string()).optional(),

  isActive: z.boolean().optional(),
});

const createLenderProductSchema = z
  .object({
    lenderOrgId: z.string().uuid(),

    loanProductCodes: z.array(loanProductEnum).optional(),
    products: z.array(productSchema).optional(),

    businessTypes: z.array(businessTypeSchema).optional(),
    propertyTypes: z.array(propertyTypeSchema).optional(),

    equipmentTypes: z.array(z.string()).optional(),
    otherEquipmentExplanation: z.string().optional(),

    minLoanAmount: decimalField,
    maxLoanAmount: decimalField,

    minTermMonths: z.number().int().nonnegative().optional(),
    maxTermMonths: z.number().int().nonnegative().optional(),

    maxLtvPercent: decimalField,
    maxArvPercent: decimalField,
    maxLtcPercent: decimalField,

    minCreditScore: z.number().int().nonnegative().optional(),
    minExperience: z.string().optional(),

    interestRateRange: z.string().optional(),

    statesSupported: z.array(z.string()).optional(),

    isActive: z.boolean().optional(),
  })
  .refine((data) => data.loanProductCodes || data.products, {
    message: "Either 'loanProductCodes' or 'products' must be provided",
    path: ["loanProductCodes"],
  });

module.exports = { createLenderProductSchema };
