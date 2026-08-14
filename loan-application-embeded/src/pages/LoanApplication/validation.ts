// Field- and step-level validation logic for the LoanApplication form.
// Pure functions, no React state, no side effects. The main component
// composes these into its error state.

import {
  collectDeclarationErrors,
  createEmptyDeclarations,
  DECLARATION_QUESTIONS,
  isDeclarationAnswered,
} from "../../lib/residentialBorrower";
import type { ReviewValidationIssue } from "../../lib/residentialReviewHelpers";
import { validateReferringBrokerStep } from "../../lib/referringBroker";

import {
  EMAIL_REGEX,
  PHONE_REGEX,
  SSN_REGEX,
  ZIP_REGEX,
  toNumber,
} from "./formatters";
import { STATIC_FIELD_KEYS, OPTIONAL_LOAN_REQUEST_KEYS } from "./constants";
import { CO_BROKER_BORROWER_INFO_STEP } from "./types";
import {
  isLoanRequestOriginalPurchaseDate,
  isLoanRequestPurchaseDateField,
  shouldHidePropertyPurchaseDate,
  showResidentialPropertyArv,
  showResidentialPropertyConstructionCost,
  showResidentialPropertyMarketValue,
  showResidentialPropertyPurchasePrice,
  showResidentialPropertyRehabCost,
} from "./productRules";
import { isBase44BusinessCollateralProduct } from "../../lib/base44BusinessCollateral";
import type { FormDataType, LoanCategory } from "./types";

export interface ValidationContext {
  formData: FormDataType;
  selectedCategory: LoanCategory;
  selectedProduct: string;
  isCreResidentialLikeFlow: boolean;
  isCreBase44Flow: boolean;
  isSba7aBase44Flow: boolean;
  isAblBase44Flow: boolean;
  isBase44Flow: boolean;
  isBase44CollateralStep: boolean;
  isResidentialFlow: boolean;
  showDefaultEntityInfoFields: boolean;
  showDefaultPropertyInfoFields: boolean;
  showDefaultBorrowerInfoFields: boolean;
  usesBase44Financials: boolean;
  useResidentialBorrowerPanel: boolean;
  equityMismatchError: boolean;
  baseSteps: string[];
  /**
   * Embedded-only: index of the "are you a broker?" step when the public-embed
   * flow surfaces it. When undefined, this branch is treated as absent.
   */
  coBrokerStepIndex?: number;
}

export const validateFieldValue = (
  key: string,
  value: any,
  required: boolean = true,
) => {
  const trimmed = typeof value === "string" ? value.trim() : value;

  // Required
  if (required) {
    const isEmpty =
      trimmed === undefined ||
      trimmed === null ||
      trimmed === "" ||
      (Array.isArray(trimmed) && trimmed.length === 0);

    if (isEmpty) return "This field is required";
  }

  // Email
  if (key.toLowerCase().includes("email")) {
    if (trimmed && !EMAIL_REGEX.test(trimmed)) {
      return "Enter a valid email address";
    }
  }

  // Phone
  if (key.toLowerCase().includes("phone")) {
    if (trimmed && !PHONE_REGEX.test(trimmed)) {
      return "Enter a valid US phone number";
    }
  }

  // SSN
  if (key.toLowerCase().includes("ssn")) {
    if (trimmed && !SSN_REGEX.test(trimmed)) {
      return "Enter valid SSN (XXX-XX-XXXX)";
    }
  }

  // ZIP Code
  if (key.toLowerCase() === "zip") {
    if (trimmed && !ZIP_REGEX.test(trimmed)) {
      return "Enter a valid US ZIP Code (12345 or 12345-6789)";
    }
  }

  // Amount fields validation
  const amountKeys = [
    "amount",
    "sellerNoteAmount",
    "currentMarketValue",
    "purchasePrice",
    "afterRepairValue",
    "rehabCost",
    "constructionCost",
    "totalAssets",
    "totalLiabilities",
    "monthlyRent",
    "grossRevenueActual",
    "grossRevenueProforma",
    "noiActual",
    "noiProforma",
    "annualTaxes",
    "insurancePremium",
    "hoaDues",
    "noi",
  ];

  if (amountKeys.includes(key)) {
    const numeric = parseFloat(String(trimmed).replace(/,/g, ""));

    if (required && (!numeric || numeric <= 0)) {
      return "Amount must be greater than 0";
    }

    if (numeric < 0) {
      return "Amount cannot be negative";
    }
  }

  if (key === "interestRate") {
    const numeric = parseFloat(trimmed);
    if (numeric < 0) {
      return "Interest rate cannot be negative";
    }
  }

  if (key === "creditScore") {
    const score = parseInt(trimmed);
    if (score < 300 || score > 850) {
      return "Credit score must be between 300 and 850";
    }
  }

  return "";
};

const checkObject = (
  obj: Record<string, any>,
  prefix: string,
  newErrors: Record<string, string>,
) => {
  Object.entries(obj).forEach(([key, value]) => {
    if (
      key === "mailingAddress" ||
      key === "id" ||
      key === "dba" ||
      key === "ebitdaWithNoi" ||
      key === "naicsCode" ||
      key === "goodwillAmount" ||
      key === "inventoryIncluded" ||
      key === "inventoryValue" ||
      key === "equipmentIncluded" ||
      key === "equipmentValue" ||
      key === "hoaDues"
    )
      return;

    const error = validateFieldValue(key, value, true);

    if (error) {
      newErrors[`${prefix}.${key}`] = error;
    }
  });
};

export const collectStepValidationErrors = (
  stepIndex: number,
  ctx: ValidationContext,
) => {
  const newErrors: Record<string, string> = {};
  const {
    formData,
    selectedCategory,
    selectedProduct,
    isCreResidentialLikeFlow,
    isSba7aBase44Flow,
    isBase44CollateralStep,
    showDefaultEntityInfoFields,
    showDefaultPropertyInfoFields,
    usesBase44Financials,
    useResidentialBorrowerPanel,
    equityMismatchError,
    coBrokerStepIndex,
  } = ctx;
  const purpose = formData.loanRequest.purpose;
  const propertyPurchaseDateVisible =
    !!selectedProduct &&
    !shouldHidePropertyPurchaseDate(selectedProduct, purpose);

  // Embedded-only: "are you a broker?" step. Validate via the
  // referring-broker helpers in lib/referringBroker when this step is in scope.
  if (
    coBrokerStepIndex !== undefined &&
    stepIndex === coBrokerStepIndex
  ) {
    return validateReferringBrokerStep({
      workingWithMortgageBroker: formData.workingWithMortgageBroker || "",
      referringBroker:
        formData.referringBroker || {
          email: "",
          firstName: "",
          lastName: "",
          companyName: "",
          phone: "",
        },
    });
  }

  if (stepIndex === 0) {
    if (!selectedCategory) {
      newErrors["category"] = "Category is required";
    }

    if (!selectedProduct) {
      newErrors["selectedProduct"] = "Program selection is required";
    }

    if (selectedProduct) {
      if (!formData.loanRequest.purpose?.trim()) {
        newErrors["loanRequest.purpose"] = "Loan purpose is required";
      }

      const amount = toNumber(formData.loanRequest.amount);
      if (!amount || amount <= 0) {
        newErrors["loanRequest.amount"] =
          "Requested loan amount must be greater than 0";
      }

      if (
        isLoanRequestPurchaseDateField(selectedProduct, purpose) &&
        !formData.loanRequest.purchaseDate?.trim()
      ) {
        newErrors["loanRequest.purchaseDate"] =
          isLoanRequestOriginalPurchaseDate(selectedProduct, purpose)
            ? "Original purchase date is required"
            : "Purchase date is required";
      }
    }
  }

  if (stepIndex === 1) {
    if (showDefaultEntityInfoFields) {
      if (!formData.entity.legalName?.trim()) {
        newErrors["entity.legalName"] =
          "Legal business / entity name is required";
      }
      if (!formData.entity.entityType?.trim()) {
        newErrors["entity.entityType"] = "Entity type is required";
      }
      if (!formData.entity.formationDate?.trim()) {
        newErrors["entity.formationDate"] = "Formation date is required";
      }
      if (!formData.entity.yearsInBusiness?.trim()) {
        newErrors["entity.yearsInBusiness"] = "Years in business is required";
      } else {
        const years = Number(formData.entity.yearsInBusiness);
        if (years < 0) {
          newErrors["entity.yearsInBusiness"] =
            "Years in business cannot be negative";
        }
      }
    } else {
      checkObject(formData.entity, "entity", newErrors);

      const years = Number(formData.entity.yearsInBusiness);

      if (years < 0) {
        newErrors["entity.yearsInBusiness"] =
          "Years in business cannot be negative";
      }

      if (
        isSba7aBase44Flow &&
        formData.entity.inventoryIncluded &&
        toNumber(formData.entity.inventoryValue) <= 0
      ) {
        newErrors["entity.inventoryValue"] =
          "Inventory value must be greater than 0";
      }

      if (
        isSba7aBase44Flow &&
        formData.entity.equipmentIncluded &&
        toNumber(formData.entity.equipmentValue) <= 0
      ) {
        newErrors["entity.equipmentValue"] =
          "Equipment value must be greater than 0";
      }
    }
  }

  if (stepIndex === 2) {
    if (showDefaultPropertyInfoFields) {
      if (!formData.loanRequest.businessAddress?.trim()) {
        newErrors["loanRequest.businessAddress"] = "Property address is required";
      }
      if (!formData.loanRequest.city?.trim()) {
        newErrors["loanRequest.city"] = "City is required";
      }
      if (!formData.loanRequest.state?.trim()) {
        newErrors["loanRequest.state"] = "State is required";
      }
      if (!formData.loanRequest.zip?.trim()) {
        newErrors["loanRequest.zip"] = "ZIP is required";
      }
    } else if (isBase44CollateralStep) {
      if (!formData.loanRequest.propertyType?.trim()) {
        newErrors["loanRequest.propertyType"] =
          isBase44BusinessCollateralProduct(selectedProduct)
            ? "Business / industry type is required"
            : "Property type is required";
      }

      if (
        isCreResidentialLikeFlow &&
        !formData.loanRequest.subPropertyType?.trim()
      ) {
        newErrors["loanRequest.subPropertyType"] = "Sub property type is required";
      }

      if (!formData.loanRequest.businessAddress?.trim()) {
        newErrors["loanRequest.businessAddress"] = "Property address is required";
      }
      if (!formData.loanRequest.city?.trim()) {
        newErrors["loanRequest.city"] = "City is required";
      }
      if (!formData.loanRequest.state?.trim()) {
        newErrors["loanRequest.state"] = "State is required";
      }
      if (!formData.loanRequest.zip?.trim()) {
        newErrors["loanRequest.zip"] = "ZIP is required";
      }

      if (
        showResidentialPropertyPurchasePrice(selectedProduct, purpose) &&
        toNumber(formData.loanRequest.purchasePrice) <= 0
      ) {
        newErrors["loanRequest.purchasePrice"] =
          "Purchase price must be greater than 0";
      }

      if (
        showResidentialPropertyPurchasePrice(selectedProduct, purpose) &&
        equityMismatchError
      ) {
        newErrors["loanRequest.downPayment"] =
          "Loan Amount + Down Payment + Seller Financing must equal the Purchase Price";
      }

      if (
        showResidentialPropertyMarketValue(selectedProduct, purpose) &&
        toNumber(formData.loanRequest.currentMarketValue) <= 0
      ) {
        newErrors["loanRequest.currentMarketValue"] =
          "Current market value must be greater than 0";
      }

      if (
        showResidentialPropertyArv(selectedProduct) &&
        toNumber(formData.loanRequest.afterRepairValue) <= 0
      ) {
        newErrors["loanRequest.afterRepairValue"] =
          "After repair value must be greater than 0";
      }

      if (
        showResidentialPropertyRehabCost(selectedProduct) &&
        toNumber(formData.loanRequest.rehabCost) <= 0
      ) {
        newErrors["loanRequest.rehabCost"] = "Rehab cost must be greater than 0";
      }

      if (
        showResidentialPropertyConstructionCost(selectedProduct) &&
        toNumber(formData.loanRequest.constructionCost) <= 0
      ) {
        newErrors["loanRequest.constructionCost"] =
          "Construction cost must be greater than 0";
      }

      if (
        propertyPurchaseDateVisible &&
        !formData.loanRequest.purchaseDate?.trim()
      ) {
        newErrors["loanRequest.purchaseDate"] = "Purchase date is required";
      }
    } else {
      Object.entries(formData.loanRequest).forEach(([key, value]) => {
        if (OPTIONAL_LOAN_REQUEST_KEYS.has(key)) return;
        if (
          shouldHidePropertyPurchaseDate(selectedProduct, purpose) &&
          key === "purchaseDate"
        ) {
          return;
        }

        const error = validateFieldValue(key, value, true);
        if (error) {
          newErrors[`loanRequest.${key}`] = error;
        }
      });

      const assets = toNumber(formData.loanRequest.totalAssets);
      const liabilities = toNumber(formData.loanRequest.totalLiabilities);

      if (assets <= 0) {
        newErrors["loanRequest.totalAssets"] = "Total Assets must be greater than 0";
      }

      if (liabilities < 0) {
        newErrors["loanRequest.totalLiabilities"] = "Liabilities cannot be negative";
      }

      if (!formData.loanRequest.businessAddress) {
        newErrors["loanRequest.businessAddress"] = "Address is required";
      }
      if (!formData.loanRequest.city) {
        newErrors["loanRequest.city"] = "City is required";
      }
      if (!formData.loanRequest.state) {
        newErrors["loanRequest.state"] = "State is required";
      }
      if (!formData.loanRequest.zip) {
        newErrors["loanRequest.zip"] = "ZIP is required";
      }
    }
  }

  if (stepIndex === 3) {
    if (useResidentialBorrowerPanel) {
      if (!formData.borrower.firstName?.trim()) {
        newErrors["borrower.firstName"] = "First name is required";
      }
      if (!formData.borrower.lastName?.trim()) {
        newErrors["borrower.lastName"] = "Last name is required";
      }

      if (formData.borrower.phone?.trim()) {
        const phoneError = validateFieldValue("phone", formData.borrower.phone, false);
        if (phoneError) newErrors["borrower.phone"] = phoneError;
      }
      if (formData.borrower.email?.trim()) {
        const emailError = validateFieldValue("email", formData.borrower.email, false);
        if (emailError) newErrors["borrower.email"] = emailError;
      }
      if (formData.borrower.ssn?.trim()) {
        const ssnError = validateFieldValue("ssn", formData.borrower.ssn, false);
        if (ssnError) newErrors["borrower.ssn"] = ssnError;
      }

      formData.coBorrowers.forEach((b, index) => {
        if (!b.firstName?.trim()) {
          newErrors[`coBorrowers.${index}.firstName`] = "First name is required";
        }
        if (!b.lastName?.trim()) {
          newErrors[`coBorrowers.${index}.lastName`] = "Last name is required";
        }
      });

      Object.assign(
        newErrors,
        collectDeclarationErrors(
          formData.borrower.declarations ?? createEmptyDeclarations(),
          "borrower",
        ),
      );

      formData.coBorrowers.forEach((b, index) => {
        Object.assign(
          newErrors,
          collectDeclarationErrors(
            b.declarations ?? createEmptyDeclarations(),
            `coBorrowers.${index}`,
          ),
        );
      });
    } else {
      checkObject(formData.borrower, "borrower", newErrors);

      formData.coBorrowers.forEach((b, index) => {
        checkObject(
          {
            name: b.name,
            entityName: b.entityName,
            phone: b.phone,
            email: b.email,
            employer: b.employer,
            dob: b.dob,
            ssn: b.ssn,
            creditScore: b.creditScore,
            address: b.address,
            city: b.city,
            state: b.state,
          },
          `coBorrowers.${index}`,
          newErrors,
        );

        const financialFields = [
          "currentMarketValue",
          "purchasePrice",
          "interestRate",
          "noi",
          "totalAssets",
          "totalLiabilities",
        ];

        financialFields.forEach((field) => {
          const value = (b as any)[field];
          const error = validateFieldValue(field, value, true);

          if (error) {
            newErrors[`coBorrowers.${index}.${field}`] = error;
          }
        });
      });
    }
  }

  if (stepIndex === 4 && !usesBase44Financials) {
    checkObject(formData.loanTermIncome, "loanTermIncome", newErrors);

    const loanTerm = Number(formData.loanTermIncome.loanTerm);
    if (loanTerm && loanTerm <= 0) {
      newErrors["loanTermIncome.loanTerm"] = "Loan term must be greater than 0";
    }

    const noi = Number(formData.loanTermIncome.noiActual);
    if (noi && noi < 0) {
      newErrors["loanTermIncome.noiActual"] = "NOI cannot be negative";
    }
  }

  return newErrors;
};

export const collectDynamicSectionErrors = (sectionIndex: number, dynamicSections: any[], dynamicFormData: Record<string, any>) => {
  const newErrors: Record<string, string> = {};
  const section = dynamicSections[sectionIndex];
  if (!section) return newErrors;

  const visibleFields = section.fields.filter((field: any) => {
    const normalized = (field.fieldKey || field.label || "")
      .toLowerCase()
      .replace(/\s+/g, "");

    return !STATIC_FIELD_KEYS.map((k) =>
      k.toLowerCase().replace(/\s+/g, ""),
    ).includes(normalized);
  });

  visibleFields.forEach((field: any) => {
    const value = dynamicFormData[field.fieldId];

    const error = validateFieldValue(
      field.label || field.fieldKey,
      value,
      field.required,
    );

    if (error) {
      newErrors[`dynamic.${field.fieldId}`] = error;
    }
  });

  return newErrors;
};

export const validateAllStepsBeforeSubmit = (
  ctx: ValidationContext,
  dynamicSections: any[],
  dynamicFormData: Record<string, any>,
) => {
  let newErrors: Record<string, string> = {};

  for (let i = 0; i < ctx.baseSteps.length; i++) {
    newErrors = { ...newErrors, ...collectStepValidationErrors(i, ctx) };
  }

  dynamicSections.forEach((_, sectionIndex) => {
    newErrors = {
      ...newErrors,
      ...collectDynamicSectionErrors(sectionIndex, dynamicSections, dynamicFormData),
    };
  });

  return newErrors;
};

export const getReviewValidationIssues = (ctx: ValidationContext): ReviewValidationIssue[] => {
  const {
    formData,
    selectedCategory,
    selectedProduct,
    isCreResidentialLikeFlow,
    isSba7aBase44Flow,
    isBase44Flow,
    showDefaultPropertyInfoFields,
    showDefaultBorrowerInfoFields,
    useResidentialBorrowerPanel,
    equityMismatchError,
    coBrokerStepIndex,
  } = ctx;

  if (!isBase44Flow) return [];

  const issues: ReviewValidationIssue[] = [];
  const add = (label: string, stepIndex: number, missing: boolean) => {
    if (missing) issues.push({ label, stepIndex });
  };

  add("Loan Category", 0, !selectedCategory);
  add("Loan Program", 0, !selectedProduct);
  add("Loan Purpose", 0, !formData.loanRequest.purpose?.trim());
  add("Loan Amount", 0, toNumber(formData.loanRequest.amount) <= 0);
  add("Closing Date", 0, !formData.loanRequest.estimatedClosingDate?.trim());

  if (
    selectedProduct &&
    isLoanRequestPurchaseDateField(
      selectedProduct,
      formData.loanRequest.purpose,
    ) &&
    !formData.loanRequest.purchaseDate?.trim()
  ) {
    add(
      isLoanRequestOriginalPurchaseDate(
        selectedProduct,
        formData.loanRequest.purpose,
      )
        ? "Original Purchase Date"
        : "Purchase Date",
      0,
      true,
    );
  }

  add("Legal Business / Entity Name", 1, !formData.entity.legalName?.trim());
  add("Entity Type", 1, !formData.entity.entityType?.trim());
  add("Formation Date", 1, !formData.entity.formationDate?.trim());
  add("Years in Business", 1, !formData.entity.yearsInBusiness?.trim());

  const purpose = formData.loanRequest.purpose;

  if (showDefaultPropertyInfoFields) {
    add("Property Address", 2, !formData.loanRequest.businessAddress?.trim());
    add("City", 2, !formData.loanRequest.city?.trim());
    add("State", 2, !formData.loanRequest.state?.trim());
    add("ZIP", 2, !formData.loanRequest.zip?.trim());
  } else {
    add(
      isBase44BusinessCollateralProduct(selectedProduct)
        ? "Business / Industry Type"
        : "Property Type",
      2,
      !formData.loanRequest.propertyType?.trim(),
    );
    add(
      isBase44BusinessCollateralProduct(selectedProduct)
        ? "Business Address"
        : "Property Address",
      2,
      !formData.loanRequest.businessAddress?.trim(),
    );
    add("City", 2, !formData.loanRequest.city?.trim());
    add("State", 2, !formData.loanRequest.state?.trim());
    add("ZIP", 2, !formData.loanRequest.zip?.trim());

    if (isCreResidentialLikeFlow && !formData.loanRequest.subPropertyType?.trim()) {
      add("Sub Property Type", 2, true);
    }

    if (
      selectedProduct &&
      !shouldHidePropertyPurchaseDate(selectedProduct, purpose) &&
      !formData.loanRequest.purchaseDate?.trim()
    ) {
      add("Purchase Date", 2, true);
    }

    if (
      showResidentialPropertyPurchasePrice(selectedProduct, purpose) &&
      toNumber(formData.loanRequest.purchasePrice) <= 0
    ) {
      add("Purchase Price", 2, true);
    }

    if (
      showResidentialPropertyPurchasePrice(selectedProduct, purpose) &&
      equityMismatchError
    ) {
      add("Down Payment", 2, true);
    }

    if (
      showResidentialPropertyRehabCost(selectedProduct) &&
      toNumber(formData.loanRequest.rehabCost) <= 0
    ) {
      add("Rehab Cost", 2, true);
    }

    if (
      showResidentialPropertyConstructionCost(selectedProduct) &&
      toNumber(formData.loanRequest.constructionCost) <= 0
    ) {
      add("Construction Cost", 2, true);
    }

    if (
      showResidentialPropertyMarketValue(selectedProduct, purpose) &&
      toNumber(formData.loanRequest.currentMarketValue) <= 0
    ) {
      add("Current Market Value (As-Is)", 2, true);
    }

    if (
      showResidentialPropertyArv(selectedProduct) &&
      toNumber(formData.loanRequest.afterRepairValue) <= 0
    ) {
      add("After Repair Value (ARV)", 2, true);
    }
  }

  add("Borrower First Name", 3, !formData.borrower.firstName?.trim());
  add("Borrower Last Name", 3, !formData.borrower.lastName?.trim());

  if (!showDefaultBorrowerInfoFields) {
    add("Borrower Email", 3, !formData.borrower.email?.trim());
    add("Borrower Phone", 3, !formData.borrower.phone?.trim());
    add("Borrower Credit Score", 3, !formData.borrower.creditScore?.trim());
  }

  formData.coBorrowers.forEach((borrower, index) => {
    add(
      `Co-Borrower ${index + 1} First Name`,
      3,
      !borrower.firstName?.trim(),
    );
    add(`Co-Borrower ${index + 1} Last Name`, 3, !borrower.lastName?.trim());
  });

  if (useResidentialBorrowerPanel) {
    DECLARATION_QUESTIONS.forEach(({ key, label }) => {
      add(
        `Borrower: ${label}`,
        3,
        !isDeclarationAnswered(formData.borrower.declarations?.[key] ?? ""),
      );
    });

    formData.coBorrowers.forEach((borrower, index) => {
      DECLARATION_QUESTIONS.forEach(({ key, label }) => {
        add(
          `Co-Borrower ${index + 1}: ${label}`,
          3,
          !isDeclarationAnswered(borrower.declarations?.[key] ?? ""),
        );
      });
    });
  }

  if (formData.borrower.email?.trim()) {
    const emailError = validateFieldValue("email", formData.borrower.email, false);
    if (emailError) add("Borrower Email", 3, true);
  }

  if (formData.borrower.phone?.trim()) {
    const phoneError = validateFieldValue("phone", formData.borrower.phone, false);
    if (phoneError) add("Borrower Phone", 3, true);
  }

  if (formData.borrower.creditScore?.trim()) {
    const creditError = validateFieldValue(
      "creditScore",
      formData.borrower.creditScore,
      false,
    );
    if (creditError) add("Borrower Credit Score", 3, true);
  }

  // Embedded-only: "are you a broker?" review issues, attached to its
  // dynamically-determined step index when present.
  if (coBrokerStepIndex !== undefined) {
    const referringErrors = validateReferringBrokerStep({
      workingWithMortgageBroker: formData.workingWithMortgageBroker || "",
      referringBroker:
        formData.referringBroker || {
          email: "",
          firstName: "",
          lastName: "",
          companyName: "",
          phone: "",
        },
    });
    if (referringErrors.workingWithMortgageBroker) {
      add("Mortgage Broker Question", coBrokerStepIndex, true);
    }
    if (referringErrors["referringBroker.email"]) {
      add("Referring Broker Email", coBrokerStepIndex, true);
    }
    if (referringErrors["referringBroker.firstName"]) {
      add("Referring Broker First Name", coBrokerStepIndex, true);
    }
    if (referringErrors["referringBroker.lastName"]) {
      add("Referring Broker Last Name", coBrokerStepIndex, true);
    }
    if (referringErrors["referringBroker.companyName"]) {
      add("Referring Broker Company", coBrokerStepIndex, true);
    }
    if (referringErrors["referringBroker.phone"]) {
      add("Referring Broker Phone", coBrokerStepIndex, true);
    }
  }

  if (
    !showDefaultBorrowerInfoFields &&
    isSba7aBase44Flow &&
    formData.entity.inventoryIncluded &&
    toNumber(formData.entity.inventoryValue) <= 0
  ) {
    add("Inventory Value", 1, true);
  }

  if (
    !showDefaultBorrowerInfoFields &&
    isSba7aBase44Flow &&
    formData.entity.equipmentIncluded &&
    toNumber(formData.entity.equipmentValue) <= 0
  ) {
    add("Equipment Value", 1, true);
  }

  const yearsInBusiness = Number(formData.entity.yearsInBusiness);
  if (formData.entity.yearsInBusiness?.trim() && yearsInBusiness < 0) {
    add("Years in Business", 1, true);
  }

  return issues;
};

// Re-export the step label so consumers can do `import { CO_BROKER_BORROWER_INFO_STEP } from "./validation"`.
export { CO_BROKER_BORROWER_INFO_STEP };
