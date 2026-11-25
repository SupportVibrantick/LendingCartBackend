import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Landmark,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import StatPill from "../../components/common/StatPill";
import BankingDetailsFields from "../../components/form/BankingDetailsFields";
import {
  INITIAL_BANKING_FORM,
  mapBankingDetailToForm,
  validateBankingForm,
  type BankingFormErrors,
  type BankingFormState,
} from "../../lib/bankingForm";
import { getCommissionApiBase } from "../../lib/commissionApi";
import toast from "react-hot-toast";

type BankingResponse = {
  success: boolean;
  message?: string;
  data?: {
    banking: (BankingFormState & {
      accountLast4?: string | null;
      achDebitAuthorizedAt?: string | null;
      hasStripeCustomer?: boolean;
      hasPaymentMethod?: boolean;
    }) | null;
    achTransfersEnabled?: boolean;
  };
};

function getAuthHeaders(): HeadersInit {
  const token = sessionStorage.getItem("broker_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function BankingPage() {
  const [form, setForm] = useState<BankingFormState>(INITIAL_BANKING_FORM);
  const [errors, setErrors] = useState<BankingFormErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [achEnabled, setAchEnabled] = useState(false);
  const [authorizedAt, setAuthorizedAt] = useState<string | null>(null);
  const [accountLast4, setAccountLast4] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${getCommissionApiBase("broker")}/banking`, {
        headers: getAuthHeaders(),
      });
      const json = (await res.json()) as BankingResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to load banking details");
      }
      setForm(mapBankingDetailToForm(json.data?.banking || null));
      setAchEnabled(Boolean(json.data?.achTransfersEnabled));
      setAuthorizedAt(json.data?.banking?.achDebitAuthorizedAt || null);
      setAccountLast4(json.data?.banking?.accountLast4 || null);
    } catch (error: any) {
      toast.error(error.message || "Failed to load banking details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChange = <K extends keyof BankingFormState>(
    key: K,
    next: BankingFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: next }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const handleSave = async (event: { preventDefault(): void }) => {
    event.preventDefault();
    const validation = validateBankingForm(form);
    if (Object.keys(validation).length) {
      setErrors(validation);
      toast.error("Fix the highlighted banking fields");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`${getCommissionApiBase("broker")}/banking`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          authorizeAchDebit: true,
        }),
      });
      const json = (await res.json()) as BankingResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to save banking details");
      }
      setForm(mapBankingDetailToForm(json.data?.banking || form));
      setAuthorizedAt(
        json.data?.banking?.achDebitAuthorizedAt || new Date().toISOString(),
      );
      setAccountLast4(json.data?.banking?.accountLast4 || null);
      toast.success("Firm bank account saved for commission ACH transfers");
    } catch (error: any) {
      toast.error(error.message || "Failed to save banking details");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageMeta
        title="Banking | Payments | Broker Dashboard"
        description="Firm bank account used to fund loan officer and co-broker commissions"
      />

      <div className="w-full min-w-0 space-y-4">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
          <StatPill
            icon={<Landmark size={14} />}
            label="Automatic ACH"
            value={achEnabled ? "Enabled" : "Disabled"}
            color={achEnabled ? "emerald" : "rose"}
            loading={loading}
          />
          <StatPill
            icon={
              accountLast4 ? (
                <CheckCircle2 size={14} />
              ) : (
                <XCircle size={14} />
              )
            }
            label="On file"
            value={accountLast4 ? `····${accountLast4}` : "Not saved"}
            color={accountLast4 ? "blue" : "amber"}
            loading={loading}
          />
          <StatPill
            icon={<ShieldCheck size={14} />}
            label="ACH authorization"
            value={authorizedAt ? "Authorized" : "Pending"}
            color={authorizedAt ? "emerald" : "slate"}
            loading={loading}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 dark:border-slate-800">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#4C78F5] text-white">
                <Landmark size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-text-primary">
                  Firm bank account
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
                  Commission ACH transfers debit this principal broker account
                  and credit loan officer / co-broker banks on file (US
                  bank-to-bank).
                </p>
                {authorizedAt ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
                    <ShieldCheck size={13} />
                    Authorized{" "}
                    {new Date(authorizedAt).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <form onSubmit={handleSave} className="px-4 py-4 sm:px-5 sm:py-5">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-secondary">
                <Loader2 className="h-4 w-4 animate-spin text-[#4C78F5]" />
                Loading banking details…
              </div>
            ) : (
              <>
                <BankingDetailsFields
                  value={form}
                  errors={errors}
                  onChange={onChange}
                />

                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  By saving, you authorize Loan Automation to initiate US ACH
                  debits from this account to pay approved loan officer and
                  co-broker commissions. Settlement usually takes 1–3 business
                  days.
                </div>

                <div className="mt-5 flex justify-end border-t border-border pt-4 dark:border-slate-800">
                  <button
                    type="submit"
                    disabled={saving}
                    className="ds-btn-primary min-w-[200px] disabled:opacity-60"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Save & authorize ACH"
                    )}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </>
  );
}
