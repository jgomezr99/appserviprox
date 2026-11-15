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
  const [destination, setDestination] = useState("");
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

  const submitWithdrawal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || !data) return;
    const value = Number(amount);
    setFormError("");
    if (!Number.isFinite(value) || value < MIN_WITHDRAWAL) {
      setFormError(`El retiro mínimo es ${formatMoney(MIN_WITHDRAWAL)}.`);
      return;
    }
    if (value > data.summary.available_balance) {
      setFormError("El monto supera tu saldo disponible.");
      return;
    }
    setSubmitting(true);
    try {
      await financeService.requestWithdrawal(value, destination);
      setAmount("");
      setDestination("");
      setToast("Solicitud de retiro enviada. La revisará el equipo de Serviprox.");
      setTab("withdrawals");
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No pudimos enviar la solicitud.");
    } finally {
      setSubmitting(false);
    }
  };

  const summary = data?.summary;

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
                  <small>Liquidado y listo para retirar</small>
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
                <h2 className="fin-section-title">Solicitar retiro</h2>
                <form className="fin-form" onSubmit={submitWithdrawal}>
                  <label>
                    Valor a retirar (COP)
                    <input
                      className="fin-input"
                      type="number"
                      inputMode="numeric"
                      min={MIN_WITHDRAWAL}
                      step={1000}
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder={`Mínimo ${MIN_WITHDRAWAL}`}
                      required
                    />
                  </label>
                  <label>
                    Cuenta de destino
                    <input
                      className="fin-input"
                      type="text"
                      maxLength={160}
                      value={destination}
                      onChange={(event) => setDestination(event.target.value)}
                      placeholder="Banco, tipo de cuenta y número (o Nequi)"
                      required
                    />
                  </label>
                  {formError && <p className="sp-error">{formError}</p>}
                  <IonButton
                    type="submit"
                    className="sp-primary-button"
                    disabled={submitting || summary.available_balance < MIN_WITHDRAWAL}
                  >
                    {submitting ? <IonSpinner name="crescent" /> : "Solicitar retiro"}
                  </IonButton>
                  {summary.available_balance < MIN_WITHDRAWAL && (
                    <p className="sp-muted">
                      Necesitas al menos {formatMoney(MIN_WITHDRAWAL)} de saldo disponible para retirar.
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
