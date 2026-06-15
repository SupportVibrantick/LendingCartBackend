export type BrokerSubBrokerFormState = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
};

export type BrokerSubBrokerFormErrors = Partial<Record<keyof BrokerSubBrokerFormState, string>>;

export const INITIAL_BROKER_SUB_BROKER_FORM: BrokerSubBrokerFormState = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  phone: "",
};

export function formatSbPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function validateBrokerSubBrokerForm(
  form: BrokerSubBrokerFormState,
  options: { isEdit?: boolean } = {},
): BrokerSubBrokerFormErrors {
  const errors: BrokerSubBrokerFormErrors = {};

  if (!form.firstName.trim()) errors.firstName = "First name is required";
  else if (form.firstName.trim().length < 2) errors.firstName = "Minimum 2 characters";

  if (!form.lastName.trim()) errors.lastName = "Last name is required";

  if (!form.email.trim()) errors.email = "Email is required";
  else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = "Invalid email format";

  if (!options.isEdit) {
    if (!form.password) errors.password = "Password is required";
    else if (form.password.length < 8) errors.password = "Minimum 8 characters";
  }

  const cleanPhone = form.phone.replace(/\D/g, "");
  if (!cleanPhone) errors.phone = "Phone is required";
  else if (cleanPhone.length < 10) errors.phone = "Enter 10-digit phone number";

  return errors;
}

export function buildBrokerSubBrokerPayload(
  form: BrokerSubBrokerFormState,
  options: { isEdit?: boolean } = {},
) {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim().toLowerCase(),
    phone: form.phone.replace(/\D/g, ""),
    ...(!options.isEdit && form.password ? { password: form.password } : {}),
  };
}
