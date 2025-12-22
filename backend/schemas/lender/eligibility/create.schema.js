const { z } = require("zod");

const createRuleSchema = z.object({
  ruleSetId: z.string().uuid(),

  fieldName: z.string().min(1), 
  // e.g. "dscr", "annualRevenue", "amountRequested", "region"

  comparisonOperator: z.enum([
    "GT",
    "GTE",
    "LT",
    "LTE",
    "EQ",
    "NEQ",
    "IN",
    "NOT_IN",
  ]),

  value: z.string().min(1),
  // Stored as string intentionally (parsed later in engine)

  severity: z.enum(["HARD_FAIL", "SOFT_FAIL"]),

  message: z.string().optional(),

  sortOrder: z.number().int().optional(),
});

module.exports = {
  createRuleSchema,
};
