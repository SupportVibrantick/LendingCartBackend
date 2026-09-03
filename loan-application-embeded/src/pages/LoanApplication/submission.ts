// Submission & product-catalog network logic. These functions encapsulate
// the API endpoints the LoanApplication form talks to, plus the payload
// assembly that turns the form data into a fields[] array.

import { API_BASE, PRODUCT_LABELS } from "./constants";
import { toNumber, calculateMonthlyPayment } from "./formatters";
import { appendResidentialBorrowerSubmission } from "../../lib/residentialBorrower";
import { appendResidentialFinancialsSubmission } from "../../lib/residentialFinancials";
import { appendReferringBrokerSubmission } from "../../lib/referringBroker";
import { resolveCanonicalLoanProductCode } from "../../lib/canonicalLoanProducts";
import { uploadPendingApplicationDocuments } from "../../lib/uploadApplicationDocuments";
import type {
  PendingApplicationDocument,
  ApplicationDocumentType,
} from "../../lib/applicationDocumentTypes";
import type { LoanApplicationPortal } from "./types";
import type { FormDataType } from "./types";

export interface PortalConfig {
  tokenKey: string;
  submitUrl: string;
  editUrl: (applicationId: string) => string;
  loanProductsUrl: string;
  loanProductsAuth: boolean;
  successPath: string;
  backLabel: string;
}

export function getPortalConfig(
  portal: LoanApplicationPortal,
  apiBase: string,
): PortalConfig {
  if (portal === "loanOfficer") {
    return {
      tokenKey: "loan_officer_token",
      submitUrl: `${apiBase}/loanofficer/applications/submit`,
      editUrl: (applicationId: string) =>
        `${apiBase}/loanofficer/applications/${applicationId}/edit`,
      loanProductsUrl: `${apiBase}/common/loan-products/loan-product-code`,
      loanProductsAuth: false,
      successPath: "/loan-officer/loan-pipeline",
      backLabel: "Back to Loan Pipeline",
    };
  }

  return {
    tokenKey: "broker_token",
    submitUrl: `${apiBase}/broker/applications/submit`,
    editUrl: (applicationId: string) =>
      `${apiBase}/broker/applications/${applicationId}/edit`,
    loanProductsUrl: `${apiBase}/common/loan-products/loan-product-code`,
    loanProductsAuth: false,
    successPath: "/submit-applications",
    backLabel: "Back to Submit Applications",
  };
}

export async function fetchLoanProductCatalog(portalConfig: PortalConfig) {
  const headers: Record<string, string> = {};

  if (portalConfig.loanProductsAuth) {
    const token = sessionStorage.getItem(portalConfig.tokenKey);
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(portalConfig.loanProductsUrl, { headers });
  const result = await response.json();

  if (!response.ok || result.success === false) {
    throw new Error(result.message || "Failed to load loan products");
  }

  const products = (result.data || []).map((product: any) => ({
    productId: product.id,
    loanProductCode: product.code,
    name: product.name,
    sections: [],
    unsectionedFields: [],
  }));

  return { products };
}

export function withBorrowerNameFields<
  T extends { fieldKey: string; value: unknown; fieldId?: string },
>(fields: T[]): T[] {
  const next = [...fields];

  const readValue = (...keys: string[]) => {
    for (const key of keys) {
      const match = fields.find((field) => field.fieldKey === key);
      const value = match?.value;
      if (value != null && String(value).trim()) {
        return String(value).trim();
      }
    }
    return "";
  };

  if (!next.some((field) => field.fieldKey === "first_name")) {
    const firstName = readValue("first_name", "borrowerFirstName", "firstName");
    if (firstName) {
      next.push({ fieldKey: "first_name", value: firstName } as T);
    }
  }

  if (!next.some((field) => field.fieldKey === "last_name")) {
    const lastName = readValue("last_name", "borrowerLastName", "lastName");
    if (lastName) {
      next.push({ fieldKey: "last_name", value: lastName } as T);
    }
  }

  return next;
}

export function buildLocalProductCatalog(categoryLoanTypes: Record<string, string[]>) {
  const allCategoryCodes = Array.from(
    new Set(Object.values(categoryLoanTypes).flat()),
  );

  return allCategoryCodes.map((code) => ({
    productId: code,
    loanProductCode: code,
    name: PRODUCT_LABELS[code] || code,
    sections: [],
    unsectionedFields: [],
  }));
}

export interface SubmissionExtras {
  /** Embedded-only: include the additional collateral items (SBA/USDA/ABL). */
  additionalCollateral?: string[];
  /** Embedded-only: include the private sale flag (SBA/USDA/ABL). */
  privateSale?: boolean;
  /** Embedded-only: vendor name for private-sale collateral flow. */
  vendorName?: string;
  /** Embedded-only: vendor phone for private-sale collateral flow. */
  vendorPhone?: string;
  /** Embedded-only: include the loan sub-purpose. */
  subPurpose?: string;
}

export interface SubmissionContext {
  formData: FormDataType;
  selectedProduct: string;
  selectedCategory: string;
  activeProduct?: any;
  usesBase44Financials: boolean;
  dynamicFormData: Record<string, any>;
  pendingDocuments: PendingApplicationDocument[];
  creditAuthorizationConsent: boolean;
  borrowerAssets: number;
  borrowerLiabilities: number;
  netWorth: number;
  ltv: string;
  ltc: string;
  arv: string;
  dscr: string;
  loanAmount: number;
  interestRate: number;
  termMonths: number;
  /** Embedded-only: extra fields the embedded form emits. */
  extras?: SubmissionExtras;
  /**
   * Embedded-only: when the public-embed flow surfaces the
   * "are you a broker?" step, emit the referring-broker fields
   * into the payload.
   */
  includeCoBrokerBorrowerInformation?: boolean;
}

export interface BuildPayloadResult {
  payload: {
    loanProductCode: string;
    fields: { fieldKey: string; value: any; fieldId?: string }[];
  };
  coBorrowerSummaries: Array<{
    netWorth: number;
    ltv: number;
    ltc: number;
    dscr: number;
  }>;
}

export function buildSubmissionPayload(ctx: SubmissionContext): BuildPayloadResult {
  const {
    formData,
    selectedProduct,
    selectedCategory,
    activeProduct,
    usesBase44Financials,
    dynamicFormData,
    pendingDocuments,
    creditAuthorizationConsent,
    borrowerAssets,
    borrowerLiabilities,
    netWorth,
    ltv,
    ltc,
    arv,
    dscr,
    loanAmount,
    interestRate,
    termMonths,
    extras,
    includeCoBrokerBorrowerInformation,
  } = ctx;

  const allProductFields = [
    ...(activeProduct?.unsectionedFields || []),
    ...(activeProduct?.sections || []).flatMap(
      (section: any) => section.fields || [],
    ),
  ];

  const fieldIdByKey = new Map<string, string>(
    allProductFields
      .filter((field: any) => field.fieldKey && field.fieldId)
      .map((field: any) => [field.fieldKey, field.fieldId]),
  );

  const fieldsMap = new Map<string, { value: any; fieldId?: string }>();

  const addField = (key: string, value: any, fieldId?: string) => {
    if (value === undefined || value === null || value === "") return;

    if (typeof value === "string") {
      value = value.trim();
    }

    const resolvedFieldId = fieldId ?? fieldIdByKey.get(key);

    fieldsMap.set(key, {
      value,
      ...(resolvedFieldId ? { fieldId: resolvedFieldId } : {}),
    });
  };

  /* ================= REFERRING BROKER (public Broker/LO provenance) ================= */
  // The broker dashboard never sets this flag; the embedded app sets it when
  // the public-embed "are you a broker?" step is active.
  if (includeCoBrokerBorrowerInformation || formData.workingWithMortgageBroker) {
    appendReferringBrokerSubmission(addField, {
      workingWithMortgageBroker: formData.workingWithMortgageBroker || "",
      referringBroker: formData.referringBroker || {
        email: "",
        firstName: "",
        lastName: "",
        companyName: "",
        phone: "",
      },
    });
  }

  /* ================= BORROWER ================= */
  if (usesBase44Financials) {
    appendResidentialBorrowerSubmission(addField, formData.borrower);

    formData.coBorrowers.forEach((borrower, index) => {
      appendResidentialBorrowerSubmission(
        addField,
        borrower,
        `coBorrower_${index + 1}`,
      );
    });
  } else {
    const fullName = formData.borrower.name.trim().split(" ");
    const firstName = fullName[0] || "";
    const lastName = fullName.slice(1).join(" ") || "";

    addField("borrowerFirstName", firstName);
    addField("borrowerLastName", lastName);
    addField("companyName", formData.borrower.entityName);
    addField("email", formData.borrower.email?.toLowerCase());
    addField("phone", formData.borrower.phone);
    addField("creditScore", formData.borrower.creditScore);

    addField("borrowerCity", formData.borrower.city);
    addField("borrowerState", formData.borrower.state);
    addField("borrowerCountry", "USA");
    addField("dob", formData.borrower.dob);
    addField("ssn", formData.borrower.ssn);
    addField("address", formData.borrower.address);
    addField("mailingAddress", formData.borrower.mailingAddress);
    addField("employer", formData.borrower.employer);
  }

  /* ================= LOAN REQUEST ================= */
  const canonicalLoanProductCode =
    resolveCanonicalLoanProductCode(selectedProduct);
  addField("loanProductCode", canonicalLoanProductCode);
  addField("loanCategory", selectedCategory);
  addField("amountRequested", toNumber(formData.loanRequest.amount));
  addField("interestRate", formData.loanRequest.interestRate);
  addField("purpose", formData.loanRequest.purpose);
  if (extras?.subPurpose) {
    addField("subPurpose", extras.subPurpose);
  }
  addField("propertyType", formData.loanRequest.propertyType);
  addField("subPropertyType", formData.loanRequest.subPropertyType);
  addField("recourse", formData.loanRequest.recourse);
  addField("sellerFinancing", formData.loanRequest.sellerFinancing);
  addField("sellerNoteAmount", toNumber(formData.loanRequest.sellerNoteAmount));
  addField("estimatedClosingDate", formData.loanRequest.estimatedClosingDate);
  addField("rateType", formData.loanRequest.rateType);
  addField("brokerPoints", formData.loanRequest.brokerPoints);
  addField("amortization", formData.loanRequest.amortization);

  /* ================= PROPERTY LOCATION ================= */
  addField("propertyAddress", formData.loanRequest.businessAddress);
  addField("propertyCity", formData.loanRequest.city);
  addField("propertyState", formData.loanRequest.state);
  addField("propertyZip", formData.loanRequest.zip?.replace(/\D/g, ""));
  addField("propertyCountry", "USA");
  addField("numberOfUnits", formData.loanRequest.numberOfUnits);

  /* ================= LOAN TERM & ENTITY ================= */
  addField("loanTerm", formData.loanTermIncome.loanTerm);

  addField("entityLegalName", formData.entity.legalName);
  addField("entityType", formData.entity.entityType);
  addField("dba", formData.entity.dba);
  addField("formationDate", formData.entity.formationDate);
  addField("yearsInBusiness", formData.entity.yearsInBusiness);
  addField("ebitda", toNumber(formData.entity.ebitdaWithNoi));
  addField("naicsCode", formData.entity.naicsCode);
  addField("naics", formData.entity.naicsCode);
  addField("goodwillAmount", toNumber(formData.entity.goodwillAmount));
  addField(
    "inventoryIncluded",
    formData.entity.inventoryIncluded ? "yes" : "no",
  );
  addField(
    "equipmentIncluded",
    formData.entity.equipmentIncluded ? "yes" : "no",
  );
  addField("inventoryValue", toNumber(formData.entity.inventoryValue));
  addField("equipmentValue", toNumber(formData.entity.equipmentValue));
  addField("businessIndustry", formData.loanRequest.propertyType);

  // Embedded-only extras for SBA/USDA/ABL collateral flows.
  if (extras?.additionalCollateral && extras.additionalCollateral.length > 0) {
    addField("additionalCollateral", [...extras.additionalCollateral]);
  }
  if (extras?.privateSale !== undefined) {
    addField("privateSale", extras.privateSale ? "yes" : "no");
  }
  if (extras?.vendorName) {
    addField("vendorName", extras.vendorName);
  }
  if (extras?.vendorPhone) {
    addField("vendorPhone", extras.vendorPhone);
  }

  addField(
    "currentMarketValue",
    toNumber(formData.loanRequest.currentMarketValue),
  );
  addField(
    "afterRepairValue",
    toNumber(formData.loanRequest.afterRepairValue),
  );
  addField("purchasePrice", toNumber(formData.loanRequest.purchasePrice));
  addField("downPayment", toNumber(formData.loanRequest.downPayment));
  addField(
    "currentLoanBalance",
    toNumber(formData.loanRequest.currentLoanBalance),
  );
  addField("useOfFunds", formData.loanRequest.useOfFunds);
  addField("exitStrategy", formData.loanRequest.exitStrategy);
  addField("rehabBudget", toNumber(formData.loanRequest.rehabCost));
  addField(
    "constructionBudget",
    toNumber(formData.loanRequest.constructionCost),
  );
  addField("purchaseDate", formData.loanRequest.purchaseDate);
  addField("totalAssets", borrowerAssets);
  addField("totalLiabilities", borrowerLiabilities);

  if (usesBase44Financials) {
    appendResidentialFinancialsSubmission(addField, formData.financials);
  } else {
    addField("noiActual", formData.loanTermIncome.noiActual);
    addField("monthlyRent", formData.loanTermIncome.monthlyRent);
    addField("grossRevenueActual", formData.loanTermIncome.grossRevenueActual);
    addField(
      "grossRevenueProforma",
      formData.loanTermIncome.grossRevenueProforma,
    );
    addField("noiProforma", formData.loanTermIncome.noiProforma);
    addField("annualTaxes", formData.loanTermIncome.annualTaxes);
    addField("floodZone", formData.loanTermIncome.floodZone);
    addField("insurancePremium", formData.loanTermIncome.insurancePremium);
    addField("hoaDues", formData.loanTermIncome.hoaDues);
  }

  /* ================= CO BORROWERS ================= */
  const coBorrowerSummaries: BuildPayloadResult["coBorrowerSummaries"] = [];

  if (!usesBase44Financials) {
    formData.coBorrowers.forEach((borrower, index) => {
      const i = index + 1;

      const toNum = (v: string) => parseFloat(v?.replace(/,/g, "") || "0");

      const coLoanAmount =
        formData.coBorrowers.length > 0
          ? loanAmount / formData.coBorrowers.length
          : loanAmount;

      const coMarketValue = toNum(borrower.currentMarketValue);
      const coPurchasePrice = toNum(borrower.purchasePrice);
      const coInterest = borrower.interestRate
        ? toNum(borrower.interestRate)
        : interestRate;

      const coNoi = toNum(borrower.noi);
      const coAssets = toNum(borrower.totalAssets);
      const coLiabilities = toNum(borrower.totalLiabilities);

      const coNetWorth = coAssets - coLiabilities;

      const coLtv =
        coMarketValue > 0 ? (coLoanAmount / coMarketValue) * 100 : 0;

      const coLtc =
        coPurchasePrice > 0 ? (coLoanAmount / coPurchasePrice) * 100 : 0;

      const coAnnualDebt =
        calculateMonthlyPayment(coLoanAmount, coInterest, termMonths) * 12;

      const coDscr =
        coAnnualDebt > 0 && coNoi > 0 ? coNoi / coAnnualDebt : 0;

      coBorrowerSummaries.push({
        netWorth: coNetWorth,
        ltv: coLtv,
        ltc: coLtc,
        dscr: coDscr,
      });

      // original fields
      Object.entries(borrower).forEach(([key, value]) => {
        if (key === "id") return;
        addField(`coBorrower_${i}_${key}`, value);
      });

      // calculated
      addField(`coBorrower_${i}_netWorth`, coNetWorth);
      addField(`coBorrower_${i}_ltv`, coLtv);
      addField(`coBorrower_${i}_ltc`, coLtc);
      addField(`coBorrower_${i}_dscr`, coDscr);
    });
  }

  /* ================= DYNAMIC FIELDS ================= */
  const allDynamicFields = allProductFields;

  Object.entries(dynamicFormData).forEach(([fieldId, value]) => {
    if (!value || value instanceof File) return;

    const fieldMeta = allDynamicFields.find(
      (f: any) => f.fieldId === fieldId,
    );

    const key = fieldMeta?.fieldKey || fieldMeta?.label || fieldId;

    addField(key, value, fieldId);
  });

  /* ================= CALCULATED ================= */
  addField("ltvPercentage", ltv !== "-" && ltv !== "—" ? Number(ltv) : 0);
  addField("ltcPercentage", ltc !== "-" && ltc !== "—" ? Number(ltc) : 0);
  addField("arvPercentage", arv !== "-" && arv !== "—" ? Number(arv) : 0);
  addField("dscr", dscr !== "-" && dscr !== "—" ? Number(dscr) : 0);

  addField("totalAssets", borrowerAssets);
  addField("totalLiabilities", borrowerLiabilities);
  addField("netWorth", netWorth);

  pendingDocuments.forEach((doc, index) => {
    addField(`applicationDocument_${index}_fileName`, doc.fileName);
    addField(`applicationDocument_${index}_documentType`, doc.documentType);
  });
  addField("applicationDocumentCount", pendingDocuments.length);
  addField(
    "creditAuthorizationConsent",
    creditAuthorizationConsent ? "yes" : "no",
  );

  /* ================= FINAL PAYLOAD ================= */
  const payload = {
    loanProductCode: resolveCanonicalLoanProductCode(selectedProduct),
    fields: Array.from(fieldsMap.entries()).map(
      ([fieldKey, { value, fieldId }]) => ({
        fieldKey,
        value,
        ...(fieldId ? { fieldId } : {}),
      }),
    ),
  };

  return { payload, coBorrowerSummaries };
}

export interface SubmitOptions {
  portalConfig: PortalConfig;
  mode: "create" | "update";
  editApplicationId?: string;
  publicEmbed: boolean;
  recaptchaToken: string | null;
  publicLinkRef?: string | null;
  brokerOrgId?: string | null;
  onUpdateSuccess?: (submissionId?: string) => void;
  onPublicSubmitSuccess?: (submissionId?: string) => void;
  onNavigateAfterSuccess?: (path: string) => void;
  onError?: (message: string) => void;
  onInfo?: (message: string) => void;
}

export async function submitApplication(
  ctx: SubmissionContext,
  opts: SubmitOptions,
) {
  const { payload } = buildSubmissionPayload(ctx);
  const { formData, pendingDocuments } = ctx;
  const token = sessionStorage.getItem(opts.portalConfig.tokenKey);

  if (opts.mode === "update" && opts.editApplicationId) {
    const response = await fetch(opts.portalConfig.editUrl(opts.editApplicationId), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fields: payload.fields }),
    });

    const result = await response.json();

    if (!response.ok || result.success !== true) {
      throw new Error(result.message || "Update failed");
    }

    // Edit-mode document upload (embedded currently only uploads on fresh
    // create, but broker already does this for edits too).
    const submissionId = result?.data?.submissionId;
    const loanApplicationId = result?.data?.applicationId || opts.editApplicationId;
    if (pendingDocuments.length > 0 && loanApplicationId && submissionId) {
      try {
        await uploadPendingApplicationDocuments({
          apiBase: API_BASE,
          token,
          loanApplicationId,
          submissionId,
          documents: pendingDocuments,
        });
      } catch (uploadError: any) {
        opts.onError?.(
          uploadError.message ||
            "Application saved but some documents failed to upload",
        );
      }
    }

    opts.onUpdateSuccess?.(submissionId);
    if (opts.onNavigateAfterSuccess) {
      opts.onNavigateAfterSuccess(opts.portalConfig.successPath);
    }
    return;
  }

  if (opts.publicEmbed) {
    if (!opts.recaptchaToken) {
      throw new Error("Please verify reCAPTCHA before submitting");
    }

    const publicFields = withBorrowerNameFields([...payload.fields]);
    const hasFirstName = publicFields.some(
      (f) => f.fieldKey === "first_name",
    );
    const hasLastName = publicFields.some(
      (f) => f.fieldKey === "last_name",
    );

    if (!hasFirstName) {
      publicFields.push({
        fieldKey: "first_name",
        value:
          formData.borrower.firstName ||
          formData.borrower.name?.trim().split(/\s+/)[0] ||
          "",
      });
    }

    if (!hasLastName) {
      const nameParts = formData.borrower.name?.trim().split(/\s+/) || [];
      publicFields.push({
        fieldKey: "last_name",
        value:
          formData.borrower.lastName || nameParts.slice(1).join(" ") || "",
      });
    }

    // Embedded-only: include the ref / brokerOrgId so the public endpoint
    // can route the submission to the right broker / loan officer.
    const publicExtras: Record<string, string> = {};
    const linkRef = opts.publicLinkRef || (ctx as any).publicLinkRef;
    const orgId = opts.brokerOrgId || (ctx as any).brokerOrgId;
    if (linkRef) {
      publicExtras.ref = String(linkRef);
    } else if (orgId) {
      publicExtras.brokerOrgId = String(orgId);
    }

    const response = await fetch(
      `${API_BASE}/api/public/broker/applications/submit`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...publicExtras,
          ...payload,
          fields: publicFields,
          captchaToken: opts.recaptchaToken,
        }),
      },
    );

    const result = await response.json();

    if (!response.ok || result.success !== true) {
      throw new Error(result.message || "Submission failed");
    }

    opts.onPublicSubmitSuccess?.(result?.data?.submissionId);
    return;
  }

  const response = await fetch(opts.portalConfig.submitUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...payload,
      fields: withBorrowerNameFields(payload.fields),
    }),
  });

  const result = await response.json();

  if (!response.ok || result.success !== true) {
    throw new Error(result.message || "Submission failed");
  }

  const loanApplicationId = result?.data?.applicationId;
  const submissionId = result?.data?.submissionId;

  if (pendingDocuments.length > 0 && loanApplicationId && submissionId) {
    try {
      await uploadPendingApplicationDocuments({
        apiBase: API_BASE,
        token,
        loanApplicationId,
        submissionId,
        documents: pendingDocuments,
      });
    } catch (uploadError: any) {
      opts.onError?.(
        uploadError.message ||
          "Application saved but some documents failed to upload",
      );
      if (opts.onNavigateAfterSuccess) {
        opts.onNavigateAfterSuccess(opts.portalConfig.successPath);
      }
      return;
    }
  }

  opts.onNavigateAfterSuccess?.(opts.portalConfig.successPath);
}

export function buildRequestedDocumentTypesPayload({
  labels,
  typeIds,
}: {
  labels: ApplicationDocumentType[];
  typeIds?: string[];
}) {
  const dedup = (values: string[]) => [...new Set(values.filter(Boolean))];

  const cleanLabels = dedup(
    (labels || []).map((entry) => entry.trim()).filter((entry) => entry.length > 0),
  );

  if (cleanLabels.length === 0 && (!typeIds || typeIds.length === 0)) {
    return null;
  }

  return {
    labels: cleanLabels,
    typeIds: dedup(typeIds || []),
  };
}
