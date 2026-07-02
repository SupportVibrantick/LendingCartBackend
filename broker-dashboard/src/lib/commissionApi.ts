export type CommissionInvoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  pdfUrl?: string | null;
  generatedAt?: string | null;
  sentAt?: string | null;
  viewedAt?: string | null;
  downloadedAt?: string | null;
};

export type CommissionPayout = {
  id: string;
  amount?: number | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  notes?: string | null;
  status?: string | null;
  paidAt?: string | null;
  paidByUserId?: string | null;
  paidByName?: string | null;
  invoiceNumber?: string | null;
  invoiceId?: string | null;
  createdAt?: string | null;
};

export type CommissionAuditEvent = {
  id: string;
  eventType: string;
  actorType: string;
  actorUserId?: string | null;
  actorName?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  dealCommissionId?: string | null;
  commissionInvoiceId?: string | null;
  commissionPayoutId?: string | null;
  loanApplicationId?: string | null;
};

export type CommissionRecord = {
  id: string;
  loanApplicationId: string;
  applicationNumber?: string | null;
  recipientUserId: string;
  recipientRole: "BROKER" | "LOAN_OFFICER" | "CO_BROKER";
  recipientName?: string | null;
  recipientEmail?: string | null;
  loanAmount?: number | null;
  brokerPoints?: number | null;
  upfrontFee?: number | null;
  commissionPool?: number | null;
  findersFeePercent?: number | null;
  commissionAmount?: number | null;
  lineStatus?: "CALCULATED" | "VOID" | "SUPERSEDED";
  payoutStatus?: "UNPAID" | "PARTIAL" | "PAID";
  status: "UNPAID" | "PARTIAL" | "PAID" | string;
  invoiceNumber?: string | null;
  latestInvoice?: CommissionInvoice | null;
  invoices?: CommissionInvoice[];
  payouts?: CommissionPayout[];
  paymentMethod?: string | null;
  paymentNotes?: string | null;
  paymentReference?: string | null;
  paidAt?: string | null;
  calculatedAt?: string | null;
  fundedAt?: string | null;
  clientName?: string | null;
};

export type CommissionSummary = {
  months: string[];
  pending: number[];
  paid: number[];
  total: number[];
  totals: {
    pending: number;
    paid: number;
    all: number;
  };
  counts?: {
    pending: number;
    paid: number;
    total: number;
  };
};

export type LoanCommissionBreakdown = {
  loanApplicationId: string;
  applicationNumber?: string | null;
  status?: string | null;
  fundedAt?: string | null;
  commissionPool?: number | null;
  brokerRetained?: number | null;
  yourCommission?: number | null;
  upfrontFee?: number | null;
  brokerPoints?: number | null;
  loanAmount?: number | null;
  commissions: CommissionRecord[];
  warnings?: string[];
  staffView?: boolean;
};

export type CommissionHistory = {
  commission: CommissionRecord;
  auditLog: CommissionAuditEvent[];
  paymentHistory: CommissionPayout[];
  invoices: CommissionInvoice[];
};

export type InvoiceListRecord = {
  id: string;
  invoiceNumber: string;
  invoiceStatus: string;
  paymentStatus: "DRAFT" | "DUE" | "RECEIVED" | "OVERDUE" | "VOID" | string;
  payoutStatus?: "UNPAID" | "PARTIAL" | "PAID" | string;
  amount?: number | null;
  generatedAt?: string | null;
  issueDate?: string | null;
  recipientUserId?: string | null;
  recipientName?: string | null;
  recipientEmail?: string | null;
  recipientRole?: string | null;
  dealCommissionId: string;
  loanApplicationId: string;
  submissionId?: string | null;
  applicationNumber?: string | null;
  clientName?: string | null;
  dealName?: string | null;
  pdfUrl?: string | null;
  hasPdf?: boolean;
  downloadedAt?: string | null;
  viewedAt?: string | null;
};

export type InvoiceSummary = {
  draft: { count: number; amount: number };
  due: { count: number; amount: number };
  received: { count: number; amount: number };
  overdue: { count: number; amount: number };
};

export type InvoiceListResponse = {
  success: boolean;
  data: InvoiceListRecord[];
  summary: InvoiceSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export function formatCommissionCurrency(value?: number | null) {
  const amount = Number(value || 0);
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function formatCommissionRole(role?: string) {
  if (role === "LOAN_OFFICER") return "Loan Officer";
  if (role === "CO_BROKER") return "Co-Broker";
  if (role === "BROKER") return "Broker";
  return role || "Recipient";
}

export function formatPayoutStatus(status?: string) {
  if (status === "PAID") return "Paid";
  if (status === "PARTIAL") return "Partial";
  if (status === "UNPAID") return "Pending";
  return status || "Pending";
}

export function getCommissionApiBase(portal: "broker" | "loanofficer" | "subbroker" = "broker") {
  if (portal === "loanofficer") return `${API_BASE}/loanofficer/commissions`;
  if (portal === "subbroker") return `${API_BASE}/subbroker/commissions`;
  return `${API_BASE}/broker/commissions`;
}

export function getInvoicePdfUrl(
  invoiceId: string,
  portal: "broker" | "loanofficer" | "subbroker" = "broker",
) {
  return `${getCommissionApiBase(portal)}/invoices/${invoiceId}/pdf`;
}

export function formatInvoicePaymentStatus(status?: string) {
  if (status === "RECEIVED" || status === "PAID") return "Received";
  if (status === "OVERDUE") return "Overdue";
  if (status === "DRAFT") return "Draft";
  if (status === "DUE" || status === "UNPAID" || status === "PENDING") return "Due";
  if (status === "VOID") return "Void";
  return status || "Due";
}

export function invoiceStatusBadgeClass(status?: string) {
  if (status === "RECEIVED" || status === "PAID") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  }
  if (status === "OVERDUE") {
    return "bg-rose-50 text-rose-700 ring-rose-100";
  }
  if (status === "DRAFT") {
    return "bg-slate-100 text-slate-600 ring-slate-200";
  }
  return "bg-amber-50 text-amber-700 ring-amber-100";
}
