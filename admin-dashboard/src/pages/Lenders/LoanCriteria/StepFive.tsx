import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  Search,
  Settings,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getCriteriaFieldsForProduct,
  getCriteriaFieldInputSuffix,
  isSba7aBusinessAcquisitionProduct,
  isSbaExpressProduct,
  isEquipmentFinanceProduct,
  isArFactoringProduct,
  isApSupplyChainProduct,
  isPurchaseOrderFinanceProduct,
  isSba7aWorkingCapitalProduct,
  isSba7aRealEstateProduct,
  isSba7aEquipmentPurchaseProduct,
  isSba504Product,
  isUsdaBiProduct,
  productUsesAcceptedPropertyTypes,
  productUsesBusinessTypes,
  productUsesEquipmentTypes,
  type CriteriaField,
} from "../../../lib/loanProductCriteriaFields";
import {
  formatNumberInputValue,
  sanitizeNumberInput,
  stripNumberFormatting,
} from "../../../lib/numberInputFormat";
import ProgramEligibilitySection from "./ProgramEligibilitySection";

const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];

const API_BASE =
  import.meta.env.VITE_API_BASE || "https://api.loanautomation.ai";

const getColor = (name: string) => {
  const colors = [
    "bg-orange-500",
    "bg-green-500",
    "bg-blue-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-yellow-500",
    "bg-indigo-500",
    "bg-teal-500",
    "bg-red-500",
    "bg-cyan-500",
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};

const DOCUMENT_LIMIT = 12;

type DocumentPagination = {
  page: number;
  totalPages: number;
  total: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type ProductDocumentState = {
  search: string;
  debouncedSearch: string;
  customDocumentName: string;
  page: number;
  documents: any[];
  pagination: DocumentPagination;
  loading: boolean;
  sectionOpen: boolean;
};

type StepFiveProps = {
  products: any[];
  value: Record<string, any>;
  setValue: (val: Record<string, any>) => void;
  setHasErrors?: (hasErrors: boolean) => void;
  mode?: "create" | "update";
  authMode?: "admin" | "lender";
  lenderProductIdByProgramId?: Record<string, string>;
  propertyTypes?: Record<string, string[]>;
  setPropertyTypes?: (next: Record<string, string[]>) => void;
  businessTypes?: Record<string, string[]>;
  setBusinessTypes?: (next: Record<string, string[]>) => void;
  equipmentTypes?: string[];
  setEquipmentTypes?: (next: string[]) => void;
};

const createDefaultDocumentState = (): ProductDocumentState => ({
  search: "",
  debouncedSearch: "",
  customDocumentName: "",
  page: 1,
  documents: [],
  pagination: {
    page: 1,
    totalPages: 1,
    total: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  },
  loading: false,
  sectionOpen: false,
});

const normalizePagination = (
  json: any,
  page: number,
  limit: number,
): DocumentPagination => {
  if (json?.pagination) {
    return {
      page: Number(json.pagination.page || page),
      totalPages: Number(json.pagination.totalPages || 1),
      total: Number(json.pagination.total || 0),
      hasNextPage: Boolean(json.pagination.hasNextPage),
      hasPreviousPage: Boolean(json.pagination.hasPreviousPage),
    };
  }

  const meta = json?.meta || {};
  const total = Number(meta.total || 0);
  const pageSize = Number(meta.limit || limit);
  const pageNum = Number(meta.page || page);
  const totalPages = Math.max(1, Math.ceil(total / Math.max(pageSize, 1)));

  return {
    page: pageNum,
    totalPages,
    total,
    hasNextPage: pageNum < totalPages,
    hasPreviousPage: pageNum > 1,
  };
};

const StepFive = ({
  products,
  value,
  setValue,
  setHasErrors,
  mode = "create",
  authMode = "admin",
  lenderProductIdByProgramId = {},
  propertyTypes = {},
  setPropertyTypes,
  businessTypes = {},
  setBusinessTypes,
  equipmentTypes = [],
  setEquipmentTypes,
}: StepFiveProps) => {
  const getProductKey = (product: { id: string | number }) =>
    String(product.id);
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [errors, setErrors] = useState<any>({});
  const [docStateByProduct, setDocStateByProduct] = useState<
    Record<string, ProductDocumentState>
  >({});

  const getAuthToken = () => {
    const tokenKey = authMode === "admin" ? "admin_token" : "lender_token";
    return sessionStorage.getItem(tokenKey);
  };

  const getDocState = (productId: string): ProductDocumentState =>
    docStateByProduct[productId] ?? createDefaultDocumentState();

  const patchDocState = (
    productId: string,
    patch: Partial<ProductDocumentState>,
  ) => {
    setDocStateByProduct((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] ?? createDefaultDocumentState()),
        ...patch,
      },
    }));
  };

  const fetchDocuments = async (
    productId: string,
    page: number,
    search: string,
    options?: { all?: boolean },
  ) => {
    try {
      const token = getAuthToken();
      const product = products.find(
        (item: any) => String(item.id) === String(productId),
      );

      const params = new URLSearchParams();

      if (options?.all && authMode === "lender") {
        params.set("all", "true");
      } else {
        params.set("page", String(page));
        params.set(
          "limit",
          String(options?.all ? Math.max(DOCUMENT_LIMIT, 500) : DOCUMENT_LIMIT),
        );
      }

      if (search.trim()) {
        params.append("search", search.trim());
      }

      if (product?.id) {
        params.append("loanProductId", String(product.id));
      }
      if (product?.code) {
        params.append("loanProductCode", String(product.code));
      }

      if (authMode === "admin") {
        params.set("isActive", "true");
        params.set("source", "admin");
      }

      const endpoint =
        authMode === "admin"
          ? `${API_BASE}/admin/document-types/read?${params.toString()}`
          : `${API_BASE}/document-types/active?${params.toString()}`;

      const res = await fetch(endpoint, {
        headers: {
          "Content-Type": "application/json",
          ...(token && {
            Authorization: `Bearer ${token}`,
          }),
        },
      });

      const json = await res.json();

      if (json.success) {
        return {
          documents: json.data || [],
          pagination: normalizePagination(json, page, DOCUMENT_LIMIT),
        };
      }

      if (json.message) {
        toast.error(json.message);
      }
      return null;
    } catch (err) {
      console.error(err);
      toast.error("Failed to load documents");
      return null;
    }
  };

  const loadDocumentsForProduct = async (
    productId: string,
    page: number,
    search: string,
  ) => {
    patchDocState(productId, { loading: true });
    const result = await fetchDocuments(productId, page, search);
    if (result) {
      patchDocState(productId, {
        documents: result.documents,
        pagination: result.pagination,
        page,
        loading: false,
      });
    } else {
      patchDocState(productId, { loading: false });
    }
  };

  const toggleDocument = (productId: string, doc: any) => {
    const currentDocs = value?.[productId]?.documents || [];

    const exists = currentDocs.some(
      (d: any) => d.id === doc.id || d.documentTypeId === doc.id,
    );

    const updated = exists
      ? currentDocs.filter(
          (d: any) => d.id !== doc.id && d.documentTypeId !== doc.id,
        )
      : [...currentDocs, doc];

    handleChange(productId, "documents", updated);
  };

  const addCustomDocument = async (productId: string) => {
    const docState = getDocState(productId);
    const customName = docState.customDocumentName.trim();
    const product = products.find(
      (item: any) => String(item.id) === String(productId),
    );
    const lenderProductId =
      lenderProductIdByProgramId?.[String(productId)] ||
      lenderProductIdByProgramId?.[productId] ||
      "";

    if (!customName) {
      toast.error("Please enter custom document name");
      return;
    }

    if (customName.length < 2) {
      toast.error("Custom document name must be at least 2 characters");
      return;
    }

    if (!product?.id && !product?.code) {
      toast.error("Please select a loan product first");
      return;
    }

    if (authMode === "admin" && !product?.id) {
      toast.error("Please select a loan product first");
      return;
    }

    try {
      patchDocState(productId, { loading: true });
      const token = getAuthToken();
      const authHeaders = {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      };

      let createdDocType: any = null;

      if (authMode === "admin") {
        const res = await fetch(`${API_BASE}/admin/document-types/create`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            name: customName,
            loanProductId: String(product.id),
            isRequired: true,
            isActive: true,
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) {
          throw new Error(json?.message || "Failed to add custom document");
        }

        createdDocType = json?.data;
      } else if (lenderProductId) {
        const res = await fetch(`${API_BASE}/lender/document-config/create`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            lenderProductId,
            customDocumentName: customName,
            isRequired: true,
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) {
          throw new Error(json?.message || "Failed to add custom document");
        }

        createdDocType = {
          id: json?.data?.documentTypeId || json?.data?.documentType?.id,
          name: json?.data?.documentName || customName,
          isCustom: true,
        };
      } else {
        const res = await fetch(
          `${API_BASE}/lender/document-config/create-custom-document-type`,
          {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              name: customName,
              ...(product?.id ? { loanProductId: String(product.id) } : {}),
              ...(product?.code
                ? { loanProductCode: String(product.code) }
                : {}),
            }),
          },
        );

        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) {
          throw new Error(json?.message || "Failed to add custom document");
        }

        createdDocType = json?.data;
      }

      if (!createdDocType?.id) {
        throw new Error("Custom document was created but no id was returned");
      }

      const selectedDocs = value?.[productId]?.documents || [];
      const alreadySelected = selectedDocs.some(
        (d: any) =>
          d.id === createdDocType?.id ||
          d.documentTypeId === createdDocType?.id,
      );

      const customDoc = {
        id: createdDocType.id,
        documentTypeId: createdDocType.id,
        name: createdDocType.name || customName,
        isCustom: true,
      };

      if (!alreadySelected) {
        handleChange(productId, "documents", [...selectedDocs, customDoc]);
      }

      patchDocState(productId, {
        customDocumentName: "",
        page: 1,
      });
      await loadDocumentsForProduct(productId, 1, docState.search);
      toast.success("Custom document added");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Failed to add custom document");
    } finally {
      patchDocState(productId, { loading: false });
    }
  };

  const selectAllDocuments = async (productId: string) => {
    const { search } = getDocState(productId);

    try {
      patchDocState(productId, { loading: true });

      const result = await fetchDocuments(productId, 1, search, { all: true });

      if (result) {
        handleChange(productId, "documents", result.documents);
        toast.success(`${result.documents.length} documents selected`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to select documents");
    } finally {
      patchDocState(productId, { loading: false });
    }
  };

  const clearDocuments = (productId: string) => {
    handleChange(productId, "documents", []);
  };

  const handleChange = (productId: string, key: string, val: any) => {
    const current = value || {};

    const updated = {
      ...current,
      [productId]: {
        ...current?.[productId],
        [key]: val,
      },
    };

    setValue(updated);
  };

  const toggleState = (productId: string, state: string) => {
    const currentStates = value?.[productId]?.states || [];

    const updatedStates = currentStates.includes(state)
      ? currentStates.filter((s: string) => s !== state)
      : [...currentStates, state];

    handleChange(productId, "states", updatedStates);

    setErrors((prev: any) => ({
      ...prev,
      [productId]: {
        ...prev?.[productId],
        states:
          updatedStates.length === 0
            ? "Please select at least one state where lending is available"
            : "",
      },
    }));
  };

  const selectAllStates = (productId: string) => {
    handleChange(productId, "states", US_STATES);

    setErrors((prev: any) => ({
      ...prev,
      [productId]: {
        ...prev?.[productId],
        states: "",
      },
    }));
  };

  const clearStates = (productId: string) => {
    handleChange(productId, "states", []);

    setErrors((prev: any) => ({
      ...prev,
      [productId]: {
        ...prev?.[productId],
        states: "Please select at least one state where lending is available",
      },
    }));
  };

  const parseNumericValue = (input: unknown) =>
    Number(stripNumberFormatting(String(input ?? "")));

  const validateField = (
    productId: string,
    key: string,
    val: any,
    options?: { required?: boolean },
  ) => {
    const current = value?.[productId] || {};
    const isRequired = options?.required !== false;

    if (val === "" || val === null || val === undefined) {
      return isRequired ? "This field is required" : "";
    }

    const numVal = parseNumericValue(val);

    if (numVal < 0) {
      return "Value cannot be negative";
    }

    if (key === "minLoan" && current.maxLoan) {
      if (numVal > Number(current.maxLoan)) {
        return "Minimum loan amount cannot exceed maximum loan amount";
      }
    }

    if (key === "maxLoan" && current.minLoan) {
      if (numVal < Number(current.minLoan)) {
        return "Maximum loan amount cannot be less than minimum loan amount";
      }
    }

    if (key === "minFacilitySize" && current.maxFacilitySize) {
      if (numVal > Number(current.maxFacilitySize)) {
        return "Minimum facility size cannot exceed maximum facility size";
      }
    }

    if (key === "maxFacilitySize" && current.minFacilitySize) {
      if (numVal < Number(current.minFacilitySize)) {
        return "Maximum facility size cannot be less than minimum facility size";
      }
    }

    if (key === "minProgramSize" && current.maxProgramSize) {
      if (numVal > Number(current.maxProgramSize)) {
        return "Minimum program size cannot exceed maximum program size";
      }
    }

    if (key === "maxProgramSize" && current.minProgramSize) {
      if (numVal < Number(current.minProgramSize)) {
        return "Maximum program size cannot be less than minimum program size";
      }
    }

    if (key === "minProperties" && current.maxProperties) {
      if (numVal > Number(current.maxProperties)) {
        return "Minimum properties cannot exceed maximum properties";
      }
    }

    if (key === "maxProperties" && current.minProperties) {
      if (numVal < Number(current.minProperties)) {
        return "Maximum properties cannot be less than minimum properties";
      }
    }

    if (key === "minRate" && current.maxRate) {
      if (numVal > Number(current.maxRate)) {
        return "Minimum interest rate cannot exceed maximum rate";
      }
    }

    if (key === "maxRate" && current.minRate) {
      if (numVal < Number(current.minRate)) {
        return "Maximum interest rate cannot be less than minimum rate";
      }
    }

    if (key === "minTerm" && current.maxTerm) {
      if (numVal > Number(current.maxTerm)) {
        return "Minimum term cannot exceed maximum term";
      }
    }

    if (key === "maxTerm" && current.minTerm) {
      if (numVal < Number(current.minTerm)) {
        return "Maximum term cannot be less than minimum term";
      }
    }

    if (
      key === "minLtv" ||
      key === "maxLtv" ||
      key === "maxArv" ||
      key === "maxLtc" ||
      key === "mezzLtvMin" ||
      key === "mezzLtvMax"
    ) {
      if (numVal > 100) {
        if (key === "minLtv") {
          return "Min LTV cannot exceed 100%";
        }

        if (key === "maxLtv") {
          return "LTV cannot exceed 100%";
        }

        if (key === "maxArv") {
          return "ARV cannot exceed 100%";
        }

        if (key === "maxLtc") {
          return "LTC cannot exceed 100%";
        }

        if (key === "mezzLtvMin" || key === "mezzLtvMax") {
          return "Mezz LTV cannot exceed 100%";
        }
      }
    }

    if (key === "mezzLtvMin" && current.mezzLtvMax) {
      if (numVal > Number(current.mezzLtvMax)) {
        return "Mezz LTV min cannot exceed max";
      }
    }

    if (key === "mezzLtvMax" && current.mezzLtvMin) {
      if (numVal < Number(current.mezzLtvMin)) {
        return "Mezz LTV max cannot be less than min";
      }
    }

    if (key === "maxRateSpread" && numVal > 100) {
      return "Max rate spread cannot exceed 100%";
    }

    if (key === "minRateSpread" && numVal > 100) {
      return "Min rate spread cannot exceed 100%";
    }

    if (key === "minRateSpread" && current.maxRateSpread) {
      if (numVal > parseNumericValue(current.maxRateSpread)) {
        return "Min rate spread cannot exceed max rate spread";
      }
    }

    if (key === "maxRateSpread" && current.minRateSpread) {
      if (numVal < parseNumericValue(current.minRateSpread)) {
        return "Max rate spread cannot be less than min rate spread";
      }
    }

    if (key === "sbaGuaranteePercent" && numVal > 100) {
      return "SBA guarantee cannot exceed 100%";
    }

    if (key === "maxFinancingPercent" && numVal > 100) {
      return "Max financing cannot exceed 100%";
    }

    if (key === "requiredInjection" && numVal > 100) {
      return "Required injection cannot exceed 100%";
    }

    if (key === "minTimeInBusiness" && (numVal < 0 || numVal > 600)) {
      return "Min time in business must be between 0 and 600 months";
    }

    if (key === "usdaGuaranteePercent" && numVal > 100) {
      return "USDA guarantee cannot exceed 100%";
    }

    if (
      (key === "advanceRate" ||
        key === "transactionFee" ||
        key === "minGrossMargin" ||
        key === "discountFee" ||
        key === "earlyPaymentDiscount") &&
      numVal > 100
    ) {
      return "Percentage cannot exceed 100%";
    }

    if (key === "maxInvoiceAgeDays" && (numVal <= 0 || numVal > 365)) {
      return "Max invoice age must be between 1 and 365 days";
    }

    if (key === "paymentTermsExtensionDays" && (numVal <= 0 || numVal > 365)) {
      return "Payment terms extension must be between 1 and 365 days";
    }

    if (key === "avgTurnaroundDays" && (numVal <= 0 || numVal > 365)) {
      return "Avg turnaround must be between 1 and 365 days";
    }

    if (key === "preferredReturn" && numVal > 100) {
      return "Preferred return cannot exceed 100%";
    }

    if (key === "exitFee" && numVal > 100) {
      return "Exit fee cannot exceed 100%";
    }

    if (key === "fico") {
      if (numVal < 300 || numVal > 900) {
        return "FICO score must be between 300 and 900";
      }
    }

    if (key === "experience") {
      if (numVal > 100) {
        return "Experience seems too high";
      }
    }

    if (key === "originationPoints" && numVal > 100) {
      return "Origination points cannot exceed 100%";
    }

    if (key === "minDscr") {
      if (numVal <= 0 || numVal > 10) {
        return "Min DSCR must be between 0 and 10";
      }
    }

    if (key === "preferredDscr") {
      if (numVal <= 0 || numVal > 10) {
        return "Preferred DSCR must be between 0 and 10";
      }
    }

    if (key === "minDebtYield" && numVal > 100) {
      return "Min debt yield cannot exceed 100%";
    }

    if (key === "amortizationYears" && (numVal <= 0 || numVal > 50)) {
      return "Amortization must be between 1 and 50 years";
    }

    if (key === "minUnits" && (numVal <= 0 || numVal > 10000)) {
      return "Min units must be a positive number";
    }

    return "";
  };

  const renderField = (product: any, field: CriteriaField) => {
    const fieldType = field.type || "number";
    const currentValue = value?.[getProductKey(product)]?.[field.key];
    const isRequired = field.required !== false && fieldType !== "toggle";

    if (fieldType === "toggle") {
      return (
        <div
          key={field.key}
          className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white px-3 py-3"
        >
          <div className="flex items-center justify-between gap-3">
            <label className="text-xs text-gray-700 font-medium">
              {field.label}
            </label>
            <button
              type="button"
              onClick={() =>
                handleChange(
                  getProductKey(product),
                  field.key,
                  !Boolean(currentValue),
                )
              }
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                currentValue ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  currentValue ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          {field.helperText && (
            <p className="text-[11px] text-gray-500 leading-snug">
              {field.helperText}
            </p>
          )}
        </div>
      );
    }

    if (fieldType === "textarea") {
      return (
        <div key={field.key} className="col-span-2">
          <label className="text-xs text-gray-600 mb-1 block">
            {field.label}
            {isRequired && <span className="text-red-500"> *</span>}
          </label>
          <textarea
            value={currentValue || ""}
            onChange={(e) =>
              handleChange(getProductKey(product), field.key, e.target.value)
            }
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      );
    }

    if (fieldType === "text") {
      return (
        <div key={field.key} className="col-span-2">
          <label className="text-xs text-gray-600 mb-1 block">
            {field.label}
            {isRequired && <span className="text-red-500"> *</span>}
          </label>
          <input
            type="text"
            value={currentValue || ""}
            onChange={(e) =>
              handleChange(getProductKey(product), field.key, e.target.value)
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      );
    }

    const inputSuffix = getCriteriaFieldInputSuffix(field);

    return (
      <div key={field.key}>
        <label className="text-xs text-gray-600 mb-1 block">
          {field.label}
          {isRequired && <span className="text-red-500"> *</span>}
        </label>
        <div className="relative">
          <input
            type="text"
            inputMode={field.decimal ? "decimal" : "numeric"}
            value={formatNumberInputValue(currentValue, {
              decimal: field.decimal,
            })}
            onChange={(e) => {
              const val = sanitizeNumberInput(e.target.value, {
                decimal: field.decimal,
              });
              const err = validateField(getProductKey(product), field.key, val, {
                required: field.required !== false,
              });

              handleChange(getProductKey(product), field.key, val);

              setErrors((prev: any) => ({
                ...prev,
                [getProductKey(product)]: {
                  ...prev?.[getProductKey(product)],
                  [field.key]: err,
                },
              }));
            }}
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
              inputSuffix ? "pr-9" : ""
            }
  ${
    errors?.[getProductKey(product)]?.[field.key]
      ? "border-red-500 focus:ring-red-500"
      : "border-gray-300 focus:ring-blue-500"
  }`}
          />
          {inputSuffix && (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-gray-400">
              {inputSuffix}
            </span>
          )}
        </div>
        {errors?.[getProductKey(product)]?.[field.key] && (
          <p className="text-xs text-red-500 mt-1">
            {errors[getProductKey(product)][field.key]}
          </p>
        )}
      </div>
    );
  };

  const openProductId =
    openIndex !== null && products[openIndex]
      ? getProductKey(products[openIndex])
      : undefined;
  const openProductDocState = openProductId
    ? getDocState(openProductId)
    : null;

  useEffect(() => {
    if (!openProductId) return;

    const { search, debouncedSearch } = getDocState(openProductId);
    if (search === debouncedSearch) return;

    const timeout = setTimeout(() => {
      patchDocState(openProductId, { debouncedSearch: search, page: 1 });
    }, 500);

    return () => clearTimeout(timeout);
  }, [openProductId, openProductDocState?.search]);

  useEffect(() => {
    if (!openProductId || openProductDocState === null) return;

    loadDocumentsForProduct(
      openProductId,
      openProductDocState.page,
      openProductDocState.debouncedSearch,
    );
  }, [
    openProductId,
    openProductDocState?.debouncedSearch,
    openProductDocState?.page,
  ]);

  useEffect(() => {
    const hasErr = Object.values(errors).some((product: any) =>
      Object.values(product || {}).some((e) => !!e),
    );

    setHasErrors?.(hasErr);
  }, [errors]);

  useEffect(() => {
    if (mode === "update" || !products.length) return;

    let changed = false;
    const next = { ...(value || {}) };

    products.forEach((product: any) => {
      const existing = next[getProductKey(product)];

      if (!existing) {
        next[getProductKey(product)] = {
          states: US_STATES,
          documents: [],
        };
        changed = true;
        return;
      }

      if (!existing.states?.length) {
        next[getProductKey(product)] = {
          ...existing,
          states: US_STATES,
        };
        changed = true;
      }
    });

    if (changed) {
      setValue(next);
    }
  }, [mode, products]);

  useEffect(() => {
    if (!products.length) return;

    products.forEach((p: any) => {
      const productKey = getProductKey(p);
      const hasStates = Boolean(value?.[productKey]?.states?.length);

      setErrors((prev: any) => {
        const currentError = prev?.[productKey]?.states || "";

        if (hasStates) {
          if (!currentError) return prev;
          return {
            ...prev,
            [productKey]: {
              ...prev?.[productKey],
              states: "",
            },
          };
        }

        const message =
          "Please select at least one state where lending is available";
        if (currentError === message) return prev;

        return {
          ...prev,
          [productKey]: {
            ...prev?.[productKey],
            states: message,
          },
        };
      });
    });
  }, [products, value]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Settings size={14} /> Loan Criteria
        </h2>
        <p className="text-sm text-gray-500">
          Configure lending criteria for each selected loan program.
        </p>
      </div>

      {products.map((product: any, index: number) => {
        const isOpen = openIndex === index;
        const docState = getDocState(getProductKey(product));

        return (
          <div
            key={getProductKey(product)}
            className="border rounded-xl overflow-hidden transition"
          >
            <div
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex justify-between items-center px-4 py-3 cursor-pointer bg-white hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${getColor(
                    product.name,
                  )} ring-2 ring-white shadow-sm`}
                />
                <span className="font-medium text-sm">{product.name}</span>
              </div>

              <ChevronDown
                size={16}
                className={`transition ${isOpen ? "rotate-180" : ""}`}
              />
            </div>

            {isOpen && (
              <div className="p-4 bg-gray-50 border-t">
                <div className="grid grid-cols-2 gap-4">
                  {getCriteriaFieldsForProduct(product.code).map((field) =>
                    renderField(product, field),
                  )}
                </div>

                <div className="mt-6">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-semibold">
                      {isSba7aBusinessAcquisitionProduct(product.code) ||
                      isSbaExpressProduct(product.code)
                        ? "Geographic Coverage/Location"
                        : "States"}
                      <span className="text-red-500">*</span>
                    </h3>

                    <div className="flex gap-3 text-xs">
                      <button
                        onClick={() => selectAllStates(getProductKey(product))}
                        className="text-blue-600 font-medium hover:underline"
                      >
                        Select All
                      </button>

                      <button
                        onClick={() => clearStates(getProductKey(product))}
                        className="text-red-500 font-medium hover:underline"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div
                    className={`border rounded-xl p-3 bg-white
  ${errors?.[getProductKey(product)]?.states ? "border-red-500" : "border-gray-300"}`}
                  >
                    <div className="grid grid-cols-4 gap-2">
                      {US_STATES.map((state) => {
                        const selected =
                          value?.[getProductKey(product)]?.states?.includes(
                            state,
                          );

                        return (
                          <label
                            key={state}
                            className={`flex items-center gap-2 text-xs px-2 py-1 rounded cursor-pointer transition
              ${selected ? "bg-blue-50 text-blue-600" : "hover:bg-gray-50"}`}
                          >
                            <input
                              type="checkbox"
                              checked={selected || false}
                              onChange={() =>
                                toggleState(getProductKey(product), state)
                              }
                              className="accent-blue-600 cursor-pointer"
                            />
                            {state}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-gray-500">
                      {value?.[getProductKey(product)]?.states?.length || 0}{" "}
                      states selected
                    </p>
                  </div>
                </div>
                {errors?.[getProductKey(product)]?.states && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors[getProductKey(product)].states}
                  </p>
                )}

                {typeof setPropertyTypes === "function" &&
                  typeof setBusinessTypes === "function" &&
                  (productUsesAcceptedPropertyTypes(product?.code) ||
                    productUsesBusinessTypes(product?.code) ||
                    productUsesEquipmentTypes(product?.code)) && (
                    <ProgramEligibilitySection
                      propertyTypes={propertyTypes}
                      setPropertyTypes={setPropertyTypes}
                      propertyTypesTitle={
                        productUsesAcceptedPropertyTypes(product.code)
                          ? "Property Types Accepted"
                          : "Eligible Property Types"
                      }
                      businessTypes={businessTypes}
                      setBusinessTypes={setBusinessTypes}
                      businessTypesTitle={
                        isEquipmentFinanceProduct(product.code) ||
                        isArFactoringProduct(product.code) ||
                        isApSupplyChainProduct(product.code) ||
                        isPurchaseOrderFinanceProduct(product.code) ||
                        isSba7aWorkingCapitalProduct(product.code) ||
                        isSba7aRealEstateProduct(product.code) ||
                        isSba7aEquipmentPurchaseProduct(product.code) ||
                        isSba504Product(product.code) ||
                        isUsdaBiProduct(product.code)
                          ? "Industries Accepted"
                          : "Eligible Business Types"
                      }
                      showBusinessTypes={productUsesBusinessTypes(
                        product?.code,
                      )}
                      showPropertyTypes={productUsesAcceptedPropertyTypes(
                        product?.code,
                      )}
                      showEquipmentTypes={productUsesEquipmentTypes(
                        product?.code,
                      )}
                      equipmentTypes={equipmentTypes}
                      setEquipmentTypes={setEquipmentTypes}
                    />
                  )}

                {(() => {
                  const productKey = getProductKey(product);
                  const selectedDocs =
                    value?.[productKey]?.documents || [];
                  const selectedCount = selectedDocs.length;
                  const showingFrom =
                    docState.pagination.total === 0
                      ? 0
                      : (docState.pagination.page - 1) * DOCUMENT_LIMIT + 1;
                  const showingTo = Math.min(
                    docState.pagination.page * DOCUMENT_LIMIT,
                    docState.pagination.total,
                  );

                  return (
                    <div
                      className={`${
                        typeof setPropertyTypes === "function" &&
                        typeof setBusinessTypes === "function"
                          ? "mt-2"
                          : "mt-6"
                      } space-y-3`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          patchDocState(productKey, {
                            sectionOpen: !docState.sectionOpen,
                          })
                        }
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <FileText
                            size={15}
                            className="shrink-0 text-[#13538A]"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-slate-800">
                                Upfront Documents
                              </span>
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                Optional
                              </span>
                              {selectedCount > 0 ? (
                                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#13538A] px-1.5 text-[11px] font-bold text-white">
                                  {selectedCount}
                                </span>
                              ) : null}
                            </div>
                            {!docState.sectionOpen ? (
                              <p className="mt-0.5 text-xs text-slate-500">
                                {selectedCount > 0
                                  ? `${selectedCount} selected`
                                  : "No documents selected"}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <ChevronDown
                          size={16}
                          className={`shrink-0 text-slate-400 transition ${
                            docState.sectionOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {docState.sectionOpen ? (
                        <>
                          <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Custom document
                            </label>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <input
                                type="text"
                                placeholder="Enter custom document name..."
                                value={docState.customDocumentName}
                                onChange={(e) =>
                                  patchDocState(productKey, {
                                    customDocumentName: e.target.value,
                                  })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addCustomDocument(productKey);
                                  }
                                }}
                                className="h-11 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/20"
                              />
                              <button
                                type="button"
                                onClick={() => addCustomDocument(productKey)}
                                disabled={!docState.customDocumentName.trim()}
                                className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#13538A] px-4 text-sm font-semibold text-white transition hover:bg-[#0f4570] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                              >
                                <Plus size={16} />
                                Add Document
                              </button>
                            </div>
                          </div>

                          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                              <div className="flex min-w-0 items-center gap-2">
                                <FileText
                                  size={15}
                                  className="shrink-0 text-[#13538A]"
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-800">
                                    Available documents
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {docState.pagination.total} document
                                    {docState.pagination.total === 1
                                      ? ""
                                      : "s"}
                                    {selectedCount > 0
                                      ? ` · ${selectedCount} selected`
                                      : ""}
                                  </p>
                                </div>
                              </div>

                              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
                                <div className="relative min-w-[200px] flex-1 sm:w-64 sm:flex-none">
                                  <Search
                                    size={16}
                                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                  />
                                  <input
                                    type="search"
                                    value={docState.search}
                                    onChange={(e) =>
                                      patchDocState(productKey, {
                                        search: e.target.value,
                                      })
                                    }
                                    placeholder="Search documents..."
                                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#13538A] focus:ring-2 focus:ring-[#13538A]/20 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
                                  />
                                  {docState.search.trim() ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        patchDocState(productKey, {
                                          search: "",
                                          debouncedSearch: "",
                                          page: 1,
                                        })
                                      }
                                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                      aria-label="Clear search"
                                    >
                                      <X size={14} />
                                    </button>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    selectAllDocuments(productKey)
                                  }
                                  disabled={docState.loading}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Select All
                                </button>
                                <button
                                  type="button"
                                  onClick={() => clearDocuments(productKey)}
                                  disabled={selectedCount === 0}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Clear
                                </button>
                              </div>
                            </div>

                            {isOpen && docState.loading ? (
                              <div className="flex flex-col items-center justify-center py-14">
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#13538A] border-t-transparent" />
                                <p className="mt-3 text-sm text-slate-500">
                                  Loading documents...
                                </p>
                              </div>
                            ) : docState.documents.length === 0 ? (
                              <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#13538A]/10 text-[#13538A]">
                                  <FileText size={22} />
                                </div>
                                <h3 className="text-base font-semibold text-slate-800">
                                  No documents found
                                </h3>
                                <p className="mt-1 max-w-sm text-sm text-slate-500">
                                  {docState.search.trim()
                                    ? `No documents match “${docState.search.trim()}”.`
                                    : "No documents configured for this loan product yet. Add a custom document above."}
                                </p>
                              </div>
                            ) : (
                              <>
                                <div className="w-full overflow-x-auto">
                                  <table className="w-full min-w-[560px] table-fixed text-sm">
                                    <colgroup>
                                      <col className="w-10 sm:w-12" />
                                      <col />
                                      <col className="w-[88px] sm:w-[110px]" />
                                      <col className="w-[100px] sm:w-[130px]" />
                                    </colgroup>
                                    <thead className="border-b border-slate-200 bg-slate-50">
                                      <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="px-4 py-2.5 text-left">
                                          <span className="sr-only">
                                            Select
                                          </span>
                                        </th>
                                        <th className="px-3 py-2.5 text-left">
                                          Document
                                        </th>
                                        <th className="px-3 py-2.5 text-left">
                                          Type
                                        </th>
                                        <th className="px-3 py-2.5 text-left">
                                          Status
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {docState.documents.map(
                                        (doc: any, rowIndex: number) => {
                                          const checked = selectedDocs.some(
                                            (d: any) =>
                                              d.id === doc.id ||
                                              d.documentTypeId === doc.id,
                                          );

                                          return (
                                            <tr
                                              key={doc.id}
                                              onClick={() =>
                                                toggleDocument(productKey, doc)
                                              }
                                              className={`cursor-pointer transition-colors ${
                                                checked
                                                  ? "bg-[#13538A]/8"
                                                  : rowIndex % 2 === 1
                                                    ? "bg-slate-50/40"
                                                    : "bg-white"
                                              } hover:bg-slate-50`}
                                            >
                                              <td className="px-4 py-3 align-middle">
                                                <input
                                                  type="checkbox"
                                                  checked={checked || false}
                                                  onChange={() =>
                                                    toggleDocument(
                                                      productKey,
                                                      doc,
                                                    )
                                                  }
                                                  onClick={(e) =>
                                                    e.stopPropagation()
                                                  }
                                                  className="h-4 w-4 cursor-pointer accent-[#13538A]"
                                                  aria-label={`Select ${doc.name}`}
                                                />
                                              </td>
                                              <td className="px-3 py-3 align-middle">
                                                <div className="flex min-w-0 items-center gap-2.5">
                                                  <span
                                                    className={`h-2 w-2 shrink-0 rounded-full ${getColor(doc.name)}`}
                                                  />
                                                  <p
                                                    className="truncate font-semibold text-slate-800"
                                                    title={doc.name}
                                                  >
                                                    {doc.name}
                                                  </p>
                                                  {checked ? (
                                                    <CheckCircle2
                                                      size={15}
                                                      className="shrink-0 text-[#13538A]"
                                                    />
                                                  ) : null}
                                                </div>
                                              </td>
                                              <td className="px-3 py-3 align-middle">
                                                {doc.isCustom ? (
                                                  <span className="inline-flex rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                                                    Custom
                                                  </span>
                                                ) : (
                                                  <span className="text-[11px] font-medium text-slate-400">
                                                    Standard
                                                  </span>
                                                )}
                                              </td>
                                              <td className="px-3 py-3 align-middle">
                                                {checked ? (
                                                  <span className="inline-flex rounded-md bg-[#13538A]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0f4570]">
                                                    Selected
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                                    Available
                                                  </span>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        },
                                      )}
                                    </tbody>
                                  </table>
                                </div>

                                {docState.pagination.total > 0 ? (
                                  <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm text-slate-500">
                                      Showing{" "}
                                      <span className="font-semibold text-slate-700">
                                        {showingFrom}
                                      </span>
                                      {" – "}
                                      <span className="font-semibold text-slate-700">
                                        {showingTo}
                                      </span>{" "}
                                      of{" "}
                                      <span className="font-semibold text-slate-700">
                                        {docState.pagination.total}
                                      </span>
                                    </p>

                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        disabled={
                                          !docState.pagination.hasPreviousPage
                                        }
                                        onClick={() =>
                                          patchDocState(productKey, {
                                            page: docState.page - 1,
                                          })
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        <ChevronLeft size={16} />
                                        Previous
                                      </button>

                                      <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                                        Page {docState.pagination.page} of{" "}
                                        {docState.pagination.totalPages || 1}
                                      </span>

                                      <button
                                        type="button"
                                        disabled={
                                          !docState.pagination.hasNextPage
                                        }
                                        onClick={() =>
                                          patchDocState(productKey, {
                                            page: docState.page + 1,
                                          })
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg bg-[#13538A] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#0f4570] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                                      >
                                        Next
                                        <ChevronRight size={16} />
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                        </>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StepFive;
