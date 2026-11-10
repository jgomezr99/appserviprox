import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../services/api";
import { FieldList, Toggle } from "./ui";
import type { Section } from "../../services/platformSettings";

type Ui = { name: string; description: string; icon: string; color: string };
type MethodDef = Ui & { id: string; builtin: boolean };

type Health = {
  checked_at: string;
  configured: boolean;
  mode: string;
  merchant: string;
  methods: Record<string, { status: "ok" | "error" | "disabled"; detail: string }>;
  alerts: Array<{ level: "error" | "warning"; method?: string; message: string }>;
};

type Stat = { total: number; approved: number; declined: number; pending: number; approved_amount: number; approval_rate: number | null };

const BUILTIN: Array<Ui & { id: string }> = [
  { id: "pse", name: "PSE", description: "Pagos seguros en línea", icon: "🏦", color: "" },
  { id: "card", name: "Tarjetas débito/crédito", description: "Visa, MasterCard, American Express", icon: "💳", color: "" },
  { id: "transfer", name: "Transferencia bancaria", description: "Transferencias directas", icon: "🏧", color: "" },
  { id: "wallet", name: "Billetera / Pago móvil", description: "Nequi, Daviplata", icon: "📲", color: "" },
];

const ICONS = ["🏦", "💳", "🏧", "📲", "💵", "💰", "🪙", "🧾", "🏪", "📱", "🔒", "⚡", "🌐", "🤝", "🎟️", "🛒"];
const COLORS = ["#2563eb", "#16a34a", "#dc2626", "#d97706", "#7c3aed", "#0891b2", "#475569"];
const SETTLEMENT = ["Inmediato", "1 - 2 días hábiles", "3 - 5 días hábiles"];

const cop = (value: number) =>
  value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

type Props = {
  sec: Section;
  setSec: (patch: Section) => void;
  notify: (type: "ok" | "error", text: string) => void;
  onTestConnection: (id: string, name: string) => void;
};

export const MethodsGrid: React.FC<Props> = ({ sec, setSec, notify, onTestConnection }) => {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthBusy, setHealthBusy] = useState(false);
  const [stats, setStats] = useState<Record<string, Stat>>({});
  const [includeTest, setIncludeTest] = useState(false);
  const [editing, setEditing] = useState<MethodDef | null>(null);
  const [amount, setAmount] = useState(100000);

  const customIds = useMemo<string[]>(() => (Array.isArray(sec.custom_methods) ? sec.custom_methods : []), [sec.custom_methods]);
  const catalog = useMemo<MethodDef[]>(() => {
    const ui: Record<string, Partial<Ui>> = sec.method_ui && typeof sec.method_ui === "object" ? sec.method_ui : {};
    const all: MethodDef[] = [
      ...BUILTIN.map((m) => ({ ...m, ...ui[m.id], builtin: true })),
      ...customIds.map((id) => ({
        id,
        name: "Nuevo método",
        description: "",
        icon: "💵",
        color: "",
        ...ui[id],
        builtin: false,
      })),
    ];
    const order: string[] = Array.isArray(sec.method_order) ? sec.method_order : [];
    const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length + all.findIndex((m) => m.id === id));
    return [...all].sort((a, b) => rank(a.id) - rank(b.id));
  }, [sec.method_ui, sec.method_order, customIds]);

  const loadHealth = useCallback(async () => {
    setHealthBusy(true);
    try {
      setHealth(await api.get<Health>("admin/payments/health/"));
    } catch {
      setHealth(null);
    } finally {
      setHealthBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    let active = true;
    api
      .get<{ methods: Record<string, Stat> }>(`admin/payments/stats/?days=30&include_test=${includeTest ? 1 : 0}`)
      .then((data) => active && setStats(data.methods || {}))
      .catch(() => active && setStats({}));
    return () => {
      active = false;
    };
  }, [includeTest]);

  const saveUi = (id: string, patch: Partial<Ui>) => {
    const current = catalog.find((m) => m.id === id);
    if (!current) return;
    setSec({
      method_ui: {
        ...(sec.method_ui || {}),
        [id]: { name: current.name, description: current.description, icon: current.icon, color: current.color, ...patch },
      },
    });
  };

  const persistOrder = (ids: string[]) => setSec({ method_order: ids });
  const move = (id: string, delta: number) => {
    const ids = catalog.map((m) => m.id);
    const index = ids.indexOf(id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    persistOrder(ids);
  };

  const removeMethod = (id: string) => {
    const ui = { ...(sec.method_ui || {}) };
    delete ui[id];
    setSec({
      custom_methods: customIds.filter((item) => item !== id),
      method_ui: ui,
      method_order: catalog.map((m) => m.id).filter((item) => item !== id),
      [`${id}_enabled`]: undefined,
      [`${id}_provider`]: undefined,
      [`${id}_commission`]: undefined,
      [`${id}_settlement`]: undefined,
    });
  };

  const platformRate = Number(sec.platform_commission) || 0;
  const calc = (id: string) => {
    const gatewayPct = Number(sec[`${id}_commission`]) || 0;
    const gateway = (amount * gatewayPct) / 100;
    const platform = (amount * platformRate) / 100;
    let discount = 0;
    if (sec.discount_enabled && Number(sec.discount_value) > 0) {
      const raw = sec.discount_type === "fixed" ? Number(sec.discount_value) : (amount * Math.min(Number(sec.discount_value), 100)) / 100;
      discount = Math.max(0, Math.min(raw, platform, amount - 1500));
    }
    return { gateway, platform, discount, professional: amount - platform, paid: amount - discount, net: platform - discount - gateway };
  };

  const statusBadge = (method: MethodDef) => {
    if (!method.builtin) return <span className="as-badge as-badge-off">✋ Manual</span>;
    const state = health?.methods[method.id];
    if (!sec[`${method.id}_enabled`] && sec[`${method.id}_enabled`] !== undefined) return <span className="as-badge as-badge-off">Inactivo</span>;
    if (!state) return <span className="as-badge as-badge-off">⏳ Sin verificar</span>;
    if (state.status === "ok") return <span className="as-badge" title={state.detail}>✔ Conectado</span>;
    if (state.status === "disabled") return <span className="as-badge as-badge-off">Inactivo</span>;
    return <span className="as-badge" style={{ background: "#fee2e2", color: "#991b1b" }} title={state.detail}>✖ Con problemas</span>;
  };

  return (
    <>
      <div className="as-card">
        <div className="as-row as-row-top">
          <div>
            <h3>Métodos de pago disponibles</h3>
            <p className="as-muted">
              Activa, ordena y personaliza los métodos de pago. El estado se verifica en vivo con Wompi.
              {health?.merchant ? ` Comercio: ${health.merchant} (${health.mode}).` : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="as-btn as-btn-outline" onClick={() => void loadHealth()} disabled={healthBusy}>
              {healthBusy ? "Verificando..." : "↻ Verificar ahora"}
            </button>
          </div>
        </div>

        {health && health.alerts.length > 0 && (
          <div role="alert" style={{ display: "grid", gap: 6, marginBottom: 12 }}>
            {health.alerts.map((alert, index) => (
              <div
                key={`${alert.message}-${index}`}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  background: alert.level === "error" ? "#fee2e2" : "#fef3c7",
                  color: alert.level === "error" ? "#991b1b" : "#92400e",
                  fontWeight: 600,
                }}
              >
                {alert.level === "error" ? "✖ " : "⚠ "}
                {alert.message}
              </div>
            ))}
          </div>
        )}
        {health && health.alerts.length === 0 && health.configured && (
          <p style={{ color: "#166534", fontWeight: 600 }}>
            ✔ Todo en orden · verificado {new Date(health.checked_at).toLocaleTimeString("es-CO")}
          </p>
        )}

        <div className="as-methods-scroll"><div className="as-methods-grid">
          {catalog.map((method, index) => {
            const stat = stats[method.id];
            const accent = method.color || "#cbd5e1";
            return (
              <div className="as-card as-inner" key={method.id} style={{ borderTop: `4px solid ${accent}` }}>
                <div className="as-row">
                  <span className="as-method">
                    <b aria-hidden="true">{method.icon}</b>
                    <span><strong>{method.name}</strong><small>{method.description}</small></span>
                  </span>
                  <Toggle
                    checked={sec[`${method.id}_enabled`] !== false}
                    label={method.name}
                    onChange={(v) => setSec({ [`${method.id}_enabled`]: v })}
                  />
                </div>
                <div className="as-method-actions">
                  <button type="button" className="as-btn as-btn-outline" aria-label={`Subir ${method.name}`} disabled={index === 0} onClick={() => move(method.id, -1)}>↑</button>
                  <button type="button" className="as-btn as-btn-outline" aria-label={`Bajar ${method.name}`} disabled={index === catalog.length - 1} onClick={() => move(method.id, 1)}>↓</button>
                  <button type="button" className="as-btn as-btn-outline" onClick={() => setEditing(method)}>✏️ Editar</button>
                  {statusBadge(method)}
                </div>
                {health?.methods[method.id]?.status === "error" && method.builtin && (
                  <small style={{ color: "#991b1b" }}>{health.methods[method.id].detail}</small>
                )}
                <FieldList
                  fields={[
                    { key: `${method.id}_provider`, label: "Proveedor" },
                    { key: `${method.id}_commission`, label: "Comisión por transacción", kind: "number", unit: "%" },
                    { key: `${method.id}_settlement`, label: "Tiempo de liquidación", kind: "select", options: SETTLEMENT },
                  ]}
                  values={sec}
                  onChange={(k, v) => setSec({ [k]: v })}
                />
                {stat ? (
                  <small className="as-muted" aria-label={`Estadísticas de ${method.name}`}>
                    30 días: ✔ {stat.approved} · ✖ {stat.declined} · {stat.approval_rate === null ? "sin datos" : `${stat.approval_rate}% aprobación`} · {cop(stat.approved_amount)}
                  </small>
                ) : (
                  <small className="as-muted">30 días: sin pagos registrados</small>
                )}
                {method.builtin ? (
                  <button type="button" className="as-btn as-btn-outline as-btn-block" onClick={() => onTestConnection(method.id, method.name)}>
                    ⚡ Probar conexión
                  </button>
                ) : (
                  <button type="button" className="as-btn as-btn-outline as-btn-block" onClick={() => removeMethod(method.id)}>
                    🗑 Eliminar método
                  </button>
                )}
              </div>
            );
          })}
        </div></div>
        <label className="as-inline" style={{ marginTop: 8 }}>
          <input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} /> Incluir pagos de prueba en las estadísticas
        </label>
        {stats.other && (
          <p className="as-muted">
            Otros métodos (no clasificados): ✔ {stats.other.approved} · ✖ {stats.other.declined} · {cop(stats.other.approved_amount)}
          </p>
        )}
      </div>

      <div className="as-card">
        <div className="as-row as-row-top">
          <div>
            <h3>🧮 Calculadora de comisiones</h3>
            <p className="as-muted">
              Simula cuánto recibe cada parte por método con tu comisión de plataforma ({platformRate}%) y el descuento configurado.
            </p>
          </div>
          <label className="as-inline">
            Valor del servicio (COP)
            <input type="number" min={1500} step={1000} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))} />
          </label>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="as-table">
            <thead>
              <tr><th>Método</th><th>Cliente paga</th><th>Comisión pasarela</th><th>Comisión Serviprox</th><th>Descuento</th><th>Profesional recibe</th><th>Neto plataforma</th></tr>
            </thead>
            <tbody>
              {catalog.filter((m) => sec[`${m.id}_enabled`] !== false).map((method) => {
                const r = calc(method.id);
                return (
                  <tr key={method.id}>
                    <td>{method.icon} {method.name}</td>
                    <td>{cop(r.paid)}</td>
                    <td>{cop(r.gateway)}</td>
                    <td>{cop(r.platform)}</td>
                    <td>{r.discount ? `-${cop(r.discount)}` : "—"}</td>
                    <td>{cop(r.professional)}</td>
                    <td style={{ fontWeight: 700, color: r.net < 0 ? "#b91c1c" : "#166534" }}>{cop(r.net)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="as-muted">El neto de la plataforma es su comisión menos la comisión de la pasarela y el descuento que asume.</p>
      </div>

      {editing && (
        <div className="as-modal" role="dialog" aria-modal="true" aria-label={`Editar ${editing.name}`}
          onClick={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="as-modal-box as-modal-wide" style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div className="as-row">
              <h3 style={{ margin: 0 }}>Editar método de pago</h3>
              <button type="button" className="as-btn as-btn-outline" aria-label="Cerrar" onClick={() => setEditing(null)}>✕</button>
            </div>
            <label>Nombre
              <input maxLength={40} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </label>
            <label>Descripción
              <input maxLength={120} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </label>
            <div>
              <strong>Icono</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {ICONS.map((icon) => (
                  <button key={icon} type="button" aria-label={`Icono ${icon}`} aria-pressed={editing.icon === icon}
                    onClick={() => setEditing({ ...editing, icon })}
                    style={{ fontSize: "1.5rem", padding: "4px 8px", borderRadius: 10, border: editing.icon === icon ? "2px solid #2563eb" : "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <strong>Color de acento</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, alignItems: "center" }}>
                {COLORS.map((color) => (
                  <button key={color} type="button" aria-label={`Color ${color}`} aria-pressed={editing.color === color}
                    onClick={() => setEditing({ ...editing, color })}
                    style={{ width: 30, height: 30, borderRadius: "50%", background: color, border: editing.color === color ? "3px solid #0f172a" : "2px solid #fff", boxShadow: "0 0 0 1px #cbd5e1", cursor: "pointer" }} />
                ))}
                <input type="color" aria-label="Color personalizado" value={editing.color || "#cbd5e1"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
                <button type="button" className="as-btn as-btn-outline" onClick={() => setEditing({ ...editing, color: "" })}>Sin color</button>
              </div>
            </div>
            <div className="as-card as-inner" style={{ borderTop: `4px solid ${editing.color || "#cbd5e1"}` }}>
              <span className="as-method">
                <b aria-hidden="true">{editing.icon}</b>
                <span><strong>{editing.name || "Sin nombre"}</strong><small>{editing.description}</small></span>
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="as-btn as-btn-outline" onClick={() => setEditing(null)}>Cancelar</button>
              <button
                type="button"
                className="as-btn"
                onClick={() => {
                  if (!editing.name.trim()) {
                    notify("error", "El método necesita un nombre.");
                    return;
                  }
                  saveUi(editing.id, { name: editing.name, description: editing.description, icon: editing.icon, color: editing.color });
                  setEditing(null);
                }}
              >
                Aplicar (recuerda guardar los cambios)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MethodsGrid;
