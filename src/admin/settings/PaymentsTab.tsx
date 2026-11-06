import React, { useEffect, useState } from "react";
import { api } from "../../services/api";
import { Card, Empty, FieldList, Footer, TabProps, Toggle } from "./ui";

type PaymentRow = {
  id: number;
  date: string;
  reference: string;
  method: string;
  user: string;
  amount: number;
  status: string;
  status_label: string;
};

const METHODS = [
  ["pse", "PSE", "Pagos seguros en línea", "🏦"],
  ["card", "Tarjetas débito/crédito", "Visa, MasterCard, American Express", "💳"],
  ["transfer", "Transferencia bancaria", "Transferencias directas", "🏧"],
  ["wallet", "Billetera / Pago móvil", "Nequi, Daviplata", "📲"],
] as const;

const SETTLEMENT = ["Inmediato", "1 - 2 días hábiles", "3 - 5 días hábiles"];
const CURRENCIES = ["Peso colombiano (COP)", "Dólar (USD)", "Euro (EUR)"];

export const PaymentsTab: React.FC<TabProps> = ({ form, setForm, sec, setSec, busy, save, reset, notify }) => {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadPayments = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await api.get<any>("admin/payments/");
      const payments = Array.isArray(response) ? response : response?.results;
      if (!Array.isArray(payments)) throw new Error("La respuesta de pagos tiene un formato inesperado.");
      setRows(payments);
    } catch (error) {
      setRows([]);
      setLoadError(error instanceof Error ? error.message : "No se pudieron cargar las transacciones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPayments();
  }, []);

  return (
  <>
    <div className="as-card">
      <div className="as-row as-row-top">
        <div>
          <h3>Métodos de pago disponibles</h3>
          <p className="as-muted">Activa o desactiva los métodos de pago y configura sus parámetros.</p>
        </div>
        <label className="as-inline">
          Moneda de la plataforma
          <select value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}>
            {[...new Set([form.currency, ...CURRENCIES])].map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <div className="as-grid as-grid-4">
        {METHODS.map(([id, name, sub, icon]) => (
          <div className="as-card as-inner" key={id}>
            <div className="as-row">
              <span className="as-method"><b aria-hidden="true">{icon}</b> <span><strong>{name}</strong><small>{sub}</small></span></span>
              <Toggle checked={sec[`${id}_enabled`]} label={name} onChange={(v) => setSec({ [`${id}_enabled`]: v })} />
            </div>
            <FieldList
              fields={[
                { key: `${id}_provider`, label: "Proveedor" },
                { key: `${id}_commission`, label: "Comisión por transacción", kind: "number", unit: "%" },
                { key: `${id}_settlement`, label: "Tiempo de liquidación", kind: "select", options: SETTLEMENT },
              ]}
              values={sec}
              onChange={(k, v) => setSec({ [k]: v })}
            />
            <span className={`as-badge ${sec[`${id}_enabled`] ? "" : "as-badge-off"}`}>{sec[`${id}_enabled`] ? "Activo" : "Inactivo"}</span>
            <button
              type="button"
              className="as-btn as-btn-outline as-btn-block"
              onClick={() =>
                notify(sec[`${id}_provider`] ? "ok" : "error", sec[`${id}_provider`] ? `${name}: configuración completa. La prueba real con el proveedor aún no está disponible.` : `${name}: indica el proveedor.`)
              }
            >
              ⚡ Probar conexión
            </button>
          </div>
        ))}
      </div>
    </div>

    <div className="as-grid as-grid-2b">
      <Card title="Configuración general de pagos" icon="⚙️">
        <label>Moneda principal
          <select value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}>
            {[...new Set([form.currency, ...CURRENCIES])].map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <FieldList
          fields={[
            { key: "platform_commission", label: "Comisión para la plataforma", kind: "number", unit: "%" },
            { key: "pro_settlement", label: "Liquidación de fondos a profesionales", kind: "select", options: ["Cada 7 días", "Cada 15 días", "Cada 30 días"] },
            { key: "instant_notice", label: "Notificación de pago exitoso", kind: "toggle" },
            { key: "auto_invoice", label: "Generar factura automáticamente", kind: "toggle" },
          ]}
          values={sec}
          onChange={(k, v) => setSec({ [k]: v })}
        />
      </Card>

      <Card title="Transacciones recientes" icon="🧾">
        {loading ? (
          <Empty text="Cargando transacciones desde la base de datos..." />
        ) : loadError ? (
          <div role="alert" style={{ color: "#b91c1c" }}>
            <p>{loadError}</p>
            <button type="button" className="as-btn as-btn-outline" onClick={() => void loadPayments()}>Reintentar</button>
          </div>
        ) : rows.length === 0 ? (
          <Empty text="Aún no hay transacciones registradas. Aparecerán aquí cuando se procesen pagos." />
        ) : (
          <table className="as-table">
            <thead><tr><th>Fecha</th><th>Referencia</th><th>Método</th><th>Usuario</th><th>Monto</th><th>Estado</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.date).toLocaleString("es-CO")}</td>
                  <td>{r.reference}</td>
                  <td>{r.method}</td>
                  <td>{r.user}</td>
                  <td>{r.amount.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}</td>
                  <td><span className={`as-badge ${r.status === "approved" ? "" : "as-badge-off"}`}>{r.status_label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>

    <Footer busy={busy} save={save} reset={reset} note="Realiza una prueba de conexión después de modificar la configuración de cada método de pago." />
  </>
  );
};
