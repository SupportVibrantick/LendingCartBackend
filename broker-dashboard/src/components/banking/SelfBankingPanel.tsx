import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Landmark,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import BankingDetailsFields from "../form/BankingDetailsFields";
import StatPill from "../common/StatPill";
import {
  INITIAL_BANKING_FORM,
  mapBankingDetailToForm,
  validateBankingForm,
  type BankingFormErrors,
  type BankingFormState,
} from "../../lib/bankingForm";

type Portal = "loanOfficer" | "coBroker";

type BankingPayload = BankingFormState & {
  accountLast4?: string | null;
  updatedAt?: string | null;
};

type Props = {
  portal: Portal;
  apiBase: string;
  getAuthHeaders: () => HeadersInit;
  checkResponse?: (res: Response, json: any) => void;
  title?: string;
  description?: string;
};

export default function SelfBankingPanel({
  portal,
  apiBase,
  getAuthHeaders,
  checkResponse,
  title = "Payout bank account",
  description = "Commission ACH from your principal broker credits this US bank account. Keep these details accurate.",
}: Props) {
  const bankingUrl =
    portal === "loanOfficer"
      ? `${apiBase}/loanofficer/auth/banking`
      : `${apiBase}/subbroker/auth/banking`;

  const [form, setForm] = useState<BankingFormState>(INITIAL_BANKING_FORM);
  const [errors, setErrors] = useState<BankingFormErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accountLast4, setAccountLast4] = useState<string | null>(null);
  const [hasBanking, setHasBanking] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(bankingUrl, { headers: getAuthHeaders() });
      const json = await res.json();
      checkResponse?.(res, json);
      if (!res.ok || (json.ok !== true && json.success !== true)) {
        throw new Error(json.message || "Failed to load banking details");
      }
      const banking = (json.data?.banking || null) as BankingPayload | null;
      setForm(mapBankingDetailToForm(banking));
      setAccountLast4(banking?.accountLast4 || null);
      setHasBanking(Boolean(banking?.accountNumber || banking?.accountLast4));
      setUpdatedAt(banking?.updatedAt || null);
    } catch (error: any) {
      toast.error(error.message || "Failed to load banking details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankingUrl]);

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
      const res = await fetch(bankingUrl, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      checkResponse?.(res, json);
      if (!res.ok || (json.ok !== true && json.success !== true)) {
        throw new Error(json.message || "Failed to save banking details");
      }
      const banking = (json.data?.banking || null) as BankingPayload | null;
      setForm(mapBankingDetailToForm(banking || form));
      setAccountLast4(banking?.accountLast4 || null);
      setHasBanking(true);
      setUpdatedAt(banking?.updatedAt || new Date().toISOString());
      toast.success(
        hasBanking
          ? "Banking details updated"
          : "Banking details saved for commission payouts",
      );
    } catch (error: any) {
      toast.error(error.message || "Failed to save banking details");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        <StatPill
          icon={<Landmark size={14} />}
          label="Payout ACH"
          value="Ready to receive"
          color="emerald"
          loading={loading}
        />
        <StatPill
          icon={
            accountLast4 ? <CheckCircle2 size={14} /> : <XCircle size={14} />
          }
          label="On file"
          value={accountLast4 ? `····${accountLast4}` : "Not saved"}
          color={accountLast4 ? "blue" : "amber"}
          loading={loading}
        />
        <StatPill
          icon={<ShieldCheck size={14} />}
          label="Account status"
          value={hasBanking ? "Saved" : "Pending"}
          color={hasBanking ? "emerald" : "slate"}
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
              <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
                {description}
              </p>
              {accountLast4 ? (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
                  <ShieldCheck size={13} />
                  On file ····{accountLast4}
                  {updatedAt
                    ? ` · Updated ${new Date(updatedAt).toLocaleDateString("en-US", {
                        dateStyle: "medium",
                      })}`
                    : ""}
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
                Changing account or routing numbers clears any previous payout
                link so the next commission uses this updated bank account.
                Settlement usually takes 1–3 business days.
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
                  ) : hasBanking ? (
                    "Update banking details"
                  ) : (
                    "Save banking details"
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
