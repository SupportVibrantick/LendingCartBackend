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

/* ================= Per-product Business / Industry Type options ================= */

/** SBA 7a Business Acquisition */
export const SBA_7A_ACQUISITION_BUSINESS_TYPES = [
  "Manufacturing",
  "Service",
  "Retail/Wholesale",
  "Franchises",
  "Professional Practices",
  "Hospitality",
] as const;

/** SBA 7a Working Capital */
export const SBA_7A_WORKING_CAPITAL_BUSINESS_TYPES = [
  "Manufacturing",
  "Service",
  "Retail/Wholesale",
  "Seasonal",
  "Export",
  "Construction",
] as const;

/** SBA 7a Equipment Purchase */
export const SBA_7A_EQUIPMENT_BUSINESS_TYPES = [
  "Manufacturing",
  "Construction",
  "Transportation",
  "Healthcare",
  "Restaurant",
  "Technology",
  "Agriculture",
  "Automotive",
] as const;

/** SBA 7a Real Estate */
export const SBA_7A_REAL_ESTATE_PROPERTY_TYPES = [
  "Manufacturing/Industrial",
  "Retail/Wholesale",
  "Service",
  "Hospitality",
  "Healthcare",
  "Automotive",
  "Childcare/Education",
  "Professional Practices",
] as const;

/** SBA 504 Real Estate */
export const SBA_504_REAL_ESTATE_PROPERTY_TYPES = [
  "Manufacturing/Industrial",
  "Healthcare",
  "Hospitality",
  "Retail/Wholesale",
  "Childcare/Education",
  "Energy/Automotive",
  "Professional Services",
  "Agriculture",
] as const;

/** USDA B&I */
export const USDA_BI_PROPERTY_TYPES = [
  "Agricultural Processing",
  "Rural Manufacturing",
  "Rural Healthcare",
  "Tourism/Hospitality",
  "Renewable Energy",
  "Food Processing",
  "Rural Warehousing",
  "Rural Retail",
  "Education/Training",
] as const;

/**
 * Map of loan product code -> business/property-type option list that is
 * shown in the "Business / Industry Type" select on the collateral step.
 *
 * - SBA 7a Acquisition/Working Capital/Equipment: business-style options.
 * - SBA 7a Real Estate / SBA 504 Real Estate / USDA B&I: property-style options.
 */
export const SBA_PROPERTY_TYPE_OPTIONS_BY_PRODUCT: Record<string, readonly string[]> = {
  [SBA_7A_ACQUISITION_LOAN_TYPE]: SBA_7A_ACQUISITION_BUSINESS_TYPES,
  [SBA_7A_WORKING_CAPITAL_LOAN_TYPE]: SBA_7A_WORKING_CAPITAL_BUSINESS_TYPES,
  [SBA_7A_EQUIPMENT_LOAN_TYPE]: SBA_7A_EQUIPMENT_BUSINESS_TYPES,
  [SBA_7A_REAL_ESTATE_LOAN_TYPE]: SBA_7A_REAL_ESTATE_PROPERTY_TYPES,
  [SBA_504_REAL_ESTATE_LOAN_TYPE]: SBA_504_REAL_ESTATE_PROPERTY_TYPES,
  [USDA_BI_LOAN_TYPE]: USDA_BI_PROPERTY_TYPES,
};

export const getSbaPropertyTypeOptions = (product: string) =>
  SBA_PROPERTY_TYPE_OPTIONS_BY_PRODUCT[product] || null;

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
