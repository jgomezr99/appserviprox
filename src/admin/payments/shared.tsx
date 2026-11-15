import React, { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../services/api";

export const PILL_COLORS: Record<string, { bg: string; color: string }> = {
  approved: { bg: "#dcfce7", color: "#15803d" },
  paid: { bg: "#dcfce7", color: "#15803d" },
  settled: { bg: "#dcfce7", color: "#15803d" },
  pending: { bg: "#fef3c7", color: "#b45309" },
  requested: { bg: "#fef3c7", color: "#b45309" },
  declined: { bg: "#fee2e2", color: "#b91c1c" },
  rejected: { bg: "#fee2e2", color: "#b91c1c" },
  error: { bg: "#fee2e2", color: "#b91c1c" },
  voided: { bg: "#e2e8f0", color: "#475569" },
  refunded: { bg: "#e2e8f0", color: "#475569" },
};

export const Pill: React.FC<{ status: string; label: string }> = ({ status, label }) => {
  const colors = PILL_COLORS[status] ?? PILL_COLORS.voided;
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: "999px",
        fontSize: "0.75rem",
        fontWeight: 700,
        background: colors.bg,
        color: colors.color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
};

export const money = (value: number | null | undefined) =>
  Number(value || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString("es-CO") : "—";

export const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

export const FilterChips: React.FC<{
  options: Array<[string, string]>;
  value: string;
  onChange: (value: string) => void;
}> = ({ options, value, onChange }) => (
  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
    {options.map(([id, label]) => (
      <button
        key={id}
        type="button"
        onClick={() => onChange(id)}
        style={{
          padding: "7px 14px",
          borderRadius: "8px",
          border: value === id ? "1px solid #2563eb" : "1px solid #e2e8f0",
          background: value === id ? "#2563eb" : "#ffffff",
          color: value === id ? "#ffffff" : "#475569",
          fontSize: "0.85rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {label}
      </button>
    ))}
  </div>
);

export const Notice: React.FC<{ kind: "error" | "ok"; children: React.ReactNode }> = ({ kind, children }) => (
  <div
    role={kind === "error" ? "alert" : "status"}
    style={{
      marginBottom: "12px",
      padding: "10px 14px",
      borderRadius: "10px",
      background: kind === "error" ? "#fef3c7" : "#dcfce7",
      color: kind === "error" ? "#92400e" : "#166534",
      fontSize: "0.85rem",
    }}
  >
    {children}
  </div>
);

export const EmptyRow: React.FC<{ colSpan: number; loading: boolean; message: string }> = ({
  colSpan,
  loading,
  message,
}) => (
  <tr>
    <td colSpan={colSpan} className="ad-empty-table">
      <p>{loading ? "Cargando información..." : message}</p>
    </td>
  </tr>
);

const KPI_TONES: Record<string, { bg: string; fg: string }> = {
  blue: { bg: "#dbeafe", fg: "#1d4ed8" },
  teal: { bg: "#ccfbf1", fg: "#0f766e" },
  orange: { bg: "#ffedd5", fg: "#c2410c" },
  purple: { bg: "#ede9fe", fg: "#6d28d9" },
};

export const KpiCard: React.FC<{ label: string; value: React.ReactNode; icon: string; tone: string }> = ({
  label,
  value,
  icon,
  tone,
}) => {
  const colors = KPI_TONES[tone] ?? KPI_TONES.blue;
  return (
    <div className="ad-kpi-card" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
        <span className="ad-kpi-label">{label}</span>
        <span className="ad-kpi-value" style={{ fontSize: "1.35rem", whiteSpace: "nowrap" }}>
          {value}
        </span>
      </div>
      <div
        aria-hidden="true"
        style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", background: colors.bg, color: colors.fg }}
      >
        {icon}
      </div>
    </div>
  );
};

/** Explica por qué falló una consulta; un error 500 suele indicar migraciones pendientes en el servidor. */
export const describeFailure = (failure: unknown): string => {
  if (failure instanceof ApiError && failure.status >= 500) {
    return "El servidor devolvió un error interno. Si acabas de actualizar la aplicación, ejecuta «python manage.py migrate» en el backend y reinícialo.";
  }
  if (failure instanceof ApiError && failure.status === 403) return "Tu cuenta no tiene permiso para ver esta información.";
  return failure instanceof Error && failure.message ? failure.message : "";
};

/** Carga datos del backend y expone recarga manual; el fetcher debe ser estable por pestaña. */
export function useRemote<T>(fetcher: () => Promise<T>, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorText, setErrorText] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetcher());
      setError(false);
      setErrorText("");
    } catch (failure) {
      setError(true);
      setErrorText(describeFailure(failure));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, errorText, reload };
}

export interface DialogField {
  key: string;
  label: string;
  required?: boolean;
  multiline?: boolean;
  options?: Array<[string, string]>;
}

/** Diálogo para pedir motivo o referencia antes de una acción administrativa. */
export const ActionDialog: React.FC<{
  title: string;
  confirmLabel: string;
  fields: DialogField[];
  busy?: boolean;
  onConfirm: (values: Record<string, string>) => void;
  onCancel: () => void;
}> = ({ title, confirmLabel, fields, busy, onConfirm, onCancel }) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const valid = fields.every((f) => !f.required || (values[f.key] || "").trim().length > 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        padding: "16px",
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !busy) onConfirm(values);
        }}
        style={{ background: "#fff", borderRadius: "14px", padding: "22px", width: "100%", maxWidth: "440px", display: "grid", gap: "14px" }}
      >
        <h3 style={{ margin: 0 }}>{title}</h3>
        {fields.map((f) =>
          f.options ? (
            <label key={f.key} style={{ display: "grid", gap: "6px", fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>
              {f.label}
              <select
                value={values[f.key] || ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              >
                <option value="">Selecciona…</option>
                {f.options.map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            </label>
          ) : f.multiline ? (
            <label key={f.key} style={{ display: "grid", gap: "6px", fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>
              {f.label}
              <textarea
                rows={3}
                maxLength={240}
                value={values[f.key] || ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            </label>
          ) : (
            <label key={f.key} style={{ display: "grid", gap: "6px", fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>
              {f.label}
              <input
                type="text"
                maxLength={80}
                value={values[f.key] || ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
            </label>
          )
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button type="button" className="ad-btn ad-btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="ad-btn ad-btn-primary" disabled={!valid || busy}>
            {busy ? "Procesando..." : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

export const Pager: React.FC<{
  page: number;
  total: number;
  pageSize: number;
  noun: string;
  onChange: (page: number) => void;
}> = ({ page, total, pageSize, noun, onChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;
  const shown = Math.max(0, Math.min(pageSize, total - start));
  return (
    <div className="ad-ben-pagination">
      <div>{total === 0 ? `Mostrando 0 ${noun}` : `Mostrando ${start + 1}-${start + shown} de ${total} ${noun}`}</div>
      <div className="ad-ben-page-nums">
        <button type="button" className="ad-ben-page-btn" aria-label="Página anterior" disabled={current <= 1} onClick={() => onChange(current - 1)}>
          ‹
        </button>
        <span style={{ padding: "0 8px", fontSize: "0.85rem", color: "#475569" }}>
          Página {current} de {totalPages}
        </span>
        <button type="button" className="ad-ben-page-btn" aria-label="Página siguiente" disabled={current >= totalPages} onClick={() => onChange(current + 1)}>
          ›
        </button>
      </div>
    </div>
  );
};
