import { useEffect, useState } from "react";
import { Landmark, Loader2, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import BankingDetailsFields from "../form/BankingDetailsFields";
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
  compact?: boolean;
};

export default function SelfBankingPanel({
  portal,
  apiBase,
  getAuthHeaders,
  checkResponse,
  title = "Banking details",
  description = "Used to receive commission ACH from your principal broker. You can add or update these anytime.",
  compact = false,
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
    <div
      className={
        compact
          ? "space-y-4"
          : "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]"
      }
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#13538A] text-white">
          <Landmark size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-gray-400">
            {description}
          </p>
          {accountLast4 ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <ShieldCheck size={14} />
              On file ····{accountLast4}
            </p>
          ) : (
            <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
              No bank account on file yet — add one to receive ACH commissions.
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSave} className="mt-5 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
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
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
              Changing account or routing numbers clears any previous Stripe payout
              link so the next commission uses this updated bank account.
            </div>
            <div className="flex justify-end">
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
  );
}
