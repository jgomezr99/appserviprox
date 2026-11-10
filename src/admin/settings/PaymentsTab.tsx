import React, { useEffect, useState } from "react";
import { api } from "../../services/api";
import { apiMessage } from "../../utils/workflow";
import PaymentResultBanner from "../../components/historiadepago/PaymentResultBanner";
import TestPaymentForm from "../../components/historiadepago/TestPaymentForm";
import type { DemoPaymentMethod } from "../../services/serviprox";
import { DEFAULT_PAYMENT_FORM, resolvePaymentForm, type PaymentFormConfig } from "../../services/paymentForm";
import { MethodsGrid } from "./MethodsGrid";
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

type ConnectionReport = {
  ok: boolean;
  mode: string;
  detail: string;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
};

const FORM_METHODS: Record<string, DemoPaymentMethod[]> = {
  pse: ["transfer"],
  card: ["credit", "debit"],
  transfer: ["transfer"],
  wallet: ["wallet"],
};

const CURRENCIES = ["Peso colombiano (COP)", "Dólar (USD)", "Euro (EUR)"];

export const PaymentsTab: React.FC<TabProps> = ({ form, setForm, sec, setSec, busy, save, reset, notify }) => {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [testKey, setTestKey] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [testError, setTestError] = useState("");
  const [connBusy, setConnBusy] = useState("");
  const [formMethod, setFormMethod] = useState<{ id: string; name: string } | null>(null);
  const [connReports, setConnReports] = useState<Record<string, ConnectionReport>>({});

  const paymentForm = resolvePaymentForm(sec.payment_form);
  const updateForm = (patch: Partial<PaymentFormConfig>) => setSec({ payment_form: { ...paymentForm, ...patch } });
  const updateMethod = (index: number, patch: Partial<PaymentFormConfig["methods"][number]>) =>
    updateForm({ methods: paymentForm.methods.map((m, i) => (i === index ? { ...m, ...patch } : m)) });
  const moveMethod = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= paymentForm.methods.length) return;
    const next = [...paymentForm.methods];
    [next[index], next[target]] = [next[target], next[index]];
    updateForm({ methods: next });
  };
  const toggleMethod = (index: number, enabled: boolean) => {
    if (!enabled && paymentForm.methods.filter((m) => m.enabled).length <= 1) {
      notify("error", "Deja al menos un método activo en el formulario de pago.");
      return;
    }
    updateMethod(index, { enabled });
  };

  const testConnection = async (id: string, name: string) => {
    setConnBusy(id);
    try {
      const report = await api.post<ConnectionReport>("admin/payments/test-connection/", { method: id });
      setConnReports((current) => ({ ...current, [id]: report }));
      notify(report.ok ? "ok" : "error", `${name}: ${report.detail}`);
      return report;
    } catch (error) {
      notify("error", `${name}: ${apiMessage(error, "No se pudo probar la conexión.")}`);
      return undefined;
    } finally {
      setConnBusy("");
    }
  };

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

  const toggleTestPayment = async (enabled: boolean) => {
    setTestBusy(true);
    setTestError("");
    try {
      await api.post("admin/settings/test-payment/", { enabled, key: testKey });
      setSec({ test_payment_enabled: enabled });
      setTestKey("");
      notify("ok", enabled ? "Pago de prueba activado." : "Pago de prueba desactivado.");
    } catch (error) {
      setTestError(apiMessage(error, "No se pudo cambiar el pago de prueba."));
    } finally {
      setTestBusy(false);
    }
  };

  return (
  <>
    <Card title="Pago de prueba" icon="🧪" badge={sec.test_payment_enabled ? "Activo" : "Inactivo"}>
      <p className="as-muted">Permite confirmar pagos sin cobro real para pruebas. Activarlo requiere la clave de administrador.</p>
      <div className="as-row">
        <label>
          Clave de activación
          <input
            type="password"
            autoComplete="off"
            value={testKey}
            disabled={testBusy}
            onChange={(e) => setTestKey(e.target.value)}
          />
        </label>
        <Toggle
          checked={Boolean(sec.test_payment_enabled)}
          label="Pago de prueba"
          disabled={testBusy}
          onChange={(v) => void toggleTestPayment(v)}
        />
      </div>
      {testError && <p role="alert" style={{ color: "#b91c1c" }}>{testError}</p>}
    </Card>

    <div className="as-row" style={{ justifyContent: "flex-end", margin: "4px 0 10px" }}>
      <label className="as-inline">
        Moneda de la plataforma
        <select value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}>
          {[...new Set([form.currency, ...CURRENCIES])].map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
    </div>

    <MethodsGrid sec={sec} setSec={setSec} notify={notify} onTestConnection={(id, name) => setFormMethod({ id, name })} />

    <Card title="Formulario de pago del cliente" icon="🧾">
      <p className="as-muted">
        Edita los textos, el orden de los botones y los campos del formulario que ve el cliente al pagar. Usa{" "}
        <code>{"{monto}"}</code> donde quieras mostrar el valor a pagar. Guarda los cambios para publicarlos en la app.
      </p>
      <div className="as-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <div>
          <label>Título
            <input maxLength={80} value={paymentForm.title} onChange={(e) => updateForm({ title: e.target.value })} />
          </label>
          <label>Mensaje informativo
            <textarea rows={3} maxLength={240} value={paymentForm.note} onChange={(e) => updateForm({ note: e.target.value })} />
          </label>
          <label>Texto del botón (tarjetas)
            <input maxLength={60} value={paymentForm.submit_label} onChange={(e) => updateForm({ submit_label: e.target.value })} />
          </label>
          <label>Texto del botón (transferencia)
            <input maxLength={60} value={paymentForm.transfer_submit_label} onChange={(e) => updateForm({ transfer_submit_label: e.target.value })} />
          </label>
          <div className="as-row">
            <span>Mostrar cuotas (tarjeta de crédito)</span>
            <Toggle checked={paymentForm.show_installments} label="Mostrar cuotas" onChange={(v) => updateForm({ show_installments: v })} />
          </div>
          <div className="as-row">
            <span>Mostrar referencia de la transferencia</span>
            <Toggle checked={paymentForm.show_transfer_reference} label="Mostrar referencia de la transferencia" onChange={(v) => updateForm({ show_transfer_reference: v })} />
          </div>
          <strong>Botones de método de pago (orden en que se muestran)</strong>
          {paymentForm.methods.map((m, index) => (
            <div className="as-row" key={m.id} style={{ gap: 6 }}>
              <button type="button" className="as-btn as-btn-outline" aria-label={`Subir ${m.label}`} disabled={index === 0} onClick={() => moveMethod(index, -1)}>↑</button>
              <button type="button" className="as-btn as-btn-outline" aria-label={`Bajar ${m.label}`} disabled={index === paymentForm.methods.length - 1} onClick={() => moveMethod(index, 1)}>↓</button>
              <input aria-label={`Nombre del botón ${m.id}`} maxLength={40} value={m.label} onChange={(e) => updateMethod(index, { label: e.target.value })} style={{ flex: 1 }} />
              <Toggle checked={m.enabled} label={`Mostrar ${m.label}`} onChange={(v) => toggleMethod(index, v)} />
            </div>
          ))}
          <strong>Botón de pago (diseño y ubicación)</strong>
          <div className="as-row">
            <label>Color del botón
              <input type="color" value={paymentForm.button_color} onChange={(e) => updateForm({ button_color: e.target.value })} />
            </label>
            <label>Color del texto
              <input type="color" value={paymentForm.button_text_color} onChange={(e) => updateForm({ button_text_color: e.target.value })} />
            </label>
          </div>
          <div className="as-row">
            <label>Tamaño
              <select value={paymentForm.button_size} onChange={(e) => updateForm({ button_size: e.target.value as PaymentFormConfig["button_size"] })}>
                <option value="small">Pequeño</option>
                <option value="medium">Mediano</option>
                <option value="large">Grande</option>
              </select>
            </label>
            <label>Ubicación
              <select value={paymentForm.button_align} onChange={(e) => updateForm({ button_align: e.target.value as PaymentFormConfig["button_align"] })}>
                <option value="full">Ancho completo</option>
                <option value="left">Izquierda</option>
                <option value="center">Centro</option>
                <option value="right">Derecha</option>
              </select>
            </label>
            <label>Forma
              <select value={paymentForm.button_shape} onChange={(e) => updateForm({ button_shape: e.target.value as PaymentFormConfig["button_shape"] })}>
                <option value="rounded">Redondeado</option>
                <option value="square">Cuadrado</option>
                <option value="pill">Píldora</option>
              </select>
            </label>
          </div>
          {(["approved", "declined"] as const).map((kind) => (
            <div key={kind} style={{ borderLeft: `4px solid ${paymentForm[kind].color}`, paddingLeft: 10 }}>
              <strong>{kind === "approved" ? "Pago aprobado" : "Pago rechazado"}</strong>
              <label>Título
                <input maxLength={80} value={paymentForm[kind].title} onChange={(e) => updateForm({ [kind]: { ...paymentForm[kind], title: e.target.value } })} />
              </label>
              <label>Mensaje
                <textarea rows={2} maxLength={240} value={paymentForm[kind].message} onChange={(e) => updateForm({ [kind]: { ...paymentForm[kind], message: e.target.value } })} />
              </label>
              <label>Color
                <input type="color" value={paymentForm[kind].color} onChange={(e) => updateForm({ [kind]: { ...paymentForm[kind], color: e.target.value } })} />
              </label>
              <div className="as-row">
                <label>Tamaño
                  <select value={paymentForm[kind].size} onChange={(e) => updateForm({ [kind]: { ...paymentForm[kind], size: e.target.value } })}>
                    <option value="small">Pequeño</option>
                    <option value="medium">Mediano</option>
                    <option value="large">Grande</option>
                  </select>
                </label>
                <label>Estilo
                  <select value={paymentForm[kind].style} onChange={(e) => updateForm({ [kind]: { ...paymentForm[kind], style: e.target.value } })}>
                    <option value="soft">Suave</option>
                    <option value="solid">Sólido</option>
                    <option value="outline">Solo borde</option>
                  </select>
                </label>
              </div>
              <div className="as-row">
                <label>Ubicación
                  <select value={paymentForm[kind].position} onChange={(e) => updateForm({ [kind]: { ...paymentForm[kind], position: e.target.value } })}>
                    <option value="top">Arriba de la página</option>
                    <option value="form">Junto al formulario</option>
                  </select>
                </label>
                <label>Alineación
                  <select value={paymentForm[kind].align} onChange={(e) => updateForm({ [kind]: { ...paymentForm[kind], align: e.target.value } })}>
                    <option value="left">Izquierda</option>
                    <option value="center">Centro</option>
                    <option value="right">Derecha</option>
                  </select>
                </label>
                <label>Forma
                  <select value={paymentForm[kind].shape} onChange={(e) => updateForm({ [kind]: { ...paymentForm[kind], shape: e.target.value } })}>
                    <option value="rounded">Redondeado</option>
                    <option value="square">Cuadrado</option>
                    <option value="pill">Píldora</option>
                  </select>
                </label>
              </div>
            </div>
          ))}
          <button type="button" className="as-btn as-btn-outline" onClick={() => setSec({ payment_form: DEFAULT_PAYMENT_FORM })}>
            ↺ Restablecer formulario
          </button>
        </div>
        <div>
          <strong>Vista previa (así lo verá el cliente)</strong>
          <div style={{ marginTop: 8 }}>
            <TestPaymentForm config={paymentForm} amountLabel="$ 120.000" busy={false} onSubmit={() => undefined} />
          </div>
          {(["approved", "declined"] as const).map((kind) => (
            <div key={kind} style={{ marginTop: 10 }}>
              <PaymentResultBanner kind={kind} result={paymentForm[kind]} />
              <small className="as-muted">{paymentForm[kind].position === "top" ? "Se muestra arriba de la página." : "Se muestra junto al formulario."}</small>
            </div>
          ))}
        </div>
      </div>
    </Card>

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
        <div className="as-row">
          <span>
            <strong>Aplicar descuento en los pagos</strong>
            <small className="as-muted" style={{ display: "block" }}>
              Se descuenta del total que paga el cliente. La plataforma lo asume con su comisión: el profesional recibe lo mismo.
            </small>
          </span>
          <Toggle
            checked={Boolean(sec.discount_enabled)}
            label="Aplicar descuento en los pagos"
            onChange={(v) => setSec({ discount_enabled: v })}
          />
        </div>
        {Boolean(sec.discount_enabled) && (
          <div className="as-row">
            <label>
              Tipo de descuento
              <select
                value={String(sec.discount_type || "percent")}
                onChange={(e) => setSec({ discount_type: e.target.value })}
              >
                <option value="percent">Porcentaje (%)</option>
                <option value="fixed">Valor fijo (COP)</option>
              </select>
            </label>
            <label>
              {sec.discount_type === "fixed" ? "Valor del descuento (COP)" : "Porcentaje de descuento"}
              <input
                type="number"
                min={0}
                max={sec.discount_type === "fixed" ? undefined : 100}
                step={sec.discount_type === "fixed" ? 100 : 1}
                value={String(sec.discount_value ?? "")}
                onChange={(e) => setSec({ discount_value: e.target.value === "" ? "" : Number(e.target.value) })}
              />
            </label>
          </div>
        )}
        <p className="as-muted">
          El descuento nunca supera la comisión de la plataforma ni deja el pago por debajo de $1.500 COP. Guarda los cambios para aplicarlo.
        </p>
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

    {formMethod && (
      <div className="as-modal" role="dialog" aria-modal="true" aria-label={`Probar conexión: ${formMethod.name}`}
        onClick={(e) => { if (e.target === e.currentTarget) setFormMethod(null); }}>
        <div className="as-modal-box as-modal-wide" style={{ maxHeight: "90vh", overflowY: "auto" }}>
          <div className="as-row">
            <h3 style={{ margin: 0 }}>Probar conexión · {formMethod.name}</h3>
            <button type="button" className="as-btn as-btn-outline" onClick={() => setFormMethod(null)} aria-label="Cerrar">✕</button>
          </div>
          <TestPaymentForm
            key={formMethod.id}
            amountLabel="$ 1.500"
            busy={connBusy === formMethod.id}
            methods={FORM_METHODS[formMethod.id]}
            transferLabel={formMethod.id === "pse" ? "PSE" : undefined}
            title="Formulario de pago de prueba"
            note="Completa el formulario y se verificará la conexión con Wompi para este método. No se realiza ningún cobro ni se guardan los datos."
            submitLabel="Probar conexión con estos datos"
            onSubmit={async () => { await testConnection(formMethod.id, formMethod.name); }}
          />
          {connReports[formMethod.id] && (
            <div aria-live="polite" role="status">
              <strong style={{ color: connReports[formMethod.id].ok ? "#15803d" : "#b91c1c" }}>
                {connReports[formMethod.id].ok ? "✔ " : "✖ "}{connReports[formMethod.id].detail}
              </strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13 }}>
                {connReports[formMethod.id].checks.map((check) => (
                  <li key={check.name} style={{ color: check.ok ? "#15803d" : "#b91c1c" }}>
                    {check.ok ? "✔" : "✖"} {check.name}: {check.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    )}

    <Footer busy={busy} save={save} reset={reset} note="Realiza una prueba de conexión después de modificar la configuración de cada método de pago." />
  </>
  );
};
