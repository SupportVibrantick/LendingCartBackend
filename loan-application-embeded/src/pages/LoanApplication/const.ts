// Re-export barrel for the supporting modules of the LoanApplication page.
// The legacy inlined `const.ts` has been split into the sibling modules
// (types, constants, productRules, formatters). This file exists so the
// existing `import { ... } from "./const"` call sites in LoanApplication.tsx
// keep working without further refactor.

export * from "./types";
export * from "./constants";
export * from "./productRules";
export * from "./formatters";

// Re-export step label from validation so consumers can keep importing it
// from "./const" if they prefer.
export { CO_BROKER_BORROWER_INFO_STEP } from "./types";
