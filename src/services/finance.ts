import { api } from "./api";

export type PaymentStatus = "pending" | "approved" | "declined" | "voided" | "error" | "refunded";

export interface PaymentRow {
  id: number;
  order_id: number;
  date: string;
  reference: string;
  method: string;
  user: string;
  professional: string;
  service: string;
  amount: number;
  discount?: number;
  status: PaymentStatus;
  status_label: string;
  can_verify: boolean;
}

export interface ClientPaymentRow extends PaymentRow {
  receipt_available: boolean;
  client_email: string;
  client_phone: string;
  client_document: string;
  service_category: string;
  service_description: string;
  service_address: string;
  paid_at: string | null;
  transaction_id: string;
  discount: number;
  subtotal: number;
  client_name: string;
  scheduled_for: string | null;
  order_status_label: string;
}

export type WithdrawalStatus = "pending" | "approved" | "paid" | "rejected";

export interface WithdrawalRow {
  id: number;
  professional: string;
  amount: number;
  destination: string;
  status: WithdrawalStatus;
  status_label: string;
  transfer_reference: string;
  note: string;
  created_at: string;
  resolved_at: string | null;
}

export type PayoutStatus = "pending" | "settled" | "refunded";

export interface IncomeRow {
  order_id: number;
  service: string;
  client: string;
  date: string | null;
  gross: number;
  commission: number;
  commission_rate: number;
  net: number;
  payout_status: PayoutStatus;
  payout_status_label: string;
  payout_settled_at: string | null;
  order_status_label: string;
}

export interface EarningsSummary {
  commission_rate: number;
  gross_total: number;
  commission_total: number;
  net_total: number;
  pending_settlement: number;
  settled_total: number;
  available_balance: number;
  withdrawn_total: number;
  pending_withdrawals: number;
}

export interface ProfessionalEarnings {
  summary: EarningsSummary;
  incomes: IncomeRow[];
  withdrawals: WithdrawalRow[];
  transfers: WithdrawalRow[];
}

export interface PayoutRow {
  order_id: number;
  professional: string;
  client: string;
  service: string;
  date: string | null;
  gross: number;
  commission: number;
  commission_rate: number;
  net: number;
  order_status: string;
  order_status_label: string;
  payout_status: PayoutStatus;
  payout_status_label: string;
  payout_settled_at: string | null;
  eligible: boolean;
}

export interface RefundRow {
  id: number;
  order_id: number;
  client: string;
  professional: string;
  amount: number;
  reason: string;
  status: "requested" | "approved" | "rejected";
  status_label: string;
  note: string;
  created_at: string;
  resolved_at: string | null;
}

export interface FinanceSummary {
  commission_rate: number;
  discounts_total?: number;
  payments_total?: number;
  collected: number;
  pending_collection: number;
  commissions: number;
  professionals_share: number;
  pending_settlement: number;
  eligible_settlement_orders: number;
  settled: number;
  withdrawals_open_count: number;
  withdrawals_open_amount: number;
  withdrawals_paid: number;
  refunds_open_count: number;
  refunds_total: number;
  payments_by_status: Record<string, number>;
  series: Array<{ month: string; commissions: number; collected: number }>;
}

export interface AdminPaymentDetail extends ClientPaymentRow {
  test_mode: boolean;
  created_at: string | null;
  updated_at: string | null;
  order_status: string;
  payment_status: string;
  commission_rate: number | null;
  commission_amount: number | null;
  professional_amount: number | null;
  payout_status: string;
  payout_status_label: string;
  professional_email: string;
}

export interface FinanceReport {
  totals: { orders: number; gross: number; commissions: number; professionals: number };
  rows: PayoutRow[];
}

const reportQuery = (from: string, to: string, extra = "") => {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (extra) params.set("export", extra);
  const query = params.toString();
  return query ? `?${query}` : "";
};

export interface PaymentHold {
  hold: boolean;
  role: "client" | "professional";
  message: string;
  orders: Array<{ order_id: number; service: string; amount: number }>;
}

export const financeService = {
  paymentHold: () => api.get<PaymentHold>("payments/hold/"),
  clientHistory: () => api.get<ClientPaymentRow[]>("payments/history/"),
  clientReceipt: (id: number) => api.get<ClientPaymentRow>(`payments/${id}/receipt/`),

  earnings: () => api.get<ProfessionalEarnings>("professional/earnings/"),
  requestWithdrawal: (amount: number, destination: string) =>
    api.post<WithdrawalRow>("professional/withdrawals/", { amount, destination }),

  admin: {
    summary: () => api.get<FinanceSummary>("admin/finance/summary/"),
    payments: () => api.get<PaymentRow[]>("admin/payments/"),
    paymentDetail: (id: number) => api.get<AdminPaymentDetail>(`admin/payments/${id}/`),
    verifyPayment: (id: number) => api.post<{ detail: string }>(`admin/payments/${id}/verify/`),
    payouts: () => api.get<PayoutRow[]>("admin/payouts/"),
    settle: (body: { order_ids: number[] } | { all: true }) =>
      api.post<{ settled: number; detail: string }>("admin/payouts/settle/", body),
    withdrawals: () => api.get<WithdrawalRow[]>("admin/withdrawals/"),
    resolveWithdrawal: (
      id: number,
      body: { action: "approve" | "reject" | "pay"; reference?: string; note?: string }
    ) => api.post<WithdrawalRow>(`admin/withdrawals/${id}/resolve/`, body),
    refunds: () => api.get<RefundRow[]>("admin/refunds/"),
    createRefund: (orderId: number, reason: string) =>
      api.post<RefundRow>("admin/refunds/", { order_id: orderId, reason }),
    resolveRefund: (id: number, body: { action: "approve" | "reject"; note?: string }) =>
      api.post<RefundRow>(`admin/refunds/${id}/resolve/`, body),
    report: (from: string, to: string) =>
      api.get<FinanceReport>(`admin/finance/report/${reportQuery(from, to)}`),
    reportCsv: (from: string, to: string) =>
      api.blob(`admin/finance/report/${reportQuery(from, to, "csv")}`),
  },
};

export const formatMoney = (value: number | null | undefined) =>
  Number(value || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

export const formatDate = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })
    : "—";
