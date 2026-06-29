import { buildLenderProductCriteriaPayload } from "./loanProductCriteriaFields";

type ProductRef = {
  id: string;
  code: string;
};

type LenderProductFormSlice = {
  businessTypes: Record<string, string[]>;
  propertyTypes: Record<string, string[]>;
  equipmentFinance: string[];
};

export function mapToAdminProductPayload(
  product: ProductRef,
  form: LenderProductFormSlice,
  criteria: Record<string, any>,
  existingLenderProductId?: string,
) {
  const built = buildLenderProductCriteriaPayload(criteria, product.code);

  return {
    ...(existingLenderProductId
      ? { id: existingLenderProductId }
      : { loanProductCode: product.code }),
    businessTypes: Object.entries(form.businessTypes || {}).map(
      ([name, subTypes]) => ({
        name,
        subTypes: Array.isArray(subTypes) ? subTypes : [],
      }),
    ),
    propertyTypes: Object.entries(form.propertyTypes || {}).map(
      ([type, subTypes]) => ({
        type,
        subTypes: Array.isArray(subTypes) ? subTypes : [],
      }),
    ),
    ...built,
    documents: (criteria.documents || []).map((doc: any) => ({
      documentTypeId: doc.documentTypeId || doc.id,
    })),
    ...(product.code === "EQUIPMENT_FINANCE" &&
      form.equipmentFinance?.length && {
        equipmentTypes: form.equipmentFinance,
        otherEquipmentExplanation: "",
      }),
    statesSupported: built.statesSupported ?? [],
    isActive: true,
  };
}
