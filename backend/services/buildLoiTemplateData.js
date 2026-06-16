const { mapSubmissionFieldResponse } = require("./staticSubmissionFields");

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const numeric = Number(String(value).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(numeric)) return String(value);
  return `$${numeric.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
};

const formatInterestRate = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const numeric = Number(String(value).replace(/%/g, ""));
  if (!Number.isFinite(numeric)) return String(value);
  return `${numeric}%`;
};

const extractFieldValue = (val) => {
  if (val === null || val === undefined) return "";

  if (typeof val === "object") {
    return String(
      val.text ?? val.value ?? val.label ?? val.url ?? JSON.stringify(val),
    );
  }

  return String(val);
};

const pickField = (fieldMap, ...keys) => {
  for (const key of keys) {
    const value = fieldMap?.[key];
    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }
  return "";
};

function buildSubmissionFieldMap(fields = []) {
  const fieldMap = {};

  for (const field of fields) {
    const mapped = mapSubmissionFieldResponse(field);
    if (!mapped.fieldKey) continue;

    fieldMap[mapped.fieldKey] = extractFieldValue(mapped.value);
  }

  return fieldMap;
}

function buildLoiTemplateData({
  submission,
  loanApplication,
  lenderRecord,
  applicationLenderId,
}) {
  const fieldMap = buildSubmissionFieldMap(submission?.fields || []);
  const review = lenderRecord?.lenderReviews?.[0];
  const brokerUser = loanApplication?.brokerUser;
  const brokerProfile = brokerUser?.brokerProfile;
  const brokerOrg = loanApplication?.brokerOrg;
  const client = loanApplication?.client;
  const primaryContact = client?.contacts?.[0];

  const borrowerFirstName =
    pickField(fieldMap, "borrowerFirstName", "firstName", "first_name") ||
    primaryContact?.firstName ||
    "";
  const borrowerLastName =
    pickField(fieldMap, "borrowerLastName", "lastName", "last_name") ||
    primaryContact?.lastName ||
    "";
  const borrowerName =
    `${borrowerFirstName} ${borrowerLastName}`.trim() ||
    client?.legalName ||
    "";

  const brokerFirstName = brokerUser?.firstName || "";
  const brokerLastName = brokerUser?.lastName || "";
  const brokerName =
    `${brokerFirstName} ${brokerLastName}`.trim() || brokerOrg?.name || "";

  const email =
    pickField(fieldMap, "email", "borrowerEmail") ||
    primaryContact?.email ||
    "";
  const phone =
    pickField(fieldMap, "phone", "borrowerPhone", "mobile") ||
    primaryContact?.phone ||
    "";
  const city = pickField(
    fieldMap,
    "borrowerCity",
    "propertyCity",
    "city",
  );
  const state = pickField(
    fieldMap,
    "borrowerState",
    "propertyState",
    "state",
  );

  const loanAmountRequested =
    pickField(fieldMap, "amountRequested", "loanAmount", "loan_amount") ||
    (loanApplication?.amountRequested != null
      ? String(loanApplication.amountRequested)
      : "");

  const approvedAmountRaw = review?.approvedAmount ?? "";
  const interestRateRaw = review?.interestRate ?? "";

  return {
    ...fieldMap,
    submissionId: submission?.id || "",
    applicationId: loanApplication?.id || "",
    applicationNumber: loanApplication?.applicationNumber || "",
    loanReferenceId: applicationLenderId || lenderRecord?.id || "",
    lenderName: lenderRecord?.lender?.name || "",
    status: lenderRecord?.status || "",
    applicationStatus: lenderRecord?.status || "",
    date: new Date().toLocaleDateString(),

    borrowerFirstName,
    borrowerLastName,
    borrowerName,
    email,
    borrowerEmail: email,
    phone,
    borrowerPhone: phone,
    city,
    borrowerCity: city,
    state,
    borrowerState: state,
    companyName:
      pickField(fieldMap, "companyName", "entityLegalName") ||
      client?.legalName ||
      "",

    brokerName,
    brokerFirstName,
    brokerLastName,
    brokerEmail: brokerUser?.email || brokerOrg?.email || "",
    brokerPhone: brokerUser?.phone || brokerOrg?.phone || "",
    brokerCompany: brokerProfile?.company || brokerOrg?.name || "",
    brokerCity: brokerProfile?.city || "",
    brokerState: brokerProfile?.state || "",
    brokerAddress: brokerProfile?.address || "",
    brokerZip: brokerProfile?.zipCode || "",

    loanAmountRequested,
    amountRequested: loanAmountRequested,
    loanProductCode:
      pickField(fieldMap, "loanProductCode", "loan_product", "productCode") ||
      loanApplication?.loanProductCode ||
      "",

    propertyAddress: pickField(
      fieldMap,
      "propertyAddress",
      "property_address",
      "address",
    ),

    approvedAmount: formatCurrency(approvedAmountRaw),
    interestRate: formatInterestRate(interestRateRaw),
    notes: review?.notes || "",
  };
}

module.exports = {
  buildLoiTemplateData,
  buildSubmissionFieldMap,
  pickField,
  formatCurrency,
  extractFieldValue,
};
