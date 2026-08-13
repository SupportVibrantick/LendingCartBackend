export type WorkingWithMortgageBrokerAnswer = "" | "yes" | "no";

export type ReferringBrokerInfo = {
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  phone: string;
};

export type ReferringBrokerFormState = {
  workingWithMortgageBroker: WorkingWithMortgageBrokerAnswer;
  referringBroker: ReferringBrokerInfo;
};

export const REFERRING_BROKER_FIELD_KEYS = {
  workingWithMortgageBroker: "workingWithMortgageBroker",
  email: "referringBrokerEmail",
  firstName: "referringBrokerFirstName",
  lastName: "referringBrokerLastName",
  companyName: "referringBrokerCompanyName",
  phone: "referringBrokerPhone",
} as const;

export function createEmptyReferringBroker(): ReferringBrokerInfo {
  return {
    email: "",
    firstName: "",
    lastName: "",
    companyName: "",
    phone: "",
  };
}

export function createEmptyReferringBrokerFormState(): ReferringBrokerFormState {
  return {
    workingWithMortgageBroker: "",
    referringBroker: createEmptyReferringBroker(),
  };
}

function readFieldValue(
  fields: Array<{ fieldKey?: string | null; value?: unknown }>,
  key: string,
): string {
  const field = fields.find((item) => item.fieldKey === key);
  if (!field || field.value == null) return "";
  if (typeof field.value === "string") return field.value;
  if (typeof field.value === "number" || typeof field.value === "boolean") {
    return String(field.value);
  }
  return "";
}

export function hydrateReferringBrokerFromFields(
  fields: Array<{ fieldKey?: string | null; value?: unknown }>,
): ReferringBrokerFormState {
  const answerRaw = readFieldValue(
    fields,
    REFERRING_BROKER_FIELD_KEYS.workingWithMortgageBroker,
  )
    .trim()
    .toLowerCase();

  const workingWithMortgageBroker: WorkingWithMortgageBrokerAnswer =
    answerRaw === "yes" || answerRaw === "no" ? answerRaw : "";

  return {
    workingWithMortgageBroker,
    referringBroker: {
      email: readFieldValue(fields, REFERRING_BROKER_FIELD_KEYS.email),
      firstName: readFieldValue(fields, REFERRING_BROKER_FIELD_KEYS.firstName),
      lastName: readFieldValue(fields, REFERRING_BROKER_FIELD_KEYS.lastName),
      companyName: readFieldValue(
        fields,
        REFERRING_BROKER_FIELD_KEYS.companyName,
      ),
      phone: readFieldValue(fields, REFERRING_BROKER_FIELD_KEYS.phone),
    },
  };
}

export function appendReferringBrokerSubmission(
  addField: (key: string, value: unknown) => void,
  state: ReferringBrokerFormState,
) {
  if (!state.workingWithMortgageBroker) return;

  addField(
    REFERRING_BROKER_FIELD_KEYS.workingWithMortgageBroker,
    state.workingWithMortgageBroker,
  );

  if (state.workingWithMortgageBroker !== "yes") return;

  const broker = state.referringBroker;
  addField(REFERRING_BROKER_FIELD_KEYS.email, broker.email?.toLowerCase() || "");
  addField(REFERRING_BROKER_FIELD_KEYS.firstName, broker.firstName || "");
  addField(REFERRING_BROKER_FIELD_KEYS.lastName, broker.lastName || "");
  addField(REFERRING_BROKER_FIELD_KEYS.companyName, broker.companyName || "");
  addField(REFERRING_BROKER_FIELD_KEYS.phone, broker.phone || "");
}
