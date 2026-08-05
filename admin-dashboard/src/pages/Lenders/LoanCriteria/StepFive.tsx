import { useEffect, useState } from "react";
import { ChevronDown, Settings, FileText, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  getCriteriaFieldsForProduct,
  getCriteriaFieldInputSuffix,
  isSba7aBusinessAcquisitionProduct,
  isSbaExpressProduct,
  type CriteriaField,
} from "../../../lib/loanProductCriteriaFields";
import {
  formatNumberInputValue,
  sanitizeNumberInput,
  stripNumberFormatting,
} from "../../../lib/numberInputFormat";

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
  import.meta.env.VITE_API_BASE || "https://api-lendingcart.vibrantick.org";

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
};

type StepFiveProps = {
  products: any[];
  value: Record<string, any>;
  setValue: (val: Record<string, any>) => void;
  setHasErrors?: (hasErrors: boolean) => void;
  mode?: "create" | "update";
  authMode?: "admin" | "lender";
  lenderProductIdByProgramId?: Record<string, string>;
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
                    className={`border rounded-xl p-3 max-h-44 overflow-y-auto bg-white
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

                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-indigo-600" />

                      <h3 className="text-sm font-semibold">
                        Upfront Documents (optional)
                      </h3>

                      {!!value?.[getProductKey(product)]?.documents?.length && (
                        <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">
                          {
                            value?.[getProductKey(product)]?.documents?.length
                          }{" "}
                          selected
                        </span>
                      )}
                    </div>

                    <div className="flex gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          selectAllDocuments(getProductKey(product))
                        }
                        className="text-indigo-600 font-medium hover:underline"
                      >
                        Select All
                      </button>

                      <button
                        type="button"
                        onClick={() => clearDocuments(getProductKey(product))}
                        className="text-red-500 font-medium hover:underline"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="Search documents..."
                      value={docState.search}
                      onChange={(e) =>
                        patchDocState(getProductKey(product), {
                          search: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
                    <input
                      type="text"
                      placeholder="Enter custom document name..."
                      value={docState.customDocumentName}
                      onChange={(e) =>
                        patchDocState(getProductKey(product), {
                          customDocumentName: e.target.value,
                        })
                      }
                      className="h-12 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm shadow-sm transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                    />

                    <button
                      type="button"
                      onClick={() => addCustomDocument(getProductKey(product))}
                      className="flex h-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 px-6 text-sm font-semibold text-white transition hover:bg-indigo-700 active:scale-[0.98] md:w-auto"
                    >
                      + Add Document
                    </button>
                  </div>
                  {isOpen && docState.loading ? (
                    <div className="flex items-center justify-center py-12 text-sm text-gray-500">
                      Loading documents...
                    </div>
                  ) : docState.documents.length > 0 ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {docState.documents.map((doc) => {
                          const checked = value?.[
                            getProductKey(product)
                          ]?.documents?.some(
                            (d: any) =>
                              d.id === doc.id || d.documentTypeId === doc.id,
                          );

                          return (
                            <label
                              key={doc.id}
                              className={`group relative flex items-start gap-3 rounded-2xl border px-4 py-3 cursor-pointer transition-all duration-200
              ${
                checked
                  ? "border-indigo-500 bg-indigo-50 shadow-sm scale-[1.01]"
                  : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50"
              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked || false}
                                onChange={() =>
                                  toggleDocument(getProductKey(product), doc)
                                }
                                className="mt-1 accent-indigo-600 cursor-pointer"
                              />

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-2.5 h-2.5 rounded-full ${getColor(doc.name)}`}
                                  />

                                  <p className="text-sm font-medium text-gray-800 leading-tight">
                                    {doc.name}
                                  </p>
                                </div>
                              </div>

                              {checked && (
                                <CheckCircle2
                                  size={18}
                                  className="text-indigo-600 shrink-0"
                                />
                              )}
                            </label>
                          );
                        })}
                      </div>

                      {docState.pagination.total > 0 && (
                        <div className="mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-sm text-gray-500">
                            Showing{" "}
                            <span className="font-semibold text-gray-700">
                              {(docState.pagination.page - 1) * DOCUMENT_LIMIT +
                                1}
                            </span>
                            {" - "}
                            <span className="font-semibold text-gray-700">
                              {Math.min(
                                docState.pagination.page * DOCUMENT_LIMIT,
                                docState.pagination.total,
                              )}
                            </span>{" "}
                            of{" "}
                            <span className="font-semibold text-gray-700">
                              {docState.pagination.total}
                            </span>{" "}
                            documents
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              disabled={!docState.pagination.hasPreviousPage}
                              onClick={() =>
                                patchDocState(getProductKey(product), {
                                  page: docState.page - 1,
                                })
                              }
                              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-indigo-500 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              ← Previous
                            </button>

                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700">
                              Page {docState.pagination.page} of{" "}
                              {docState.pagination.totalPages}
                            </div>

                            <button
                              type="button"
                              disabled={!docState.pagination.hasNextPage}
                              onClick={() =>
                                patchDocState(getProductKey(product), {
                                  page: docState.page + 1,
                                })
                              }
                              className="rounded-lg border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-300"
                            >
                              Next →
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 py-12">
                      <FileText size={42} className="mb-3 text-gray-400" />

                      <h3 className="text-base font-semibold text-gray-700">
                        No documents found
                      </h3>

                      <p className="mt-1 text-sm text-gray-500 text-center">
                        {docState.search.trim()
                          ? `No documents found for "${docState.search}".`
                          : "No documents configured for this loan product yet. Add a custom document or ask admin to assign document types."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StepFive;
