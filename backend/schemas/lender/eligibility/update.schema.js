const { z } = require("zod");

const updateRuleSchema = z.object({
  fieldName: z.string().optional(),
  comparisonOperator: z.enum([
    "GT",
    "GTE",
    "LT",
    "LTE",
    "EQ",
    "NEQ",
    "IN",
    "NOT_IN",
  ]).optional(),
  value: z.string().optional(),
  severity: z.enum(["HARD_FAIL", "SOFT_FAIL"]).optional(),
  message: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

module.exports = {
  updateRuleSchema,
};
