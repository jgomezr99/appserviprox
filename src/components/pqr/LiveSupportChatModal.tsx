/**
 * LiveSupportChatModal
 *
 * Chat de soporte en vivo 24/7 con sondeo conversacional.
 * Valida que los contratistas estén registrados en la base de datos oficial de Bogotá.
 *
 * Flujos:
 *  1. QUEJA CONTRATISTA:
 *     - Validación obligatoria de contratista registrado en base de datos
 *     - Sondeo de hechos / motivo
 *     - Fecha del incidente
 *     - Monto en disputa
 *     - Solución esperada
 *     - Confirmación y generación de radicado oficial con validez legal (Ley 1480)
 *  2. PROBLEMA APP:
 *     - Sondeo por categoría técnica (mapa/GPS, pago, lentitud, etc.)
 *     - Captura de pantalla / detalles
 *     - Generación de ticket técnico
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Send,
  Bot,
  CheckCircle2,
  Paperclip,
  Building2,
  ShieldAlert,
} from 'lucide-react';
import type {
  LiveChatMessage,
  AppProblemCategory,
  PqrReport,
  AppProblemReport,
  PqrContractorRef,
} from '../../types/serviprox';
import { REGISTERED_CONTRACTORS_REF } from '../../data/pqrInitialData';
import { useAuth } from '../../context/AuthContext';
import './pqrStyles.css';


// ─── Types ────────────────────────────────────────────────────────────────────

type ChatFlow =
  | 'inicio'
  | 'queja_contratista'
  | 'queja_cual_contratista'
  | 'queja_descripcion'
  | 'queja_fecha'
  | 'queja_monto'
  | 'queja_solucion'
  | 'queja_confirmacion'
  | 'problema_app'
  | 'problema_app_categoria'
  | 'problema_app_descripcion'
  | 'problema_app_confirmacion'
  | 'fin';

interface QuejaDraft {
  contractorId?: string;
  contractorName?: string;
  contractorCompany?: string;
  contractorSpecialty?: string;
  contractorAvatar?: string;
  descripcion?: string;
  fecha?: string;
  monto?: string;
  solucion?: string;
}

interface ProblemaAppDraft {
  categoria?: AppProblemCategory;
  categoriaLabel?: string;
  descripcion?: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface LiveSupportChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractors?: PqrContractorRef[];
  onPqrCreatedFromChat: (
    report: Omit<
      PqrReport,
      'id' | 'radicadoNumber' | 'status' | 'createdAt' | 'estimatedResponseDays'
    >
  ) => void;
  onAppProblemReported?: (problem: AppProblemReport) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const agentAvatar =
  'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&auto=format&fit=crop&q=80';

function makeId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function makeTicketNum(prefix: string) {
  return `${prefix}-${new Date().getFullYear()}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;
}

function agentMsg(
  text: string,
  quickOptions?: LiveChatMessage['quickOptions'],
  ticketCreated?: LiveChatMessage['ticketCreated']
): LiveChatMessage {
  return {
    id: makeId(),
    sender: 'agent',
    agentName: 'Sofía • Defensoría y Mesa Técnica',
    agentAvatar,
    text,
    timestamp: new Date().toISOString(),
    quickOptions,
    ticketCreated,
  };
}

function userMsg(text: string): LiveChatMessage {
  return {
    id: makeId(),
    sender: 'user',
    text,
    timestamp: new Date().toISOString(),
  };
}

// ─── Mensaje inicial exacto de la interfaz ────────────────────────────────────

const INITIAL_MESSAGE: LiveChatMessage = agentMsg(
  '¡Hola! Soy Sofía de la Defensoría y Mesa Técnica de Servicio Contratista Bogotá. ¿En qué te puedo ayudar hoy? Puedes radicar quejas directamente por este chat o reportar cualquier problema técnico con la app.',
  [
    { label: '📇 Reportar problema con la app', action: 'problema_app' },
    { label: '⚖️ Queja directa contra contratista', action: 'queja_contratista' },
    { label: '💳 Falla en pago o cotización', action: 'cat:falla_pago' },
    { label: '📍 Falla en mapa o GPS Bogotá', action: 'cat:error_mapa' },
  ]
);

// ─── Componente ───────────────────────────────────────────────────────────────

export function LiveSupportChatModal({
  isOpen,
  onClose,
  contractors: propsContractors,
  onPqrCreatedFromChat,
  onAppProblemReported,
}: LiveSupportChatModalProps) {
  const { user } = useAuth();
  // Lista unificada de contratistas registrados en base de datos
  const registeredContractors =
    propsContractors && propsContractors.length > 0
      ? propsContractors
      : REGISTERED_CONTRACTORS_REF;

  const [messages, setMessages] = useState<LiveChatMessage[]>([INITIAL_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [flow, setFlow] = useState<ChatFlow>('inicio');
  const [quejaDraft, setQuejaDraft] = useState<QuejaDraft>({});
  const [problemaDraft, setProblemaAppDraft] = useState<ProblemaAppDraft>({});
  const [simulatedScreenshot, setSimulatedScreenshot] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!isOpen) return null;

  // Helper para generar opciones de contratistas registrados
  const getContractorOptions = () =>
    registeredContractors.slice(0, 8).map((c) => ({
      label: `👷 ${c.companyName} (${c.name})`,
      action: `sel_contractor:${c.id}`,
    }));

  const pushAgent = (
    text: string,
    opts?: LiveChatMessage['quickOptions'],
    ticket?: LiveChatMessage['ticketCreated'],
    delay = 600
  ) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [...prev, agentMsg(text, opts, ticket)]);
    }, delay);
  };

  const pushUser = (text: string) => {
    setMessages((prev) => [...prev, userMsg(text)]);
  };

  // Iniciar flujo de selección de contratista registrado
  const startContractorComplaint = () => {
    setFlow('queja_cual_contratista');
    pushAgent(
      'Para que tu reclamo tenga respaldo legal formal de la Defensoría de Bogotá (Ley 1480 del Consumidor), el contratista debe estar registrado en nuestra base de datos oficial.\n\nPor favor, selecciona el contratista registrado en la base de datos contra el cual deseas radicar el reclamo:',
      getContractorOptions()
    );
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Manejo de botones de acción rápida
  // ───────────────────────────────────────────────────────────────────────────
  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'queja_contratista': {
        pushUser('Deseo radicar una queja formal contra un contratista por este chat.');
        startContractorComplaint();
        break;
      }

      case 'problema_app': {
        pushUser('Reportar problema con la app');
        setFlow('problema_app_categoria');
        pushAgent(
          '¿Qué tipo de fallo técnico estás experimentando en la aplicación?',
          [
            { label: '🗺️ El mapa no carga o GPS falla', action: 'cat:error_mapa' },
            { label: '💳 Error al pagar o anticipo PSE', action: 'cat:falla_pago' },
            { label: '⚡ App lenta o congelada', action: 'cat:lentitud_carga' },
            { label: '🔐 Error al iniciar sesión', action: 'cat:error_login' },
            { label: '🔔 Fallo en notificaciones', action: 'cat:notificaciones' },
            { label: '❓ Otro problema técnico', action: 'cat:otro_tecnico' },
          ]
        );
        break;
      }

      case 'libre': {
        pushUser('Quiero escribir libremente.');
        setFlow('queja_descripcion');
        pushAgent('Por favor, cuéntame en detalle lo que necesitas. Estoy atenta 👂');
        break;
      }

      default: {
        // Selección de contratista de la base de datos
        if (action.startsWith('sel_contractor:')) {
          const id = action.replace('sel_contractor:', '');
          const found = registeredContractors.find((c) => c.id === id);
          if (found) {
            setQuejaDraft((d) => ({
              ...d,
              contractorId: found.id,
              contractorName: found.name,
              contractorCompany: found.companyName,
              contractorSpecialty: found.specialtyLabel,
              contractorAvatar: found.avatarUrl,
            }));
            pushUser(`Seleccioné a: ${found.companyName} — ${found.name}`);
            setFlow('queja_descripcion');
            pushAgent(
              `✅ Contratista verificado en la base de datos oficial:\n👷 **${found.companyName}**\nMaestro: ${found.name} • ${found.specialtyLabel || 'Servicios Generales'}\nUbicación registrada: ${found.neighborhood || 'Bogotá'}\n\n¿Qué problema o anomalía ocurrió con este contratista? Descríbeme detalladamente los hechos, fechas de obra y acuerdos incumplidos:`
            );
          }
          break;
        }

        // Selección de categoría de fallo de app
        if (action.startsWith('cat:')) {
          const cat = action.replace('cat:', '') as AppProblemCategory;
          const labels: Record<AppProblemCategory, string> = {
            error_mapa: 'Falla en Mapa / GPS Bogotá',
            falla_pago: 'Falla en Pago o Cotización',
            lentitud_carga: 'Lentitud / App Congelada',
            error_login: 'Error de Inicio de Sesión',
            notificaciones: 'Fallo en Notificaciones',
            otro_tecnico: 'Otro Problema Técnico',
          };
          setProblemaAppDraft({ categoria: cat, categoriaLabel: labels[cat] });
          pushUser(labels[cat]);
          setFlow('problema_app_descripcion');
          pushAgent(
            `Entendido. Por favor describe lo que ocurre con "${labels[cat]}": ¿en qué pantalla sucede, qué mensaje de error aparece o en qué modelo de celular estás usando la app?`
          );
          break;
        }

        if (action === 'goto_pqrs' || action === 'finish_chat') {
          onClose();
          break;
        }

        if (action === 'restart') {
          setMessages([INITIAL_MESSAGE]);
          setFlow('inicio');
          setQuejaDraft({});
          setProblemaAppDraft({});
          break;
        }

        if (action === 'confirmar_radicado') {
          finalizarQueja();
          break;
        }

        if (action === 'confirmar_ticket') {
          finalizarProblemaApp();
          break;
        }

        break;
      }
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Manejo de mensajes de texto libres del usuario
  // ───────────────────────────────────────────────────────────────────────────
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    pushUser(text);

    const lower = text.toLowerCase();

    // 1. Detectar solicitud inicial de radicar queja formal
    if (
      flow === 'inicio' &&
      (lower.includes('queja') ||
        lower.includes('reclamo') ||
        lower.includes('contratista') ||
        lower.includes('formal') ||
        lower.includes('radicar'))
    ) {
      startContractorComplaint();
      return;
    }

    switch (flow) {
      // ── Paso 1: Identificación y validación de contratista en base de datos ──
      case 'queja_cual_contratista': {
        const found = registeredContractors.find(
          (c) =>
            lower.includes(c.name.toLowerCase()) ||
            lower.includes(c.companyName.toLowerCase()) ||
            (c.specialtyLabel && lower.includes(c.specialtyLabel.toLowerCase()))
        );

        if (found) {
          setQuejaDraft((d) => ({
            ...d,
            contractorId: found.id,
            contractorName: found.name,
            contractorCompany: found.companyName,
            contractorSpecialty: found.specialtyLabel,
            contractorAvatar: found.avatarUrl,
          }));
          setFlow('queja_descripcion');
          pushAgent(
            `✅ Contratista encontrado en la base de datos oficial:\n👷 **${found.companyName}** (${found.name})\nEspecialidad: ${found.specialtyLabel || 'Construcción'}\n\nAhora describe los hechos con precisión: ¿qué trabajo realizó, qué falló y qué acuerdos se incumplieron?`
          );
        } else {
          // El contratista debe estar registrado en la base de datos
          pushAgent(
            `⚠️ No encontramos un contratista con el nombre "${text}" en la base de datos oficial de Servicio Contratista Bogotá.\n\nPara que la Defensoría pueda abrir expediente legal bajo la Ley 1480, el contratista debe estar registrado en el sistema. Por favor selecciona uno de los contratistas registrados:`,
            getContractorOptions()
          );
        }
        break;
      }

      // ── Paso 2: Descripción detallada ───────────────────────────────────────
      case 'queja_descripcion': {
        setQuejaDraft((d) => ({ ...d, descripcion: text }));
        setFlow('queja_fecha');
        pushAgent(
          '¿En qué fecha ocurrieron los hechos o cuándo identificaste la falla en la obra? (Ejemplo: "18 de septiembre de 2026" o "Ayer")'
        );
        break;
      }

      // ── Paso 3: Fecha del incidente ─────────────────────────────────────────
      case 'queja_fecha': {
        setQuejaDraft((d) => ({ ...d, fecha: text }));
        setFlow('queja_monto');
        pushAgent(
          '¿Existe algún valor de dinero en disputa, anticipo no devuelto o costo de reparación estimado? (Escribe el valor en pesos COP o escribe "No aplica")'
        );
        break;
      }

      // ── Paso 4: Monto en disputa ────────────────────────────────────────────
      case 'queja_monto': {
        const noMonto =
          lower.includes('no aplica') || lower.includes('no hay') || lower === '0' || lower === 'no';
        setQuejaDraft((d) => ({ ...d, monto: noMonto ? '' : text }));
        setFlow('queja_solucion');
        pushAgent(
          '¿Qué solución esperas del contratista y del comité de calidad? (Ejemplo: reparación inmediata sin costo, devolución total del dinero, cambio de maestro o acta de conciliación)'
        );
        break;
      }

      // ── Paso 5: Solución esperada y confirmación con resumen ─────────────────
      case 'queja_solucion': {
        setQuejaDraft((d) => ({ ...d, solucion: text }));
        const draft = { ...quejaDraft, solucion: text };

        const summary = [
          `👷 **Contratista en BD:** ${draft.contractorCompany || 'Registrado'} (${draft.contractorName || ''})`,
          `📋 **Hechos:** ${(draft.descripcion || '').slice(0, 110)}${(draft.descripcion || '').length > 110 ? '…' : ''}`,
          `📅 **Fecha Hechos:** ${draft.fecha || 'Reciente'}`,
          draft.monto ? `💰 **Monto Disputa:** ${draft.monto}` : null,
          `⚖️ **Solución Solicitada:** ${text}`,
        ]
          .filter(Boolean)
          .join('\n');

        setFlow('queja_confirmacion');
        pushAgent(
          `¡Perfecto! Hemos recopilado toda la información requerida por la Defensoría del Usuario Bogotá.\n\n${summary}\n\n¿Deseas radicar formalmente esta queja ahora?`,
          [
            { label: '✅ Sí, radicar queja formal ahora', action: 'confirmar_radicado' },
            { label: '🔄 Reiniciar reporte', action: 'restart' },
          ]
        );
        break;
      }

      // ── Confirmación de queja ───────────────────────────────────────────────
      case 'queja_confirmacion': {
        if (
          lower.includes('sí') ||
          lower.includes('si') ||
          lower.includes('confirmo') ||
          lower.includes('radicar') ||
          lower.includes('adelante')
        ) {
          finalizarQueja();
        } else {
          pushAgent('¿Deseas confirmar la radicación de la queja con los datos proporcionados?', [
            { label: '✅ Sí, radicar queja formal', action: 'confirmar_radicado' },
            { label: '❌ Cancelar', action: 'restart' },
          ]);
        }
        break;
      }

      // ── Problemas con la app ────────────────────────────────────────────────
      case 'problema_app_descripcion': {
        setProblemaAppDraft((d) => ({ ...d, descripcion: text }));
        setFlow('problema_app_confirmacion');
        pushAgent(
          `Hemos registrado el detalle técnico del fallo:\n\n📱 **Categoría:** ${problemaDraft.categoriaLabel || 'Problema con la app'}\n📝 **Detalle:** ${text.slice(0, 120)}\n\n¿Confirmas el envío de este ticket al equipo de soporte?`,
          [
            { label: '✅ Sí, enviar ticket técnico', action: 'confirmar_ticket' },
            { label: '❌ Cancelar', action: 'restart' },
          ]
        );
        break;
      }

      case 'problema_app_confirmacion': {
        if (lower.includes('sí') || lower.includes('si') || lower.includes('confirmo')) {
          finalizarProblemaApp();
        } else {
          setFlow('inicio');
          pushAgent('Reporte cancelado. ¿En qué más puedo colaborarte?', [
            { label: '⚖️ Queja contra contratista', action: 'queja_contratista' },
            { label: '📇 Reportar problema con la app', action: 'problema_app' },
          ]);
        }
        break;
      }

      // ── Fallback general inteligente ────────────────────────────────────────
      default: {
        const isApp =
          lower.includes('app') ||
          lower.includes('mapa') ||
          lower.includes('gps') ||
          lower.includes('pago') ||
          lower.includes('pantalla') ||
          lower.includes('lenta') ||
          lower.includes('error');

        if (isApp) {
          setFlow('problema_app_categoria');
          pushAgent('Detecto que reportas un problema con la aplicación. ¿Qué parte está fallando?', [
            { label: '🗺️ Mapa o GPS', action: 'cat:error_mapa' },
            { label: '💳 Pagos o PSE', action: 'cat:falla_pago' },
            { label: '⚡ Lentitud o congelamiento', action: 'cat:lentitud_carga' },
            { label: '❓ Otro técnico', action: 'cat:otro_tecnico' },
          ]);
        } else {
          startContractorComplaint();
        }
        break;
      }
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Finalizar y radicar PQR formal
  // ───────────────────────────────────────────────────────────────────────────
  const finalizarQueja = () => {
    const contractor =
      registeredContractors.find((c) => c.id === quejaDraft.contractorId) ||
      registeredContractors[0];

    const radicado = makeTicketNum('PQR-BOG');
    const amountNum = quejaDraft.monto
      ? parseFloat(quejaDraft.monto.replace(/[^0-9.]/g, ''))
      : undefined;

    onPqrCreatedFromChat({
      type: 'queja',
      reason:
        (quejaDraft.descripcion || '').toLowerCase().includes('garant')
          ? 'garantia_no_atendida'
          : 'mala_calidad_obra',
      contractorId: contractor.id,
      contractorName: contractor.name,
      contractorCompany: contractor.companyName,
      contractorSpecialty: contractor.specialtyLabel,
      contractorAvatar: contractor.avatarUrl,
      clientName: (user && `${user.first_name || ''} ${user.last_name || ''}`.trim()) || user?.username || '',
      clientPhone: user?.phone || '',
      clientEmail: user?.email || '',
      clientDocumentId: user?.document_id || '',
      clientAddress: user?.address || '',
      incidentDate: quejaDraft.fecha || new Date().toISOString().split('T')[0],
      description: quejaDraft.descripcion || 'Queja radicada vía Chat en Vivo.',
      amountDisputed: Number.isFinite(amountNum) ? amountNum : undefined,
      desiredResolution:
        quejaDraft.solucion ||
        'Revisión técnica urgente y mediación formal por la Defensoría de Bogotá.',
      evidenceFiles: simulatedScreenshot ? [simulatedScreenshot] : ['Registro_Chat_EnVivo.pdf'],
    });

    setFlow('fin');
    pushAgent(
      `✅ ¡Tu queja formal ha sido radicada con éxito!\n\n🔖 Número Oficial: **${radicado}**\n👷 Contratista Requerido: **${contractor.companyName}** (${contractor.name})\n⏱️ Plazo de descargos: **48 horas hábiles** (Ley 1480 del Consumidor)\n\nPuedes consultar el expediente y las respuestas oficiales en la sección **"PQRS & Quejas"** de la app.`,
      [
        { label: '📂 Ver mis Reclamos y Respuestas', action: 'goto_pqrs' },
        { label: '🔄 Radicar otro reclamo', action: 'restart' },
      ],
      {
        ticketNumber: radicado,
        type: 'pqr_contratista',
        summary: `${contractor.companyName}: ${(quejaDraft.descripcion || '').slice(0, 75)}`,
      }
    );
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Finalizar ticket de app
  // ───────────────────────────────────────────────────────────────────────────
  const finalizarProblemaApp = () => {
    const ticketId = makeTicketNum('APP-BUG');
    const cat = problemaDraft.categoria || 'otro_tecnico';
    const userFullName = user
      ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username
      : 'Usuario';
    const newProblem: AppProblemReport = {
      id: `prob-${Date.now()}`,
      ticketNumber: ticketId,
      category: cat,
      categoryLabel: problemaDraft.categoriaLabel || 'Problema Técnico',
      description: problemaDraft.descripcion || 'Reporte técnico vía Chat en Vivo.',
      deviceInfo: navigator.userAgent.slice(0, 80),
      reportedBy: userFullName,
      userEmail: user?.email || '',
      status: 'recibido',
      createdAt: new Date().toISOString(),
      responseNotes: 'Reporte en análisis por el equipo de desarrollo de Servicio Contratista Bogotá.',
    };

    if (onAppProblemReported) {
      onAppProblemReported(newProblem);
    }

    setFlow('fin');
    pushAgent(
      `✅ ¡Ticket técnico generado!\n\n🔖 Ticket: **${ticketId}**\n🔧 Área: **${problemaDraft.categoriaLabel}**\n\nEl equipo de soporte ha sido notificado para corregir la falla a la mayor brevedad.`,
      [
        { label: '📱 Ver mis tickets', action: 'goto_pqrs' },
        { label: '🔄 Reportar otro problema', action: 'restart' },
      ],
      {
        ticketNumber: ticketId,
        type: 'problema_app',
        summary: problemaDraft.descripcion || problemaDraft.categoriaLabel || '',
      }
    );
  };

  const handleSimulateScreenshot = () => {
    const name = 'captura_error_app_bogota.png';
    setSimulatedScreenshot(name);
    pushUser('📎 Adjunté captura de pantalla / evidencia de la obra.');
    pushAgent('Evidencia adjuntada al reporte formal. Puedes continuar con la descripción.');
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      id="live-support-chat-backdrop"
      style={{ zIndex: 9999999 }}
      className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto font-['Plus_Jakarta_Sans',sans-serif]"
    >
      <div
        id="live-support-chat-dialog"
        className="bg-white rounded-3xl shadow-2xl border border-neutral-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 my-auto h-[90vh] max-h-[720px] flex flex-col text-neutral-900"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-neutral-950 via-neutral-900 to-rose-950 text-white p-4 flex items-center justify-between border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-rose-600/30 border border-rose-500/40 flex items-center justify-center">
                <Bot className="w-5 h-5 text-rose-400" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-neutral-900 rounded-full" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-white">
                  Chat en Vivo: Quejas &amp; Soporte Bogotá
                </h3>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-full">
                  EN LÍNEA
                </span>
              </div>
              <p className="text-[11px] text-neutral-300">
                Radica quejas de contratistas o reporta problemas con la app al instante
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            aria-label="Cerrar chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Diagnostic Bar */}
        <div className="bg-neutral-100 px-4 py-2 border-b border-neutral-200 flex items-center justify-between text-[11px] text-neutral-600">
          <span>
            📱 Diagnóstico automático: <strong>Bogotá D.C. • App v2.4 Activa</strong>
          </span>
          <span className="text-[10px] text-neutral-500 font-mono">Conexión Segura SSL</span>
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-neutral-50/50">
          {messages.map((msg) => {
            const isAgent = msg.sender === 'agent';
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 max-w-[92%] ${
                  isAgent ? 'mr-auto' : 'ml-auto flex-row-reverse'
                }`}
              >
                {isAgent && (
                  <img
                    src={msg.agentAvatar || agentAvatar}
                    alt="Sofía"
                    className="w-8 h-8 rounded-xl object-cover border border-neutral-300 flex-shrink-0 mt-0.5"
                  />
                )}

                <div className="space-y-1.5 max-w-full">
                  <div
                    className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs whitespace-pre-line ${
                      isAgent
                        ? 'bg-white border border-neutral-200 text-neutral-900 rounded-tl-sm'
                        : 'bg-rose-600 text-white rounded-tr-sm'
                    }`}
                  >
                    {isAgent && (
                      <div className="text-[10px] font-black text-rose-600 mb-1">
                        {msg.agentName}
                      </div>
                    )}
                    <p>{msg.text}</p>

                    {/* Ticket Creado */}
                    {msg.ticketCreated && (
                      <div className="mt-2.5 p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-950 space-y-1">
                        <div className="flex items-center gap-1.5 font-black text-emerald-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>
                            {msg.ticketCreated.type === 'problema_app'
                              ? 'Ticket Técnico Registrado'
                              : 'Radicado PQR Formal Generado'}
                          </span>
                        </div>
                        <div className="font-mono font-bold text-xs bg-emerald-100/70 px-2 py-0.5 rounded text-emerald-900 inline-block">
                          {msg.ticketCreated.ticketNumber}
                        </div>
                        <p className="text-[11px] text-emerald-800">
                          {msg.ticketCreated.summary}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Opciones rápidas interactivas */}
                  {isAgent && msg.quickOptions && msg.quickOptions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {msg.quickOptions.map((opt, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleQuickAction(opt.action)}
                          className="bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 font-bold text-[11px] px-3 py-1.5 rounded-xl shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <span
                    className={`block text-[9px] text-neutral-400 ${
                      isAgent ? 'text-left' : 'text-right'
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="flex items-center gap-2 text-xs text-neutral-500 italic bg-white border border-neutral-200 p-2.5 rounded-2xl w-fit">
              <Bot className="w-4 h-4 text-rose-500 animate-spin" />
              <span>Sofía está escribiendo...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-white border-t border-neutral-200">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSimulateScreenshot}
              title="Adjuntar evidencia o captura"
              className="p-2.5 text-neutral-500 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer flex-shrink-0"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                flow === 'queja_cual_contratista'
                  ? 'Escribe el nombre del contratista registrado (ej: Carlos Mendoza)...'
                  : flow === 'queja_descripcion'
                  ? 'Describe lo que ocurrió con el contratista...'
                  : flow === 'queja_fecha'
                  ? 'Fecha de los hechos (ej: 18 de septiembre)...'
                  : flow === 'queja_monto'
                  ? 'Monto en disputa (ej: 180000 o "No aplica")...'
                  : flow === 'queja_solucion'
                  ? 'Solución esperada (ej: reparación, cambio de maestro)...'
                  : 'Escribe tu queja o problema con la app aquí...'
              }
              className="flex-1 px-3.5 py-2.5 text-xs sm:text-sm bg-neutral-50 border border-neutral-300 rounded-xl text-neutral-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />

            <button
              type="submit"
              disabled={!inputText.trim()}
              className="bg-rose-500 hover:bg-rose-600 disabled:opacity-40 active:scale-95 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer flex-shrink-0"
            >
              <Send className="w-4 h-4" />
              <span>Enviar</span>
            </button>
          </form>

          {simulatedScreenshot && (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 w-fit">
              <span>📎 Adjunto: {simulatedScreenshot}</span>
              <button
                type="button"
                onClick={() => setSimulatedScreenshot(null)}
                className="text-neutral-500 hover:text-rose-600 ml-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
}


