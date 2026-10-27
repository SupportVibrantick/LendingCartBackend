export type BankingAccountType = "PERSONAL" | "BUSINESS";

export type BankingFormState = {
  accountType: BankingAccountType;
  partyName: string;
  partyAddress: string;
  partyTel: string;
  partyEmail: string;
  bankName: string;
  bankTel: string;
  accountName: string;
  accountNumber: string;
  abaRoutingNumber: string;
};

export type BankingFormErrors = Partial<Record<keyof BankingFormState, string>>;

export type BankingDetail = Partial<BankingFormState> | null | undefined;

export const INITIAL_BANKING_FORM: BankingFormState = {
  accountType: "PERSONAL",
  partyName: "",
  partyAddress: "",
  partyTel: "",
  partyEmail: "",
  bankName: "",
  bankTel: "",
  accountName: "",
  accountNumber: "",
  abaRoutingNumber: "",
};

export function formatBankingPhone(value: string) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function mapBankingDetailToForm(
  banking?: BankingDetail,
  fallback?: {
    partyName?: string;
    partyAddress?: string;
    partyTel?: string;
    partyEmail?: string;
  },
): BankingFormState {
  if (!banking) {
    return {
      ...INITIAL_BANKING_FORM,
      partyName: fallback?.partyName || "",
      partyAddress: fallback?.partyAddress || "",
      partyTel: fallback?.partyTel
        ? formatBankingPhone(fallback.partyTel)
        : "",
      partyEmail: fallback?.partyEmail || "",
    };
  }

  return {
    accountType:
      banking.accountType === "BUSINESS" ? "BUSINESS" : "PERSONAL",
    partyName: banking.partyName || fallback?.partyName || "",
    partyAddress: banking.partyAddress || fallback?.partyAddress || "",
    partyTel: banking.partyTel
      ? formatBankingPhone(banking.partyTel)
      : fallback?.partyTel
        ? formatBankingPhone(fallback.partyTel)
        : "",
    partyEmail: banking.partyEmail || fallback?.partyEmail || "",
    bankName: banking.bankName || "",
    bankTel: banking.bankTel ? formatBankingPhone(banking.bankTel) : "",
    accountName: banking.accountName || "",
    accountNumber: banking.accountNumber || "",
    abaRoutingNumber: banking.abaRoutingNumber || "",
  };
}

export function validateBankingForm(
  banking: BankingFormState,
): BankingFormErrors {
  const errors: BankingFormErrors = {};

  if (banking.accountType !== "PERSONAL" && banking.accountType !== "BUSINESS") {
    errors.accountType = "Account type must be Personal or Business";
  }
  if (!banking.partyName.trim()) errors.partyName = "Name is required";
  if (!banking.partyAddress.trim()) errors.partyAddress = "Address is required";

  const partyTel = banking.partyTel.replace(/\D/g, "");
  if (!banking.partyTel.trim()) errors.partyTel = "Telephone is required";
  else if (partyTel.length !== 10) {
    errors.partyTel = "Enter a valid 10-digit phone number";
  }

  if (!banking.partyEmail.trim()) errors.partyEmail = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(banking.partyEmail.trim())) {
    errors.partyEmail = "Enter a valid email";
  }

  if (!banking.bankName.trim()) errors.bankName = "Bank name is required";

  const bankTel = banking.bankTel.replace(/\D/g, "");
  if (!banking.bankTel.trim()) errors.bankTel = "Bank telephone is required";
  else if (bankTel.length !== 10) {
    errors.bankTel = "Enter a valid 10-digit phone number";
  }

  if (!banking.accountName.trim()) {
    errors.accountName = "Account name is required";
  }

  const accountNumber = banking.accountNumber.replace(/\D/g, "");
  if (!accountNumber) errors.accountNumber = "Account number is required";
  else if (!/^\d{4,17}$/.test(accountNumber)) {
    errors.accountNumber = "Enter a valid account number (4–17 digits)";
  }

  const routing = banking.abaRoutingNumber.replace(/\D/g, "");
  if (!routing) errors.abaRoutingNumber = "ABA/Routing number is required";
  else if (!/^\d{9}$/.test(routing)) {
    errors.abaRoutingNumber = "Routing number must be 9 digits";
  }

  return errors;
}

export function appendBankingToFormData(
  formData: FormData,
  banking: BankingFormState,
) {
  formData.append("accountType", banking.accountType);
  formData.append("partyName", banking.partyName.trim());
  formData.append("partyAddress", banking.partyAddress.trim());
  formData.append("partyTel", banking.partyTel.replace(/\D/g, ""));
  formData.append("partyEmail", banking.partyEmail.trim().toLowerCase());
  formData.append("bankName", banking.bankName.trim());
  formData.append("bankTel", banking.bankTel.replace(/\D/g, ""));
  formData.append("accountName", banking.accountName.trim());
  formData.append("accountNumber", banking.accountNumber.replace(/\D/g, ""));
  formData.append(
    "abaRoutingNumber",
    banking.abaRoutingNumber.replace(/\D/g, ""),
  );
}

export function bankingFieldsForJsonBody(banking: BankingFormState) {
  return {
    accountType: banking.accountType,
    partyName: banking.partyName.trim(),
    partyAddress: banking.partyAddress.trim(),
    partyTel: banking.partyTel.replace(/\D/g, ""),
    partyEmail: banking.partyEmail.trim().toLowerCase(),
    bankName: banking.bankName.trim(),
    bankTel: banking.bankTel.replace(/\D/g, ""),
    accountName: banking.accountName.trim(),
    accountNumber: banking.accountNumber.replace(/\D/g, ""),
    abaRoutingNumber: banking.abaRoutingNumber.replace(/\D/g, ""),
  };
}
