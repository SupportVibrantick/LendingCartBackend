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

type GroupedKeyField = "type" | "name";

export function normalizeGroupedSelectionFromApi(
  value: unknown,
  keyField: GroupedKeyField,
): Record<string, string[]> {
  if (!value) {
    return {};
  }

  if (typeof value === "string") {
    try {
      return normalizeGroupedSelectionFromApi(JSON.parse(value), keyField);
    } catch {
      return {};
    }
  }

  if (Array.isArray(value)) {
    return value.reduce<Record<string, string[]>>((acc, item) => {
      if (!item || typeof item !== "object") {
        return acc;
      }

      const record = item as Record<string, unknown>;
      const key = record[keyField];
      const list = Array.isArray(record.subTypes)
        ? record.subTypes.filter(
            (subType): subType is string =>
              typeof subType === "string" && subType.trim().length > 0,
          )
        : [];

      if (typeof key === "string" && key.trim()) {
        acc[key] = [...new Set([...(acc[key] || []), ...list])];
      }

      return acc;
    }, {});
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce<
      Record<string, string[]>
    >((acc, [key, list]) => {
      if (!key) {
        return acc;
      }

      acc[key] = Array.isArray(list)
        ? list.filter(
            (item): item is string =>
              typeof item === "string" && item.trim().length > 0,
          )
        : [];

      return acc;
    }, {});
  }

  return {};
}

export function mergeGroupedSelections(
  ...maps: Record<string, string[]>[]
): Record<string, string[]> {
  return maps.reduce<Record<string, string[]>>((acc, map) => {
    Object.entries(map || {}).forEach(([key, list]) => {
      acc[key] = [...new Set([...(acc[key] || []), ...(list || [])])];
    });
    return acc;
  }, {});
}

export function mapToLenderProductUpdatePayload(
  product: ProductRef,
  form: LenderProductFormSlice,
  criteria: Record<string, any>,
) {
  const built = buildLenderProductCriteriaPayload(criteria, product.code);

  return {
    loanProductCode: product.code,
    businessTypes: form.businessTypes,
    propertyTypes: form.propertyTypes,
    ...built,
    ...(product.code === "EQUIPMENT_FINANCE" &&
      form.equipmentFinance?.length && {
        equipmentTypes: form.equipmentFinance,
        otherEquipmentExplanation: "",
      }),
    statesSupported: built.statesSupported ?? [],
    isActive: true,
  };
}
