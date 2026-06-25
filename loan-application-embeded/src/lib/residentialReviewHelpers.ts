import type { PendingApplicationDocument } from "./applicationDocumentTypes";
import type { ResidentialFinancials } from "./residentialFinancials";
import {
  isSba7aAcquisitionProduct,
  isSbaRealEstateCollateralProduct,
} from "./sba7aAcquisition";
import {
  isEquipmentFinanceProduct,
  showAblBase44PurchasePrice,
  showEquipmentFinanceMarketValue,
} from "./ablBase44";
import { isBase44BusinessCollateralProduct } from "./base44BusinessCollateral";

export type ReviewSummaryRow = {
  label: string;
  value: string;
};

export type ReviewSummarySection = {
  stepIndex: number;
  title: string;
  rows: ReviewSummaryRow[];
  extraContent?: "documents" | "broker-notice";
};

export type ReviewValidationIssue = {
  label: string;
  stepIndex: number;
};

const displayValue = (value: string | undefined | null, fallback = "—") =>
  value?.trim() ? value.trim() : fallback;

const formatMoney = (value: string) => {
  const cleaned = (value || "").replace(/,/g, "");
  const num = parseFloat(cleaned);
  if (!num) return "—";
  return `$${num.toLocaleString("en-US")}`;
};

export const buildResidentialReviewSections = ({
  loanRequest,
  entity,
  borrower,
  financials,
  pendingDocuments,
  productLabel,
  selectedProduct,
}: {
  loanRequest: {
    purpose: string;
    amount: string;
    rateType: string;
    interestRate: string;
    propertyType: string;
    businessAddress: string;
    city: string;
    state: string;
    zip: string;
    purchasePrice: string;
    estimatedClosingDate: string;
    numberOfUnits: string;
    rehabCost: string;
    afterRepairValue: string;
    currentMarketValue: string;
    constructionCost: string;
  };
  entity: {
    legalName: string;
    entityType: string;
    dba: string;
    formationDate: string;
    yearsInBusiness: string;
    ebitdaWithNoi: string;
    naicsCode?: string;
    goodwillAmount?: string;
    inventoryIncluded?: boolean;
    inventoryValue?: string;
    equipmentIncluded?: boolean;
    equipmentValue?: string;
  };
  borrower: {
    firstName: string;
    lastName: string;
    entityOwnershipPercent: string;
    realEstateOwned: { id: number }[];
  };
  financials: ResidentialFinancials;
  pendingDocuments: PendingApplicationDocument[];
  productLabel: string;
  selectedProduct: string;
}): ReviewSummarySection[] => {
  const isFixAndFlip = selectedProduct === "FIX_AND_FLIP_LOAN_1_TO_4_UNITS";
  const isConstruction = selectedProduct === "CONSTRUCTION_LOAN_1_TO_4_UNITS";
  const isRentalPortfolio = selectedProduct === "RENTAL_PORTFOLIO";
  const isMezzanine = selectedProduct === "MEZZANINE_FINANCE";
  const isBusinessCollateral = isBase44BusinessCollateralProduct(selectedProduct);
  const isSba7aAcquisition = isSba7aAcquisitionProduct(selectedProduct);
  const isSba7aRealEstate = isSbaRealEstateCollateralProduct(selectedProduct);
  const isEquipmentFinance = isEquipmentFinanceProduct(selectedProduct);
  const isCrePermanent = selectedProduct === "CRE_PERMANENT_LOAN";
  const isAgencyMultifamily = selectedProduct === "AGENCY_LOAN_MULTIFAMILY";
  const isBridge =
    selectedProduct === "BRIDGE_LOAN_1_TO_4_UNITS" ||
    selectedProduct === "BRIDGE_LOAN";
  const purpose = loanRequest.purpose;
  const showPurchasePrice =
    purpose === "Purchase/Acquisition" ||
    purpose === "Purchase & Rehab" ||
    purpose === "Purchase" ||
    purpose === "Portfolio Blanket" ||
    isConstruction ||
    isRentalPortfolio ||
    isMezzanine ||
    isSba7aAcquisition ||
    showAblBase44PurchasePrice(selectedProduct, purpose) ||
    isSba7aRealEstate ||
    (isBridge && purpose === "Purchase/Acquisition");
  const showMarketValue =
    purpose === "Refinance (Rate & Term)" ||
    purpose === "Cash Out Refinance" ||
    purpose === "Refinance & Rehab" ||
    purpose === "Refinance" ||
    (isBridge && purpose === "Construction Completion") ||
    (isCrePermanent && purpose === "Recapitalization") ||
    (isAgencyMultifamily &&
      (purpose === "Affordable Housing" || purpose === "Supplement Loan")) ||
    (isSba7aRealEstate &&
      (purpose === "Refinance" ||
        purpose === "Refinance & Rehab" ||
        purpose === "Refinance (504 Debt)" ||
        purpose === "Debt Refinancing")) ||
    (isEquipmentFinance && showEquipmentFinanceMarketValue(purpose));

  const propertyRows: ReviewSummaryRow[] = [
    {
      label: isBusinessCollateral
        ? "Business / Industry Type"
        : "Property Type",
      value: displayValue(loanRequest.propertyType),
    },
    {
      label: isBusinessCollateral ? "Business Address" : "Property Address",
      value: displayValue(loanRequest.businessAddress),
    },
    { label: "City", value: displayValue(loanRequest.city) },
    { label: "State", value: displayValue(loanRequest.state) },
    { label: "ZIP", value: displayValue(loanRequest.zip) },
  ];

  if (loanRequest.numberOfUnits?.trim()) {
    propertyRows.push({
      label: "Number of Units",
      value: displayValue(loanRequest.numberOfUnits),
    });
  }

  if (showPurchasePrice && loanRequest.purchasePrice?.trim()) {
    propertyRows.push({
      label: "Purchase Price",
      value: formatMoney(loanRequest.purchasePrice),
    });
  }

  if (isFixAndFlip && loanRequest.rehabCost?.trim()) {
    propertyRows.push({
      label: "Rehab Cost",
      value: formatMoney(loanRequest.rehabCost),
    });
  }

  if (isConstruction && loanRequest.constructionCost?.trim()) {
    propertyRows.push({
      label: "Construction Cost",
      value: formatMoney(loanRequest.constructionCost),
    });
  }

  if (showMarketValue && loanRequest.currentMarketValue?.trim()) {
    propertyRows.push({
      label: "Current Market Value (As-Is)",
      value: formatMoney(loanRequest.currentMarketValue),
    });
  }

  if ((isFixAndFlip || isConstruction) && loanRequest.afterRepairValue?.trim()) {
    propertyRows.push({
      label: "After Repair Value / ARV",
      value: formatMoney(loanRequest.afterRepairValue),
    });
  }

  return [
  {
    stepIndex: 0,
    title: "Loan Request",
    rows: [
      { label: "Loan Type", value: displayValue(productLabel) },
      { label: "Loan Purpose", value: displayValue(loanRequest.purpose) },
      { label: "Loan Amount", value: formatMoney(loanRequest.amount) },
      {
        label: "Rate Type",
        value: displayValue(loanRequest.rateType?.toLowerCase()),
      },
      ...(loanRequest.interestRate?.trim()
        ? [
            {
              label: "Interest Rate",
              value: `${loanRequest.interestRate}%`,
            },
          ]
        : []),
      {
        label: "Closing Date",
        value: displayValue(loanRequest.estimatedClosingDate),
      },
    ],
  },
  {
    stepIndex: 1,
    title: "Entity Info",
    rows: [
      { label: "Legal Name", value: displayValue(entity.legalName) },
      { label: "Entity Type", value: displayValue(entity.entityType) },
      { label: "DBA", value: displayValue(entity.dba, "—") },
      { label: "Formation Date", value: displayValue(entity.formationDate) },
      {
        label: "Years in Business",
        value: displayValue(entity.yearsInBusiness),
      },
      ...(entity.ebitdaWithNoi?.trim()
        ? [
            {
              label: "EBITDA with NOI",
              value: formatMoney(entity.ebitdaWithNoi),
            },
          ]
        : []),
      ...(entity.naicsCode?.trim()
        ? [{ label: "Industry Code (NAICS)", value: entity.naicsCode.trim() }]
        : []),
      ...(entity.goodwillAmount?.trim()
        ? [
            {
              label: "Goodwill Amount",
              value: formatMoney(entity.goodwillAmount),
            },
          ]
        : []),
      ...(entity.inventoryIncluded
        ? [
            { label: "Inventory Included", value: "Yes" },
            ...(entity.inventoryValue?.trim()
              ? [
                  {
                    label: "Inventory Value",
                    value: formatMoney(entity.inventoryValue),
                  },
                ]
              : []),
          ]
        : []),
      ...(entity.equipmentIncluded
        ? [
            { label: "Equipment Included", value: "Yes" },
            ...(entity.equipmentValue?.trim()
              ? [
                  {
                    label: "Equipment Value",
                    value: formatMoney(entity.equipmentValue),
                  },
                ]
              : []),
          ]
        : []),
    ],
  },
  {
    stepIndex: 2,
    title: "Collateral / Property",
    rows: propertyRows,
  },
  {
    stepIndex: 3,
    title: "Borrower Info",
    rows: [
      {
        label: "Borrower 1",
        value: [borrower.firstName, borrower.lastName].filter(Boolean).join(" ") || "—",
      },
      {
        label: "Ownership %",
        value: borrower.entityOwnershipPercent
          ? `${borrower.entityOwnershipPercent}%`
          : "—",
      },
      {
        label: "Properties in RE Schedule",
        value: String(borrower.realEstateOwned.length),
      },
    ],
  },
  {
    stepIndex: 4,
    title: "Financials",
    rows: [
      {
        label: "Flood Zone",
        value: financials.inFloodZone ? "Yes" : "No",
      },
      {
        label: "Rental Property",
        value: financials.rentalProperty ? "Yes" : "No",
      },
    ],
  },
  {
    stepIndex: 5,
    title: "Documents & Signature",
    rows: [],
    extraContent: pendingDocuments.length > 0 ? "documents" : "broker-notice",
  },
];
};
