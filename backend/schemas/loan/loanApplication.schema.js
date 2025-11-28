// schemas/loan/loanApplication.schema.js
const { z } = require("zod");

const financialSchema = z.object({
  annualRevenue: z.number().nonnegative().optional(),
  netIncome: z.number().optional(),
  ebitda: z.number().optional(),
  totalDebt: z.number().optional(),
  dscr: z.number().optional()
});

const collateralSchema = z.object({
  collateralType: z.string(),
  description: z.string().optional(),
  valueEstimated: z.number().optional(),
  lienPosition: z.string().optional()
});

const loanApplicationSchema = z.object({
  applicationNumber: z.string().optional(),
  brokerOrgId: z.string().uuid(),
  brokerUserId: z.string().uuid().optional(),
  clientId: z.string().uuid(),
  loanProductCode: z.enum(["SBA","USDA","BRIDGE","DSCR","CONSTRUCTION","EQUIPMENT","ASSET_BASED","AR_AP","PO_FINANCE"]),
  amountRequested: z.number().positive(),
  termMonthsRequested: z.number().int().positive().optional(),
  purpose: z.string().optional(),
  financials: financialSchema.optional(),
  collaterals: z.array(collateralSchema).optional()
});

module.exports = { loanApplicationSchema };
