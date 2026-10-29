import { useEffect, useState } from "react";
import { Loader2, Landmark, ShieldCheck } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
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
      setAuthorizedAt(json.data?.banking?.achDebitAuthorizedAt || new Date().toISOString());
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

      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#13538A] text-white">
              <Landmark size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Firm bank account
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Commission ACH transfers debit this principal broker account and
                credit loan officer / co-broker banks on file (US bank-to-bank).
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-xs text-slate-500">Automatic ACH</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                {achEnabled ? "Enabled" : "Disabled in env"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-xs text-slate-500">On file</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                {accountLast4 ? `Account ····${accountLast4}` : "Not saved yet"}
              </p>
            </div>
          </div>

          {authorizedAt ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800">
              <ShieldCheck size={14} />
              ACH debit authorized{" "}
              {new Date(authorizedAt).toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          ) : null}
        </div>

        <form
          onSubmit={handleSave}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="animate-spin" size={18} />
              Loading banking details…
            </div>
          ) : (
            <>
              <BankingDetailsFields
                value={form}
                errors={errors}
                onChange={onChange}
              />

              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                By saving, you authorize Loan Automation to initiate US ACH
                debits from this account to pay approved loan officer and
                co-broker commissions. Settlement usually takes 1–3 business days.
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#13538A] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f4470] disabled:opacity-60"
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
    </>
  );
}
