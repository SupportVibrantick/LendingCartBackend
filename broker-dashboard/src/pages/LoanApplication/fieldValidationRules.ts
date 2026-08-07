// Per-field validation rules for the LoanApplication form.
// Captured field-by-field from the user. min/max in numeric units (dollars, percent, months, chars).
// Required flag is the contract: true means the field must have a value.

export interface FieldValidationRule {
  min?: number;
  max?: number;
  required: boolean;
  errorMessage?: string;
  pattern?: "email" | "phone" | "ssn" | "zip" | "futureDate" | "pastDate" | "currency" | "percent";
  minLength?: number;
  maxLength?: number;
}

export const FIELD_VALIDATION_RULES: Record<string, FieldValidationRule> = {
  // ============================================================
  // STEP 1 — Loan Request
  // ============================================================
  "loanRequest.amount": {
    min: 1000,
    max: 100000000,
    required: true,
    errorMessage: "Loan amount must be between $1,000 and $100,000,000",
    pattern: "currency",
  },
  "loanRequest.interestRate": {
    min: 0,
    max: 100,
    required: false,
    errorMessage: "Interest rate must be between 0% and 100%",
    pattern: "percent",
  },
  "loanRequest.loanTerm": {
    min: 1,
    max: 360,
    required: false,
    errorMessage: "Loan term must be between 1 and 360 months",
  },
  "loanRequest.estimatedClosingDate": {
    required: false,
    pattern: "futureDate",
    errorMessage: "Closing date must be in the future",
  },
  "loanRequest.sellerNoteAmount": {
    min: 0,
    required: false,
    errorMessage: "Seller note amount cannot be negative",
    pattern: "currency",
  },
  "loanRequest.selectedProduct": { required: true, errorMessage: "Loan program is required" },
  "loanRequest.purpose": { required: true, errorMessage: "Loan purpose is required" },
  "loanRequest.subPurpose": { required: true, errorMessage: "Sub-purpose is required" },
  "loanRequest.recourse": { required: false },
  "loanRequest.rateType": { required: false },

  // ============================================================
  // STEP 1 (cont.) — Purchase / property / valuation extras
  // ============================================================
  "loanRequest.brokerPoints": {
    min: 0,
    max: 10,
    required: false,
    errorMessage: "Broker points must be between 0% and 10%",
    pattern: "percent",
  },
  "loanRequest.amortization": {
    min: 1,
    max: 40,
    required: false,
    errorMessage: "Amortization must be between 1 and 40 years",
  },
  "loanRequest.purchaseDate": {
    required: false,
    pattern: "pastDate",
    errorMessage: "Purchase date must be in the past or today",
  },
  "loanRequest.purchasePrice": {
    min: 1,
    max: 100000000,
    required: true,
    errorMessage: "Purchase price must be between $1 and $100,000,000",
    pattern: "currency",
  },
  "loanRequest.downPayment": {
    min: 0,
    max: 100000000,
    required: true,
    errorMessage: "Down payment must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "loanRequest.rehabCost": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "Rehab cost must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "loanRequest.afterRepairValue": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "ARV must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "loanRequest.currentMarketValue": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "Property value must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "loanRequest.currentLoanBalance": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "Loan balance must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "loanRequest.constructionCost": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "Construction cost must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "loanRequest.useOfFunds": {
    minLength: 5,
    maxLength: 2000,
    required: false,
    errorMessage: "Use of funds must be between 5 and 2000 characters",
  },
  "loanRequest.exitStrategy": {
    minLength: 5,
    maxLength: 2000,
    required: false,
    errorMessage: "Exit strategy must be between 5 and 2000 characters",
  },

  // ============================================================
  // STEP 2 — Entity Info
  // ============================================================
  "entity.legalName": {
    minLength: 2,
    maxLength: 200,
    required: true,
    errorMessage: "Legal name must be between 2 and 200 characters",
  },
  "entity.entityType": {
    required: true,
    errorMessage: "Entity type is required",
  },
  "entity.dba": {
    maxLength: 100,
    required: false,
    errorMessage: "DBA must be at most 100 characters",
  },
  "entity.formationDate": {
    required: true,
    pattern: "pastDate",
    errorMessage: "Formation date must be in the past or today",
  },
  "entity.yearsInBusiness": {
    min: 0,
    max: 200,
    required: true,
    errorMessage: "Years in business must be between 0 and 200",
  },
  "entity.naicsCode": {
    minLength: 2,
    maxLength: 10,
    required: false,
    errorMessage: "NAICS code must be between 2 and 10 digits",
  },
  "entity.goodwillAmount": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "Goodwill amount must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "entity.inventoryValue": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "Inventory value must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "entity.equipmentValue": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "Equipment value must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "entity.ebitdaWithNoi": {
    min: 0,
    max: 1000000000,
    required: false,
    errorMessage: "EBITDA with NOI must be between $0 and $1,000,000,000",
    pattern: "currency",
  },
  "entity.inventoryIncluded": { required: false },
  "entity.equipmentIncluded": { required: false },

  // ============================================================
  // STEP 3 — Property / Collateral Info
  // ============================================================
  "loanRequest.businessAddress": {
    minLength: 5,
    maxLength: 200,
    required: true,
    errorMessage: "Address must be between 5 and 200 characters",
  },
  "loanRequest.city": {
    minLength: 2,
    maxLength: 50,
    required: true,
    errorMessage: "City must be between 2 and 50 characters",
  },
  "loanRequest.state": {
    required: true,
    errorMessage: "State is required",
  },
  "loanRequest.zip": {
    required: true,
    pattern: "zip",
    errorMessage: "Enter a valid US ZIP (12345 or 12345-6789)",
  },
  "loanRequest.propertyType": {
    required: true,
    errorMessage: "Property type is required",
  },
  "loanRequest.subPropertyType": {
    required: true,
    errorMessage: "Sub property type is required",
  },
  "loanRequest.numberOfUnits": {
    min: 0,
    max: 10000,
    required: false,
    errorMessage: "Number of units must be between 0 and 10,000",
  },
  "loanRequest.totalAssets": {
    min: 1,
    max: 1000000000,
    required: true,
    errorMessage: "Total assets must be between $1 and $1,000,000,000",
    pattern: "currency",
  },
  "loanRequest.totalLiabilities": {
    min: 0,
    max: 1000000000,
    required: true,
    errorMessage: "Total liabilities must be between $0 and $1,000,000,000",
    pattern: "currency",
  },
  "loanRequest.collateralType": {
    required: true,
    errorMessage: "Business / industry type is required",
  },
  "loanRequest.privateSale": { required: false },
  "loanRequest.vendorName": {
    maxLength: 100,
    required: false,
    errorMessage: "Vendor name must be at most 100 characters",
  },
  "loanRequest.vendorPhone": {
    required: false,
    pattern: "phone",
    errorMessage: "Enter a valid US phone number",
  },

  // ============================================================
  // STEP 4 — Borrower Info
  // ============================================================
  "borrower.name": {
    minLength: 2,
    maxLength: 100,
    required: true,
    errorMessage: "Name must be between 2 and 100 characters",
  },
  "borrower.entityName": {
    minLength: 2,
    maxLength: 200,
    required: true,
    errorMessage: "Entity name must be between 2 and 200 characters",
  },
  "borrower.phone": {
    required: true,
    pattern: "phone",
    errorMessage: "Enter a valid US phone number (XXX) XXX-XXXX",
  },
  "borrower.email": {
    required: true,
    pattern: "email",
    errorMessage: "Enter a valid email address",
  },
  "borrower.employer": {
    minLength: 2,
    maxLength: 100,
    required: true,
    errorMessage: "Employer must be between 2 and 100 characters",
  },
  "borrower.dob": {
    required: true,
    pattern: "pastDate",
    errorMessage: "DOB must be in the past and borrower must be 18+",
  },
  "borrower.ssn": {
    required: true,
    pattern: "ssn",
    errorMessage: "Enter valid SSN (XXX-XX-XXXX)",
  },
  "borrower.creditScore": {
    min: 300,
    max: 850,
    required: true,
    errorMessage: "Credit score must be between 300 and 850",
  },
  "borrower.address": {
    minLength: 5,
    maxLength: 200,
    required: true,
    errorMessage: "Address must be between 5 and 200 characters",
  },
  "borrower.city": {
    minLength: 2,
    maxLength: 50,
    required: true,
    errorMessage: "City must be between 2 and 50 characters",
  },
  "borrower.state": {
    required: true,
    errorMessage: "State is required",
  },
  "borrower.mailingAddress": {
    maxLength: 200,
    required: false,
    errorMessage: "Mailing address must be at most 200 characters",
  },
  "borrower.firstName": {
    minLength: 1,
    maxLength: 100,
    required: true,
    errorMessage: "First name is required",
  },
  "borrower.lastName": {
    minLength: 1,
    maxLength: 100,
    required: true,
    errorMessage: "Last name is required",
  },
  "borrower.legalStatus": { required: false },
  "borrower.entityOwnershipPercent": {
    min: 0,
    max: 100,
    required: false,
    errorMessage: "Ownership must be between 0% and 100%",
  },
  "borrower.similarProjectsCompleted": {
    min: 0,
    max: 1000,
    required: false,
    errorMessage: "Must be between 0 and 1000",
  },
  "borrower.yearsOfExperience": {
    min: 0,
    max: 100,
    required: false,
    errorMessage: "Years of experience must be between 0 and 100",
  },
  "borrower.totalCashReserves": {
    min: 0,
    max: 1000000000,
    required: false,
    errorMessage: "Cash reserves must be between $0 and $1,000,000,000",
    pattern: "currency",
  },

  // ============================================================
  // STEP 4 — Co-Borrower (same shape as borrower)
  // ============================================================
  "coBorrower.name": {
    minLength: 2,
    maxLength: 100,
    required: true,
    errorMessage: "Co-borrower name must be between 2 and 100 characters",
  },
  "coBorrower.entityName": {
    minLength: 2,
    maxLength: 200,
    required: true,
    errorMessage: "Co-borrower entity name must be between 2 and 200 characters",
  },
  "coBorrower.phone": {
    required: true,
    pattern: "phone",
    errorMessage: "Enter a valid US phone number",
  },
  "coBorrower.email": {
    required: true,
    pattern: "email",
    errorMessage: "Enter a valid email address",
  },
  "coBorrower.employer": {
    minLength: 2,
    maxLength: 100,
    required: true,
    errorMessage: "Employer must be between 2 and 100 characters",
  },
  "coBorrower.dob": {
    required: true,
    pattern: "pastDate",
    errorMessage: "DOB must be in the past and co-borrower must be 18+",
  },
  "coBorrower.ssn": {
    required: true,
    pattern: "ssn",
    errorMessage: "Enter valid SSN (XXX-XX-XXXX)",
  },
  "coBorrower.creditScore": {
    min: 300,
    max: 850,
    required: true,
    errorMessage: "Credit score must be between 300 and 850",
  },
  "coBorrower.address": {
    minLength: 5,
    maxLength: 200,
    required: true,
    errorMessage: "Address must be between 5 and 200 characters",
  },
  "coBorrower.city": {
    minLength: 2,
    maxLength: 50,
    required: true,
    errorMessage: "City must be between 2 and 50 characters",
  },
  "coBorrower.state": {
    required: true,
    errorMessage: "State is required",
  },
  "coBorrower.mailingAddress": {
    maxLength: 200,
    required: false,
  },
  "coBorrower.firstName": {
    minLength: 1,
    maxLength: 100,
    required: true,
    errorMessage: "First name is required",
  },
  "coBorrower.lastName": {
    minLength: 1,
    maxLength: 100,
    required: true,
    errorMessage: "Last name is required",
  },

  // ============================================================
  // STEP 4 — Real Estate Owned (Schedule of REO)
  // ============================================================
  "property.propertyAddress": {
    minLength: 5,
    maxLength: 200,
    required: false,
    errorMessage: "Property address must be between 5 and 200 characters",
  },
  "property.entityNameOnTitle": {
    maxLength: 100,
    required: false,
    errorMessage: "Title entity must be at most 100 characters",
  },
  "property.ownershipPercent": {
    min: 0,
    max: 100,
    required: false,
    errorMessage: "Ownership must be between 0% and 100%",
  },
  "property.propertyType": {
    maxLength: 100,
    required: false,
    errorMessage: "Property type must be at most 100 characters",
  },
  "property.acquisitionDate": { required: false },
  "property.rehabUpgradeCost": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "Rehab cost must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "property.currentMarketValue": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "Market value must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "property.mortgageHolderNameAddress": {
    maxLength: 200,
    required: false,
    errorMessage: "Mortgage holder must be at most 200 characters",
  },
  "property.loanMortgageBalance": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "Loan balance must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "property.grossRentalIncome": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "Rental income must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "property.loanTaxInsurancePaymentYr": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "Payment must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "property.noiPerYear": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "NOI must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "property.totalEquity": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "Total equity must be between $0 and $100,000,000",
    pattern: "currency",
  },

  // ============================================================
  // STEP 5 — Loan Term & Income / Financials
  // ============================================================
  "loanTermIncome.loanTerm": {
    min: 12,
    max: 360,
    required: true,
    errorMessage: "Loan term must be between 12 and 360 months",
  },
  "loanTermIncome.monthlyRent": {
    min: 0,
    max: 100000000,
    required: true,
    errorMessage: "Monthly rent must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "loanTermIncome.grossRevenueActual": {
    min: 0,
    max: 100000000,
    required: true,
    errorMessage: "Gross revenue actual must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "loanTermIncome.grossRevenueProforma": {
    min: 0,
    max: 100000000,
    required: true,
    errorMessage: "Gross revenue proforma must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "loanTermIncome.noiActual": {
    min: 0,
    max: 100000000,
    required: true,
    errorMessage: "NOI actual must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "loanTermIncome.noiProforma": {
    min: 0,
    max: 100000000,
    required: true,
    errorMessage: "NOI proforma must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "loanTermIncome.annualTaxes": {
    min: 0,
    max: 100000000,
    required: true,
    errorMessage: "Annual taxes must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "loanTermIncome.floodZone": {
    required: true,
    errorMessage: "Please indicate if the property is in a flood zone",
  },
  "loanTermIncome.insurancePremium": {
    min: 0,
    max: 100000000,
    required: true,
    errorMessage: "Annual insurance must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "loanTermIncome.hoaDues": {
    min: 0,
    max: 100000,
    required: false,
    errorMessage: "HOA dues must be between $0 and $100,000",
    pattern: "currency",
  },

  // ============================================================
  // STEP 5 — Residential Financials (Base44 detailed)
  // ============================================================
  "financials.rentalProperty": { required: false },
  "financials.hasRentalIncome": { required: false },
  "financials.monthlyRent": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "Monthly rent must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "financials.annualGrossRentalIncome": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "Rental income must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "financials.vacancyCreditLoss": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "Must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "financials.operatingExpenses": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "Operating expenses must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "financials.mortgageDebtService": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "Mortgage debt service must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "financials.effectiveGrossIncome": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "Effective gross income must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "financials.cashFlowAfterDebt": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "Cash flow must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "financials.interimMonthsReported": {
    min: 0,
    max: 60,
    required: false,
    errorMessage: "Months reported must be between 0 and 60",
  },
  "financials.proFormaNoiYears": {
    min: 0,
    max: 1000000000,
    required: false,
    errorMessage: "Pro-forma NOI must be between $0 and $1,000,000,000",
    pattern: "currency",
  },
  "financials.dscrCalculationMethod": { required: false },
  "financials.annualPropertyTaxes": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "Annual taxes must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "financials.annualInsurance": {
    min: 0,
    max: 100000000,
    required: false,
    errorMessage: "Annual insurance must be between $0 and $100,000,000",
    pattern: "currency",
  },
  "financials.hoaDues": {
    min: 0,
    max: 100000,
    required: false,
    errorMessage: "HOA dues must be between $0 and $100,000",
    pattern: "currency",
  },
  "financials.inFloodZone": { required: false },
  "financials.projectSummary": {
    minLength: 5,
    maxLength: 2000,
    required: false,
    errorMessage: "Project summary must be between 5 and 2000 characters",
  },

  // ============================================================
  // DYNAMIC SECTIONS — generic defaults applied per field.type
  // Used when a field comes from the API (renderField)
  // ============================================================
  dynamic_text: {
    maxLength: 500,
    required: false,
    errorMessage: "Text must be at most 500 characters",
  },
  dynamic_textarea: {
    minLength: 5,
    maxLength: 2000,
    required: false,
    errorMessage: "Text must be between 5 and 2000 characters",
  },
  dynamic_email: {
    required: false,
    pattern: "email",
    errorMessage: "Enter a valid email address",
  },
  dynamic_number: {
    min: -1000000000,
    max: 1000000000,
    required: false,
    errorMessage: "Must be between -$1,000,000,000 and $1,000,000,000",
  },
  dynamic_date: {
    required: false,
  },
  dynamic_select: {
    required: false,
    errorMessage: "Please make a selection",
  },
  dynamic_radio: {
    required: false,
    errorMessage: "Please select an option",
  },
  dynamic_checkbox_group: {
    required: false,
    errorMessage: "Please select at least one option",
  },
};
