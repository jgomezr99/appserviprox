import React, { useCallback, useEffect, useState } from "react";
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenuButton,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar,
} from "@ionic/react";
import { refreshOutline } from "ionicons/icons";
import {
  financeService,
  formatDate,
  formatMoney,
  type ProfessionalEarnings,
  type WithdrawalStatus,
} from "../services/finance";
import { ApiError } from "../services/api";
import "./RolePages.css";
import "../components/finanzas/finanzas.css";

type Tab = "incomes" | "withdrawals" | "transfers";

const TABS: Array<[Tab, string]> = [
  ["incomes", "Ingresos por servicio"],
  ["withdrawals", "Retiros"],
  ["transfers", "Transferencias recibidas"],
];

const MIN_WITHDRAWAL = 10000;

const BANK_ENTITIES = [
  { id: "Nequi", label: "Nequi", isWallet: true },
  { id: "Daviplata", label: "Daviplata", isWallet: true },
  { id: "Bancolombia", label: "Bancolombia", isWallet: false },
  { id: "Davivienda", label: "Davivienda", isWallet: false },
  { id: "Banco de Bogotá", label: "Banco de Bogotá", isWallet: false },
  { id: "BBVA", label: "BBVA", isWallet: false },
  { id: "Nubank / Lulo", label: "Nubank / Lulo", isWallet: false },
  { id: "Otro", label: "Otro banco", isWallet: false },
] as const;

type BankEntityId = (typeof BANK_ENTITIES)[number]["id"];

const withdrawalColor = (status: WithdrawalStatus) =>
  status === "paid" ? "success" : status === "rejected" ? "danger" : "warning";

const payoutColor = (status: string) =>
  status === "settled" ? "success" : status === "refunded" ? "medium" : "warning";

const ProfessionalEarningsPage: React.FC = () => {
  const [data, setData] = useState<ProfessionalEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("incomes");
  const [amount, setAmount] = useState("");
  const [entity, setEntity] = useState<BankEntityId>("Nequi");
  const [customBank, setCustomBank] = useState("");
  const [accountType, setAccountType] = useState<"Ahorros" | "Corriente">("Ahorros");
  const [accountNumber, setAccountNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await financeService.earnings());
    } catch {
      setError("No pudimos cargar tus ingresos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedEntityMeta = BANK_ENTITIES.find((item) => item.id === entity) || BANK_ENTITIES[0];
  const resolvedBankName = entity === "Otro" ? customBank.trim() : selectedEntityMeta.label;
  const cleanedAccount = accountNumber.trim();
  const formattedDestination = cleanedAccount
    ? selectedEntityMeta.isWallet
      ? `${resolvedBankName} · ${cleanedAccount}`
      : `${resolvedBankName || "Banco"} (${accountType}) · ${cleanedAccount}`
    : "";

  const handleWithdrawAll = () => {
    if (!data) return;
    const maxAmount = Math.floor(data.summary.available_balance);
    if (maxAmount >= MIN_WITHDRAWAL) {
      setAmount(String(maxAmount));
      setFormError("");
    }
  };

  const submitWithdrawal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || !data) return;
    const normalizedAmount = amount.replace(/[^\d.,]/g, "").replace(",", ".");
    const value = Number(normalizedAmount);
    setFormError("");

    if (data.summary.available_balance < MIN_WITHDRAWAL) {
      setFormError(`Necesitas al menos ${formatMoney(MIN_WITHDRAWAL)} de saldo disponible para retirar.`);
      return;
    }
    if (!Number.isFinite(value) || value < MIN_WITHDRAWAL) {
      setFormError(`El retiro mínimo es ${formatMoney(MIN_WITHDRAWAL)}.`);
      return;
    }
    if (value > data.summary.available_balance) {
      setFormError(`El monto supera tu saldo disponible (${formatMoney(data.summary.available_balance)}).`);
      return;
    }
    if (entity === "Otro" && resolvedBankName.length < 2) {
      setFormError("Escribe el nombre del banco de destino.");
      return;
    }
    if (cleanedAccount.length < 6) {
      setFormError(
        selectedEntityMeta.isWallet
          ? "Ingresa un número de celular válido (mínimo 6 dígitos)."
          : "Ingresa un número de cuenta válido (mínimo 6 dígitos)."
      );
      return;
    }

    setSubmitting(true);
    try {
      await financeService.requestWithdrawal(value, formattedDestination);
      setAmount("");
      setAccountNumber("");
      setCustomBank("");
      setToast("Solicitud de retiro enviada. El equipo de Serviprox fue notificado para revisarla.");
      setTab("withdrawals");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No pudimos enviar la solicitud.");
    } finally {
      setSubmitting(false);
    }
  };

  const summary = data?.summary;
  const canWithdraw = Boolean(summary && summary.available_balance >= MIN_WITHDRAWAL);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} menu="main-menu" />
          </IonButtons>
          <IonTitle>Mis ingresos</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="sp-role-content">
        <main className="sp-role-page">
          <header className="sp-role-header">
            <span className="sp-role-kicker">PROFESIONAL</span>
            <h1>Mis ingresos</h1>
            <p>
              Consulta lo generado por tus servicios, la comisión de Serviprox
              {summary ? ` (${summary.commission_rate}%)` : ""}, tu saldo y tus retiros.
            </p>
          </header>

          {loading && !data ? (
            <div className="sp-card sp-route-loading">
              <IonSpinner name="crescent" />
              <span>Cargando ingresos...</span>
            </div>
          ) : error || !data || !summary ? (
            <section className="sp-card">
              <p className="sp-error">{error || "No pudimos cargar tus ingresos."}</p>
              <IonButton onClick={() => void load()}>
                <IonIcon slot="start" icon={refreshOutline} />
                Reintentar
              </IonButton>
            </section>
          ) : (
            <>
              <section className="fin-kpis" aria-label="Resumen de ingresos">
                <div className="sp-card fin-kpi fin-kpi--highlight">
                  <span>Saldo disponible</span>
                  <strong>{formatMoney(summary.available_balance)}</strong>
                  <small>Liquidado automáticamente al completar y pagar el servicio</small>
                </div>
                <div className="sp-card fin-kpi">
                  <span>Pendiente de liquidación</span>
                  <strong>{formatMoney(summary.pending_settlement)}</strong>
                  <small>Se libera al completar el servicio</small>
                </div>
                <div className="sp-card fin-kpi">
                  <span>Ingresos brutos</span>
                  <strong>{formatMoney(summary.gross_total)}</strong>
                </div>
                <div className="sp-card fin-kpi">
                  <span>Comisiones descontadas</span>
                  <strong>{formatMoney(summary.commission_total)}</strong>
                </div>
                <div className="sp-card fin-kpi">
                  <span>Ingresos netos</span>
                  <strong>{formatMoney(summary.net_total)}</strong>
                </div>
                <div className="sp-card fin-kpi">
                  <span>Retirado</span>
                  <strong>{formatMoney(summary.withdrawn_total)}</strong>
                  <small>En trámite: {formatMoney(summary.pending_withdrawals)}</small>
                </div>
              </section>

              <section className="sp-card">
                <div className="fin-form-header">
                  <h2 className="fin-section-title">Solicitar retiro</h2>
                  <span className="fin-balance-pill">
                    Disponible: {formatMoney(summary.available_balance)}
                  </span>
                </div>
                <form className="fin-form" onSubmit={submitWithdrawal} noValidate>
                  <label>
                    Valor a retirar (COP)
                    <div className="fin-amount-row">
                      <input
                        className="fin-input"
                        type="number"
                        inputMode="numeric"
                        min={MIN_WITHDRAWAL}
                        step={1}
                        value={amount}
                        onChange={(event) => {
                          setAmount(event.target.value);
                          if (formError) setFormError("");
                        }}
                        placeholder={`Monto exacto desde ${formatMoney(MIN_WITHDRAWAL)}`}
                        required
                      />
                      <button
                        type="button"
                        className="fin-max-btn"
                        disabled={!canWithdraw || submitting}
                        onClick={handleWithdrawAll}
                      >
                        Retirar todo
                      </button>
                    </div>
                  </label>

                  <div className="fin-destination-grid">
                    <label>
                      Banco o billetera
                      <select
                        className="fin-input"
                        value={entity}
                        onChange={(event) => {
                          setEntity(event.target.value as BankEntityId);
                          if (formError) setFormError("");
                        }}
                      >
                        {BANK_ENTITIES.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {entity === "Otro" && (
                      <label>
                        Nombre del banco
                        <input
                          className="fin-input"
                          type="text"
                          maxLength={60}
                          value={customBank}
                          onChange={(event) => {
                            setCustomBank(event.target.value);
                            if (formError) setFormError("");
                          }}
                          placeholder="Ej: Banco Agrario / Scotiabank"
                          required
                        />
                      </label>
                    )}

                    {!selectedEntityMeta.isWallet && (
                      <label>
                        Tipo de cuenta
                        <select
                          className="fin-input"
                          value={accountType}
                          onChange={(event) => setAccountType(event.target.value as "Ahorros" | "Corriente")}
                        >
                          <option value="Ahorros">Ahorros</option>
                          <option value="Corriente">Corriente</option>
                        </select>
                      </label>
                    )}

                    <label>
                      {selectedEntityMeta.isWallet ? "Número de celular" : "Número de cuenta"}
                      <input
                        className="fin-input"
                        type="text"
                        inputMode="numeric"
                        maxLength={80}
                        value={accountNumber}
                        onChange={(event) => {
                          setAccountNumber(event.target.value);
                          if (formError) setFormError("");
                        }}
                        placeholder={selectedEntityMeta.isWallet ? "Ej: 3028505810" : "Ej: 12345678901"}
                        required
                      />
                    </label>
                  </div>

                  {formattedDestination && (
                    <p className="fin-destination-preview">
                      Destino registrado: <strong>{formattedDestination}</strong>
                    </p>
                  )}

                  {formError && <p className="sp-error">{formError}</p>}

                  <IonButton
                    type="submit"
                    className="sp-primary-button"
                    disabled={submitting || !canWithdraw}
                  >
                    {submitting ? <IonSpinner name="crescent" /> : "Solicitar retiro"}
                  </IonButton>

                  {!canWithdraw && (
                    <p className="sp-muted">
                      Necesitas al menos {formatMoney(MIN_WITHDRAWAL)} de saldo disponible para retirar.
                      {summary.pending_settlement > 0
                        ? ` Tienes ${formatMoney(summary.pending_settlement)} pendiente de liquidación que se liberará automáticamente al completar el servicio.`
                        : " Cuando completes y se pague un servicio, tu saldo quedará disponible automáticamente."}
                    </p>
                  )}
                </form>
              </section>

              <section className="sp-card">
                <div className="fin-toolbar">
                  <div className="fin-filters" role="tablist">
                    {TABS.map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={tab === value}
                        className={`fin-chip ${tab === value ? "is-active" : ""}`}
                        onClick={() => setTab(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <IonButton fill="clear" size="small" onClick={() => void load()}>
                    <IonIcon slot="start" icon={refreshOutline} />
                    Actualizar
                  </IonButton>
                </div>

                {tab === "incomes" &&
                  (data.incomes.length === 0 ? (
                    <p className="sp-muted fin-empty">Aún no tienes ingresos por servicios pagados.</p>
                  ) : (
                    <div className="fin-table-wrap">
                      <table className="fin-table">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Servicio</th>
                            <th>Bruto</th>
                            <th>Comisión</th>
                            <th>Neto</th>
                            <th>Liquidación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.incomes.map((row) => (
                            <tr key={row.order_id}>
                              <td data-label="Fecha">{formatDate(row.date)}</td>
                              <td data-label="Servicio">
                                <strong>{row.service}</strong>
                                <small>
                                  {row.client} · Orden #{row.order_id}
                                </small>
                              </td>
                              <td data-label="Bruto">{formatMoney(row.gross)}</td>
                              <td data-label="Comisión">
                                -{formatMoney(row.commission)} ({row.commission_rate}%)
                              </td>
                              <td data-label="Neto">
                                <strong>{formatMoney(row.net)}</strong>
                              </td>
                              <td data-label="Liquidación">
                                <IonBadge color={payoutColor(row.payout_status)}>
                                  {row.payout_status_label}
                                </IonBadge>
                                {row.payout_settled_at && <small>{formatDate(row.payout_settled_at)}</small>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}

                {tab === "withdrawals" &&
                  (data.withdrawals.length === 0 ? (
                    <p className="sp-muted fin-empty">Todavía no has solicitado retiros.</p>
                  ) : (
                    <div className="fin-table-wrap">
                      <table className="fin-table">
                        <thead>
                          <tr>
                            <th>Solicitud</th>
                            <th>Valor</th>
                            <th>Destino</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.withdrawals.map((row) => (
                            <tr key={row.id}>
                              <td data-label="Solicitud">{formatDate(row.created_at)}</td>
                              <td data-label="Valor">{formatMoney(row.amount)}</td>
                              <td data-label="Destino">{row.destination}</td>
                              <td data-label="Estado">
                                <IonBadge color={withdrawalColor(row.status)}>{row.status_label}</IonBadge>
                                {row.note && <small>{row.note}</small>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}

                {tab === "transfers" &&
                  (data.transfers.length === 0 ? (
                    <p className="sp-muted fin-empty">Aún no has recibido transferencias.</p>
                  ) : (
                    <div className="fin-table-wrap">
                      <table className="fin-table">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Valor</th>
                            <th>Destino</th>
                            <th>Referencia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.transfers.map((row) => (
                            <tr key={row.id}>
                              <td data-label="Fecha">{formatDate(row.resolved_at)}</td>
                              <td data-label="Valor">{formatMoney(row.amount)}</td>
                              <td data-label="Destino">{row.destination}</td>
                              <td data-label="Referencia" className="fin-mono">
                                {row.transfer_reference}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
              </section>
            </>
          )}
        </main>
        <IonToast isOpen={!!toast} message={toast} duration={3500} onDidDismiss={() => setToast("")} />
      </IonContent>
    </IonPage>
  );
};

export default ProfessionalEarningsPage;
