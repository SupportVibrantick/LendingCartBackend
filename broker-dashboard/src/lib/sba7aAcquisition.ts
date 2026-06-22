export const SBA_7A_ACQUISITION_LOAN_TYPE = "SBA_7A_BUSINESS_ACQUISITION";
export const SBA_7A_WORKING_CAPITAL_LOAN_TYPE = "SBA_7A_WORKING_CAPITAL";
export const SBA_7A_EQUIPMENT_LOAN_TYPE = "SBA_7A_EQUIPMENT_PURCHASE";
export const SBA_7A_REAL_ESTATE_LOAN_TYPE = "SBA_7A_REAL_ESTATE";
export const SBA_504_REAL_ESTATE_LOAN_TYPE = "SBA_504_REAL_ESTATE_AND_EQUIPMENT";
export const USDA_BI_LOAN_TYPE = "USDA_BI";

export const SBA_BASE44_LOAN_TYPES = new Set([
  SBA_7A_ACQUISITION_LOAN_TYPE,
  SBA_7A_WORKING_CAPITAL_LOAN_TYPE,
  SBA_7A_EQUIPMENT_LOAN_TYPE,
  SBA_7A_REAL_ESTATE_LOAN_TYPE,
  SBA_504_REAL_ESTATE_LOAN_TYPE,
  USDA_BI_LOAN_TYPE,
]);

/** SBA/USDA products that use Property Type (not business industry) on the property step. */
export const SBA_REAL_ESTATE_COLLATERAL_LOAN_TYPES = new Set([
  SBA_7A_REAL_ESTATE_LOAN_TYPE,
  SBA_504_REAL_ESTATE_LOAN_TYPE,
  USDA_BI_LOAN_TYPE,
]);

/** SBA products that use Business / Industry Type on the property step. */
export const SBA_7A_BUSINESS_COLLATERAL_LOAN_TYPES = new Set([
  SBA_7A_ACQUISITION_LOAN_TYPE,
  SBA_7A_WORKING_CAPITAL_LOAN_TYPE,
  SBA_7A_EQUIPMENT_LOAN_TYPE,
]);

export const isSba7aAcquisitionProduct = (product: string) =>
  product === SBA_7A_ACQUISITION_LOAN_TYPE;

export const isSba7aWorkingCapitalProduct = (product: string) =>
  product === SBA_7A_WORKING_CAPITAL_LOAN_TYPE;

export const isSba7aEquipmentProduct = (product: string) =>
  product === SBA_7A_EQUIPMENT_LOAN_TYPE;

export const isSba7aRealEstateProduct = (product: string) =>
  product === SBA_7A_REAL_ESTATE_LOAN_TYPE;

export const isSba504RealEstateProduct = (product: string) =>
  product === SBA_504_REAL_ESTATE_LOAN_TYPE;

export const isUsdaBiProduct = (product: string) => product === USDA_BI_LOAN_TYPE;

export const isSbaRealEstateCollateralProduct = (product: string) =>
  SBA_REAL_ESTATE_COLLATERAL_LOAN_TYPES.has(product);

export const isSba7aBusinessCollateralProduct = (product: string) =>
  SBA_7A_BUSINESS_COLLATERAL_LOAN_TYPES.has(product);

export const isSbaBase44Product = (product: string) =>
  SBA_BASE44_LOAN_TYPES.has(product);

export const SBA_BUSINESS_INDUSTRY_TYPES = [
  "Retail",
  "Restaurant / Food Service",
  "Healthcare / Medical",
  "Professional Services",
  "Manufacturing",
  "Construction",
  "Transportation / Logistics",
  "Technology / Software",
  "Hospitality / Hotel",
  "Automotive",
  "Wholesale / Distribution",
  "Education",
  "Real Estate Services",
  "Personal Services",
  "Other",
] as const;

export type SbaEntityFields = {
  naicsCode: string;
  goodwillAmount: string;
  inventoryIncluded: boolean;
  inventoryValue: string;
  equipmentIncluded: boolean;
  equipmentValue: string;
};

export const createSbaEntityDefaults = (): SbaEntityFields => ({
  naicsCode: "",
  goodwillAmount: "",
  inventoryIncluded: false,
  inventoryValue: "",
  equipmentIncluded: false,
  equipmentValue: "",
});
