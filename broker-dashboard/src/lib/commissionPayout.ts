import Swal from "sweetalert2";
import {
  formatCommissionCurrency,
  getCommissionApiBase,
  type CommissionRecord,
} from "./commissionApi";

export const PAYMENT_METHODS = ["ACH", "WIRE", "CHECK", "CASH", "MANUAL"] as const;

export function getRemainingPayoutAmount(row: CommissionRecord) {
  const total = Number(row.commissionAmount || 0);
  const paid = (row.payouts || [])
    .filter((payout) => payout.status === "COMPLETED")
    .reduce((sum, payout) => sum + Number(payout.amount || 0), 0);
  return Math.max(0, Math.round((total - paid) * 100) / 100);
}

export type PayoutFormValues = {
  paymentMethod: string;
  paymentReference: string;
  notes: string;
  amount: number;
};

export async function promptRecordCommissionPayout(
  row: CommissionRecord,
): Promise<PayoutFormValues | null> {
  const remaining = getRemainingPayoutAmount(row);
  if (remaining <= 0) {
    await Swal.fire({
      icon: "info",
      title: "Already paid",
      text: "This commission line has no remaining balance.",
      confirmButtonColor: "#13538A",
    });
    return null;
  }

  const { value: formValues } = await Swal.fire({
    title: "Record Payout",
    html: `
      <p style="margin-bottom:12px;text-align:left">
        Pay <strong>${formatCommissionCurrency(remaining)}</strong> remaining to
        <strong>${row.recipientName || "recipient"}</strong>
        <br /><span style="font-size:12px;color:#64748b">
          Total: ${formatCommissionCurrency(row.commissionAmount)} ·
          Remaining: ${formatCommissionCurrency(remaining)}
        </span>
      </p>
      <input id="payout-amount" type="number" min="0.01" step="0.01" max="${remaining}"
        class="swal2-input" style="margin:0 0 10px;width:100%"
        value="${remaining}" placeholder="Payout amount" />
      <select id="payment-method" class="swal2-input" style="margin:0 0 10px;width:100%">
        ${PAYMENT_METHODS.map(
          (method) => `<option value="${method}">${method}</option>`,
        ).join("")}
      </select>
      <input id="payment-reference" class="swal2-input"
        placeholder="Payment reference (optional)" style="margin:0 0 10px;width:100%" />
      <textarea id="payment-notes" class="swal2-textarea"
        placeholder="Notes (optional)" style="width:100%"></textarea>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Record Payout",
    confirmButtonColor: "#059669",
    cancelButtonColor: "#64748b",
    preConfirm: () => {
      const amountRaw = (
        document.getElementById("payout-amount") as HTMLInputElement
      )?.value;
      const paymentMethod = (
        document.getElementById("payment-method") as HTMLSelectElement
      )?.value;
      const paymentReference = (
        document.getElementById("payment-reference") as HTMLInputElement
      )?.value;
      const notes = (
        document.getElementById("payment-notes") as HTMLTextAreaElement
      )?.value;
      const amount = Number(amountRaw);

      if (!Number.isFinite(amount) || amount <= 0) {
        Swal.showValidationMessage("Enter a valid payout amount");
        return false;
      }
      if (amount > remaining + 0.009) {
        Swal.showValidationMessage(
          `Amount cannot exceed remaining balance (${formatCommissionCurrency(remaining)})`,
        );
        return false;
      }

      return {
        paymentMethod: paymentMethod || "MANUAL",
        paymentReference: paymentReference || "",
        notes: notes || "",
        amount: Math.round(amount * 100) / 100,
      } as PayoutFormValues;
    },
  });

  return formValues || null;
}

export async function submitCommissionPayout(
  commissionId: string,
  formValues: PayoutFormValues,
  getAuthHeaders: () => HeadersInit,
  portal: "broker" | "loanofficer" | "subbroker" = "broker",
) {
  const base = getCommissionApiBase(portal);
  const res = await fetch(`${base}/${commissionId}/payouts`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      paymentMethod: formValues.paymentMethod,
      paymentReference: formValues.paymentReference,
      notes: formValues.notes,
      amount: formValues.amount,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Failed to record payout");
  }
  return json;
}
