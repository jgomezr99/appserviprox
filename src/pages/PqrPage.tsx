/**
 * PqrPage — Gestión y consulta oficial de PQRs y Problemas de la App.
 *
 * Sincronizado con la base de datos oficial de contratistas registrados de Bogotá.
 * Incluye los 3 reclamos iniciales (Ing. Carlos Mendoza, Rodrigo Salamanca, Jorge Morales)
 * y los 3 tickets de problemas de la app, con persistencia y sincronización API.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonMenuButton,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonToast,
} from '@ionic/react';

import { PqrListView } from '../components/pqr/PqrListView';
import { PqrReportModal } from '../components/pqr/PqrReportModal';
import { PqrDetailModal } from '../components/pqr/PqrDetailModal';
import { LiveSupportChatModal } from '../components/pqr/LiveSupportChatModal';
import '../components/pqr/pqrStyles.css';
import '../theme/tailwind.css';


import type {
  PqrReport,
  PqrContractorRef,
  AppProblemReport,
} from '../types/serviprox';

import {
  pqrService,
  appProblemService,
  professionalSearchService,
} from '../services/serviprox';

import { useAuth } from '../context/AuthContext';
import { MaintenanceNotice, useMaintenance } from '../components/MaintenanceNotice';
import { usePlatformSettings } from '../services/platformSettings';
import { IonIcon, IonButton } from '@ionic/react';
import { alertCircleOutline, arrowBackOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';

const PqrPage: React.FC = () => {
  const { user } = useAuth();
  const history = useHistory();
  const platform = usePlatformSettings();
  const pqrEnabled = platform.features.pqr;
  const { active: maintenance } = useMaintenance();
  const blockedMsg = 'La plataforma está en mantenimiento. No puedes registrar ni editar cambios por ahora.';

  if (!pqrEnabled) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonMenuButton autoHide={false} menu="main-menu" />
            </IonButtons>
            <IonTitle>PQRS & Reportes</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding sp-role-content">
          <div
            style={{
              maxWidth: "520px",
              margin: "60px auto",
              padding: "36px 24px",
              background: "#ffffff",
              borderRadius: "20px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 10px 25px -5px rgba(0,0,0,0.06)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "#fee2e2",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                fontSize: "2rem",
              }}
            >
              <IonIcon icon={alertCircleOutline} />
            </div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a", marginBottom: "10px" }}>
              Módulo de PQR y Reportes Desactivado
            </h2>
            <p style={{ color: "#64748b", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "24px" }}>
              La radicación y consulta de quejas, reclamos y reportes técnicos ha sido temporalmente desactivada por la administración de Serviprox.
            </p>
            <IonButton
              fill="solid"
              color="primary"
              onClick={() => history.push(user?.role === "professional" ? "/profesional/inicio" : "/cliente/inicio")}
              style={{ fontWeight: 700, borderRadius: "12px" }}
            >
              <IonIcon slot="start" icon={arrowBackOutline} /> Volver al Inicio
            </IonButton>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // ── Datos con precarga desde la base de datos (filtrados por cuenta) ──────
  const [pqrReports, setPqrReports] = useState<PqrReport[]>([]);
  const [appProblemReports, setAppProblemReports] = useState<AppProblemReport[]>([]);
  const [contractorRefs, setContractorRefs] = useState<PqrContractorRef[]>([]);

  // ── Estados de UI y modales ───────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const [showReportModal, setShowReportModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);

  const [selectedReport, setSelectedReport] = useState<PqrReport | null>(null);
  const [targetContractor, setTargetContractor] = useState<PqrContractorRef | undefined>(undefined);

  // ── Sincronizar datos con el servidor / API de la base de datos oficial ───
  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const email = user?.email;
      const params = email ? { email } : undefined;
      const [apiPqrs, apiProblems, apiProfessionals] = await Promise.all([
        pqrService.list(params),
        appProblemService.list(params),
        professionalSearchService.list(),
      ]);

      setPqrReports(apiPqrs);
      setAppProblemReports(apiProblems);
      setContractorRefs(apiProfessionals.map((p) => ({
          id: p.slug || String(p.id),
          name: p.display_name || `Profesional #${p.id}`,
          companyName: p.company_name || p.headline || `${p.display_name || 'Profesional'} • Servicios`,
          specialtyLabel:
            p.specialty_label ||
            (p.categories && p.categories.length > 0
              ? p.categories.join(', ')
              : p.matching_service?.service_name || 'Servicios Técnicos'),
          avatarUrl: p.avatar_url || undefined,
          neighborhood: p.neighborhood || p.city || 'Bogotá',
          phone: p.phone || undefined,
        })));
    } catch (err) {
      console.warn('[PqrPage] No fue posible cargar los datos de la API:', err);
      setPqrReports([]);
      setAppProblemReports([]);
      setContractorRefs([]);
      setLoadError('No fue posible conectar con la API y cargar los datos. Verifica la conexión e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadAll();
  }, [loadAll, user]);

  // ── Manejadores de acciones ───────────────────────────────────────────────

  const handleOpenNewPqr = (contractor?: PqrContractorRef) => {
    if (maintenance) {
      setToastMsg(blockedMsg);
      return;
    }
    if (!contractor && contractorRefs.length === 0) {
      setToastMsg('No hay profesionales disponibles desde la base de datos. Actualiza la lista e inténtalo de nuevo.');
      return;
    }
    setTargetContractor(contractor);
    setShowReportModal(true);
  };

  const handleSubmitPqr = async (
    data: PqrReport | Omit<PqrReport, 'id' | 'radicadoNumber' | 'status' | 'createdAt' | 'estimatedResponseDays'>
  ) => {
    const userFullName = user
      ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username
      : '';
    const extra = data as Partial<PqrReport>;
    const clientEmail = extra.clientEmail || user?.email || '';
    const clientName = extra.clientName || userFullName || 'Cliente';
    const clientPhone = extra.clientPhone || user?.phone || '';
    const clientDocumentId = extra.clientDocumentId || user?.document_id || '';
    const clientAddress = extra.clientAddress || user?.address || '';

    // Si ya viene creado desde PqrReportModal con su id y radicado de la base de datos
    if ('id' in data && 'radicadoNumber' in data && data.id && data.radicadoNumber) {
      const created = data as PqrReport;
      setPqrReports((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
      setToastMsg(`✅ Reclamo formal ${created.radicadoNumber} guardado en la base de datos.`);
      return;
    }

    try {
      // Guardar directamente en la base de datos oficial (Django / SQLite)
      const pqrPayload = {
        ...data,
        clientEmail,
        clientName,
        clientPhone,
        clientDocumentId,
        clientAddress,
      };
      const created = await pqrService.create(pqrPayload);
      setPqrReports((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
      setToastMsg(`✅ Reclamo formal ${created.radicadoNumber} guardado en la base de datos.`);
    } catch (err) {
      console.warn('[PqrPage] No fue posible registrar la PQR en la API:', err);
      setToastMsg('No se pudo registrar la PQR en el servidor. No se guardó localmente; verifica la conexión e inténtalo de nuevo.');
    }
  };

  const handleSendMessage = async (pqrId: string, text: string) => {
    if (maintenance) {
      setToastMsg(blockedMsg);
      return;
    }
    try {
      // Guardar mensaje directamente en la base de datos oficial
      const newMsg = await pqrService.sendMessage(pqrId, text);
      setPqrReports((prev) =>
        prev.map((r) => (r.id === pqrId ? { ...r, messages: [...(r.messages || []), newMsg] } : r))
      );
      if (selectedReport?.id === pqrId) {
        setSelectedReport((prev) =>
          prev ? { ...prev, messages: [...(prev.messages || []), newMsg] } : prev
        );
      }
      setToastMsg('✅ Respuesta registrada y enviada al expediente.');
    } catch (err) {
      console.warn('[PqrPage] No fue posible enviar la respuesta a la API:', err);
      setToastMsg('No se pudo enviar la respuesta al servidor. Verifica la conexión e inténtalo de nuevo.');
    }
  };

  const handleInspect = (report: PqrReport) => {
    setSelectedReport(report);
    setShowDetailModal(true);
  };

  const handleAppProblem = async (problem: AppProblemReport) => {
    if (maintenance) {
      setToastMsg(blockedMsg);
      return;
    }
    try {
      const userFullName = user
        ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username
        : problem.reportedBy;
      const userEmail = user?.email || problem.userEmail || '';
      const created = await appProblemService.create({
        category: problem.category,
        categoryLabel: problem.categoryLabel,
        description: problem.description,
        deviceInfo: problem.deviceInfo,
        reportedBy: userFullName || 'Usuario',
        userEmail,
      });
      setAppProblemReports((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
      setToastMsg(`✅ Reporte técnico ${created.ticketNumber} guardado en la base de datos.`);
    } catch (err) {
      console.warn('[PqrPage] No fue posible guardar el reporte técnico en la API:', err);
      setToastMsg('No se pudo guardar el reporte técnico en el servidor. No se guardó localmente; verifica la conexión e inténtalo de nuevo.');
    }
  };

  const handleRefresh = async (event: CustomEvent) => {
    await loadAll();
    (event.detail as { complete: () => void }).complete();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton autoHide={false} menu="main-menu" />
          </IonButtons>
          <IonTitle>PQRS &amp; Quejas</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Pull-to-refresh */}
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-neutral-500">
            <IonSpinner name="crescent" />
            <p className="text-sm font-medium">Consultando reclamos en la base de datos...</p>
          </div>
        ) : (
          <div className="p-4 sm:p-6 max-w-4xl mx-auto">
            <MaintenanceNotice />
            {loadError && (
              <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
                <p>{loadError}</p>
                <IonButton size="small" fill="outline" onClick={() => void loadAll()}>
                  Reintentar
                </IonButton>
              </div>
            )}
            <PqrListView
              pqrReports={pqrReports}
              appProblemReports={appProblemReports}
              onOpenNewPqrModal={handleOpenNewPqr}
              onOpenLiveSupportChat={() => (maintenance ? setToastMsg(blockedMsg) : setShowChatModal(true))}
              onInspectReport={handleInspect}
            />
          </div>
        )}
      </IonContent>

      {/* ── Modal de Radicación Formal ── */}
      <PqrReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        contractor={targetContractor}
        allContractors={contractorRefs}
        onSubmitPqr={handleSubmitPqr}
      />

      {/* ── Modal de Expediente y Respuestas ── */}
      <PqrDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        report={selectedReport}
        onSendMessage={handleSendMessage}
      />

      {/* ── Chat en Vivo con Sondeo y Validación de BD ── */}
      <LiveSupportChatModal
        isOpen={showChatModal}
        onClose={() => setShowChatModal(false)}
        contractors={contractorRefs}
        onPqrCreatedFromChat={handleSubmitPqr}
        onAppProblemReported={handleAppProblem}
      />

      {/* Notificación Toast */}
      <IonToast
        isOpen={!!toastMsg}
        message={toastMsg}
        duration={3500}
        color="dark"
        onDidDismiss={() => setToastMsg('')}
        position="top"
      />
    </IonPage>
  );
};

export default PqrPage;
