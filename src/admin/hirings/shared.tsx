import React from "react";
import type { HiringAlertKey } from "../../services/hirings";

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  requested: { bg: "#fef3c7", color: "#b45309" },
  accepted: { bg: "#dbeafe", color: "#1d4ed8" },
  scheduled: { bg: "#dbeafe", color: "#1d4ed8" },
  traveling: { bg: "#e0e7ff", color: "#4338ca" },
  arrived: { bg: "#e0e7ff", color: "#4338ca" },
  in_progress: { bg: "#ede9fe", color: "#6d28d9" },
  break: { bg: "#ede9fe", color: "#6d28d9" },
  lunch: { bg: "#ede9fe", color: "#6d28d9" },
  other_service: { bg: "#ede9fe", color: "#6d28d9" },
  completed: { bg: "#dcfce7", color: "#15803d" },
  cancelled: { bg: "#e2e8f0", color: "#475569" },
};

export const StatusPill: React.FC<{ status: string; label: string }> = ({ status, label }) => {
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.cancelled;
  return (
    <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 700, background: colors.bg, color: colors.color, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
};

export const ALERT_META: Record<HiringAlertKey, { icon: string; short: string; color: string; bg: string }> = {
  stalled: { icon: "⏱️", short: "Sin movimiento", color: "#92400e", bg: "#fef3c7" },
  overdue_visit: { icon: "📅", short: "Visita vencida", color: "#9a3412", bg: "#ffedd5" },
  unpaid: { icon: "💳", short: "Sin pago", color: "#991b1b", bg: "#fee2e2" },
  no_review: { icon: "⭐", short: "Sin calificación", color: "#475569", bg: "#e2e8f0" },
};

export const AlertChip: React.FC<{ kind: HiringAlertKey }> = ({ kind }) => {
  const meta = ALERT_META[kind];
  return (
    <span title={meta.short} style={{ padding: "2px 8px", borderRadius: 999, fontSize: "0.7rem", fontWeight: 700, background: meta.bg, color: meta.color, whiteSpace: "nowrap" }}>
      {meta.icon} {meta.short}
    </span>
  );
};

export const shortDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("es-CO", { day: "2-digit", month: "short" }) : "—";
