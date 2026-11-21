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
import { SupportChatDetailModal } from '../components/pqr/SupportChatDetailModal';
import '../components/pqr/pqrStyles.css';
import '../theme/tailwind.css';


import type {
  PqrReport,
  PqrContractorRef,
  PqrProductRef,
  PqrSubjectType,
  AppProblemReport,
  ChatTranscriptEntry,
  SupportChat,
} from '../types/serviprox';

import {
  pqrService,
  appProblemService,
  professionalSearchService,
  supportChatService,
} from '../services/serviprox';
import { storeService } from '../services/storeService';

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

  // ── Datos con precarga desde la base de datos (filtrados por cuenta) ──────
  const [pqrReports, setPqrReports] = useState<PqrReport[]>([]);
  const [appProblemReports, setAppProblemReports] = useState<AppProblemReport[]>([]);
  const [supportChats, setSupportChats] = useState<SupportChat[]>([]);
  const [contractorRefs, setContractorRefs] = useState<PqrContractorRef[]>([]);
  const [productRefs, setProductRefs] = useState<PqrProductRef[]>([]);

  // ── Estados de UI y modales ───────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const [showReportModal, setShowReportModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatInitialFlow, setChatInitialFlow] = useState<'inicio' | 'chat_directo'>('inicio');
  const [showSupportChatModal, setShowSupportChatModal] = useState(false);

  const [selectedReport, setSelectedReport] = useState<PqrReport | null>(null);
  const [selectedSupportChat, setSelectedSupportChat] = useState<SupportChat | null>(null);
  const [targetContractor, setTargetContractor] = useState<PqrContractorRef | undefined>(undefined);
  const [targetSubjectType, setTargetSubjectType] = useState<PqrSubjectType>('servicio');

  // ── Sincronizar datos con el servidor / API de la base de datos oficial ───
  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const email = user?.email;
      const params = email ? { email } : undefined;
      const [apiPqrs, apiProblems, apiProfessionals, storeRes, apiChats] = await Promise.all([
        pqrService.list(params),
        appProblemService.list(params),
        professionalSearchService.list(),
        storeService.listProducts().catch(() => ({ products: [], fromServer: false })),
        supportChatService.list().catch(() => []),
      ]);

      setPqrReports(apiPqrs);
      setAppProblemReports(apiProblems);
      setSupportChats(apiChats);
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
      setProductRefs(
        (storeRes.products || []).map((prod) => ({
          id: prod.id,
          title: prod.title,
          sellerName: prod.sellerName || 'Vendedor Meko Shop',
          category: prod.category,
          price: prod.price,
          city: prod.city,
          imageUrl: prod.image,
        }))
      );
    } catch (err) {
      console.warn('[PqrPage] No fue posible cargar los datos de la API:', err);
      setPqrReports([]);
      setAppProblemReports([]);
      setSupportChats([]);
      setContractorRefs([]);
      setProductRefs([]);
      setLoadError('No fue posible conectar con la API y cargar los datos. Verifica la conexión e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!pqrEnabled) return;
    void loadAll();
  }, [loadAll, pqrEnabled, user]);

  useEffect(() => {
    if (!pqrEnabled) return;
    const handleSync = () => {
      void loadAll();
    };
    window.addEventListener('serviprox:pqr-updated', handleSync);
    return () => {
      window.removeEventListener('serviprox:pqr-updated', handleSync);
    };
  }, [loadAll, pqrEnabled]);

  const refreshSupportChats = useCallback(async () => {
    try {
      const updated = await supportChatService.list();
      setSupportChats(updated);
    } catch {
      // non-fatal
    }
  }, []);

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

  // ── Manejadores de acciones ───────────────────────────────────────────────

  const handleOpenNewPqr = (contractor?: PqrContractorRef, subjectType: PqrSubjectType = 'servicio') => {
    if (maintenance) {
      setToastMsg(blockedMsg);
      return;
    }
    if (subjectType === 'servicio' && !contractor && contractorRefs.length === 0 && productRefs.length === 0) {
      setToastMsg('No hay profesionales ni productos disponibles desde la base de datos. Actualiza la lista e inténtalo de nuevo.');
      return;
    }
    setTargetContractor(contractor);
    setTargetSubjectType(subjectType);
    setShowReportModal(true);
  };

  const handleSubmitPqr = async (
    data:
      | PqrReport
      | (Omit<PqrReport, 'id' | 'radicadoNumber' | 'status' | 'createdAt' | 'estimatedResponseDays'> & {
          chatTranscript?: ChatTranscriptEntry[];
        })
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
      void refreshSupportChats();
      setToastMsg(`✅ Reclamo formal ${created.radicadoNumber} y su chat guardados en la base de datos.`);
      return created;
    }

    try {
      // Guardar directamente en la base de datos oficial
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
      void refreshSupportChats();
      setToastMsg(`✅ Reclamo formal ${created.radicadoNumber} y su chat guardados en la base de datos.`);
      return created;
    } catch (err) {
      console.warn('[PqrPage] No fue posible registrar la PQR en la API:', err);
      setToastMsg('No se pudo registrar la PQR en el servidor. No se guardó localmente; verifica la conexión e inténtalo de nuevo.');
      return undefined;
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

  const handleInspectSupportChat = async (chat: SupportChat) => {
    setSelectedSupportChat(chat);
    setShowSupportChatModal(true);
    try {
      const fresh = await supportChatService.get(chat.id);
      setSelectedSupportChat(fresh);
      setSupportChats((prev) => prev.map((c) => (c.id === fresh.id ? fresh : c)));
    } catch {
      // keep existing chat state
    }
  };

  const handleSendSupportChatMessage = async (chatId: number, text: string) => {
    if (maintenance) {
      setToastMsg(blockedMsg);
      return;
    }
    try {
      const newMsg = await supportChatService.sendMessage(chatId, text);
      setSupportChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? {
                ...c,
                updatedAt: newMsg.createdAt,
                lastMessage: newMsg.text,
                messagesCount: (c.messagesCount || c.messages?.length || 0) + 1,
                messages: [...(c.messages || []), newMsg],
              }
            : c
        )
      );
      setSelectedSupportChat((prev) =>
        prev && prev.id === chatId
          ? {
              ...prev,
              updatedAt: newMsg.createdAt,
              lastMessage: newMsg.text,
              messagesCount: (prev.messagesCount || prev.messages?.length || 0) + 1,
              messages: [...(prev.messages || []), newMsg],
            }
          : prev
      );
    } catch (err) {
      console.warn('[PqrPage] No fue posible enviar mensaje al chat:', err);
      setToastMsg('No se pudo enviar el mensaje. Inténtalo nuevamente.');
    }
  };

  const handleAppProblem = async (
    problem: AppProblemReport & { chatTranscript?: ChatTranscriptEntry[] }
  ) => {
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
        chatTranscript: problem.chatTranscript,
      });
      setAppProblemReports((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
      // Refrescar también el listado oficial de PQRs y Mis Chats para mostrar de inmediato el PQR-APP radicado
      const params = user?.email ? { email: user.email } : undefined;
      void pqrService.list(params).then((updatedPqrs) => setPqrReports(updatedPqrs)).catch(() => {});
      void refreshSupportChats();
      const radicadoLabel = created.radicadoNumber
        ? `PQR ${created.radicadoNumber} (Ticket ${created.ticketNumber})`
        : `Reporte técnico ${created.ticketNumber}`;
      setToastMsg(`✅ ${radicadoLabel} y su chat guardados en la base de datos.`);
      return created;
    } catch (err) {
      console.warn('[PqrPage] No fue posible guardar el reporte técnico en la API:', err);
      setToastMsg('No se pudo guardar el reporte técnico en el servidor. No se guardó localmente; verifica la conexión e inténtalo de nuevo.');
      return undefined;
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
              supportChats={supportChats}
              onOpenNewPqrModal={handleOpenNewPqr}
              onOpenLiveSupportChat={() => {
                if (maintenance) {
                  setToastMsg(blockedMsg);
                  return;
                }
                setChatInitialFlow('inicio');
                setShowChatModal(true);
              }}
              onOpenCreateChat={() => {
                if (maintenance) {
                  setToastMsg(blockedMsg);
                  return;
                }
                setChatInitialFlow('chat_directo');
                setShowChatModal(true);
              }}
              onInspectReport={handleInspect}
              onInspectChat={handleInspectSupportChat}
            />
          </div>
        )}
      </IonContent>

      {/* ── Modal de Radicación Formal (Servicios y Productos Separados) ── */}
      <PqrReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        contractor={targetContractor}
        allContractors={contractorRefs}
        allProducts={productRefs}
        initialSubjectType={targetSubjectType}
        onSubmitPqr={handleSubmitPqr}
        onOpenReportChat={handleInspect}
      />

      {/* ── Modal de Expediente y Respuestas ── */}
      <PqrDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        report={selectedReport}
        onSendMessage={handleSendMessage}
      />

      {/* ── Modal de Chat Guardado (Soporte / Reporte) ── */}
      <SupportChatDetailModal
        isOpen={showSupportChatModal}
        onClose={() => setShowSupportChatModal(false)}
        chat={selectedSupportChat}
        onSendMessage={handleSendSupportChatMessage}
      />

      {/* ── Chat en Vivo con Sondeo y Validación de BD ── */}
      <LiveSupportChatModal
        isOpen={showChatModal}
        onClose={() => setShowChatModal(false)}
        contractors={contractorRefs}
        products={productRefs}
        initialFlow={chatInitialFlow}
        onPqrCreatedFromChat={handleSubmitPqr}
        onAppProblemReported={handleAppProblem}
        onChatSaved={(chat) => {
          setSupportChats((prev) => [chat, ...prev.filter((c) => c.id !== chat.id)]);
          setToastMsg(`✅ Chat "${chat.title}" guardado en Mis Chats.`);
        }}
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
