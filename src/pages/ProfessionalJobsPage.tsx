import React, { useCallback, useMemo, useState } from "react";
import { IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonMenuButton, IonPage, IonSpinner, IonTitle, IonToolbar } from "@ionic/react";
import { orderService } from "../services/serviprox";
import type { Order } from "../types/serviprox";
import { useLivePage } from "../hooks/useLivePage";
import { apiMessage, isTerminal, workLabels } from "../utils/workflow";
import "./RolePages.css";

const ProfessionalJobsPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("active");
  const [query, setQuery] = useState("");
  const load = useCallback(async () => {
    try { setOrders(await orderService.list()); setError(""); }
    catch (failure) { setError(apiMessage(failure, "No pudimos cargar tus trabajos.")); }
    finally { setLoading(false); }
  }, []);
  useLivePage(load, 15000);
  const filtered = useMemo(() => orders.filter((order) => {
    const inTab = tab === "all" || (tab === "history" ? isTerminal(order.status) : !isTerminal(order.status));
    return inTab && `${order.id} ${order.client_notes} ${order.workplace_address || ""} ${workLabels[order.status] || order.status_label}`.toLowerCase().includes(query.toLowerCase().trim());
  }), [orders, tab, query]);

  return <IonPage className="sp-service-flow">
    <IonHeader><IonToolbar><IonButtons slot="start"><IonMenuButton autoHide={false} menu="main-menu" /></IonButtons><IonTitle>Mis trabajos</IonTitle></IonToolbar></IonHeader>
    <IonContent className="sp-role-content"><main className="sp-role-page">
      <header className="sp-role-header"><span className="sp-role-kicker">PROFESIONAL</span><h1>Mis trabajos</h1><p>Retoma tus servicios activos y consulta los trabajos terminados o cancelados.</p></header>
      <div className="sp-actions"><IonButton routerLink="/profesional/solicitudes">Ver solicitudes recibidas</IonButton><IonButton fill="outline" onClick={() => void load()}>Actualizar</IonButton></div>
      <div className="sp-job-filters">
        <label>Mostrar<select value={tab} onChange={(event) => setTab(event.target.value)}><option value="active">Activos</option><option value="history">Historial</option><option value="all">Todos</option></select></label>
        <label>Buscar trabajo<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Orden, dirección o descripción" /></label>
      </div>
      {loading ? <div className="sp-card"><IonSpinner /><p>Cargando trabajos…</p></div> : error ? <section className="sp-card" role="alert"><p className="sp-error">{error}</p><IonButton onClick={() => void load()}>Reintentar</IonButton></section>
        : filtered.length ? <section className="sp-request-list">{filtered.map((order) => <article className="sp-card" key={order.id}>
          <div className="sp-card-header"><div className="sp-card-title"><h2>Trabajo #{order.id}</h2><p>{order.client_notes || "Servicio del hogar"}</p></div><IonBadge color={order.status === "completed" ? "success" : order.status === "cancelled" ? "medium" : "primary"}>{workLabels[order.status] || order.status_label}</IonBadge></div>
          <div className="sp-request-meta"><span>{order.workplace_address || "Dirección pendiente"}</span><span>{order.payment_status_label}</span>{order.scheduled_for && <span>Visita: {new Date(order.scheduled_for).toLocaleString("es-CO")}</span>}</div>
          <div className="sp-actions"><IonButton routerLink={`/seguimiento/${order.id}`}>{isTerminal(order.status) ? "Ver resumen" : "Continuar seguimiento"}</IonButton><IonButton fill="outline" routerLink={`/profesional/solicitudes/${order.service_request}`}>Ver solicitud</IonButton></div>
        </article>)}</section> : <section className="sp-card"><p>{tab === "active" ? "No tienes trabajos activos." : "No hay trabajos para este filtro."}</p></section>}
    </main></IonContent>
  </IonPage>;
};

export default ProfessionalJobsPage;
