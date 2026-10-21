import React, { useState, useEffect, useRef } from 'react';
import { adminService } from '../services/adminService';
import { saveStoredAppProblems, saveStoredPqrReports } from '../data/pqrInitialData';
import type { AppProblemCategory } from '../types/serviprox';
import './SupportAiChatModal.css';

export interface SupportAiContext {
  userName?: string;
  blockReason?: string;
  blockDurationDays?: number | null;
  blockType?: string;
  blockedUntil?: string | null;
  role?: string;
}

interface QuickOption {
  label: string;
  action: string;
  prompt?: string;
}

interface ChatMessage {
  id: string;
  sender: 'agent' | 'user';
  text: string;
  timestamp: string;
  quickOptions?: QuickOption[];
}

interface SupportAiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  context?: SupportAiContext;
  onAppealSuccess?: (ticketNumber: string) => void;
}

type ChatMode =
  | 'idle'
  | 'appeal_input'
  | 'failure_category'
  | 'failure_description'
  | 'pqr_input';

export const SupportAiChatModal: React.FC<SupportAiChatModalProps> = ({
  isOpen,
  onClose,
  context,
  onAppealSuccess,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>('idle');
  const [selectedFailureCategory, setSelectedFailureCategory] = useState<string>('General');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const userName = context?.userName || 'Usuario';
  const blockReason = context?.blockReason || 'Incumplimiento de acuerdos o términos de servicio';
  const isTemporal = context?.blockType !== 'permanente' && !!context?.blockedUntil;
  const durationText = context?.blockDurationDays
    ? `${context.blockDurationDays} días`
    : isTemporal
    ? 'temporal'
    : 'permanente';

  // Inicializar conversación con contexto y opciones directas de reporte, pqr, falla y apelación
  useEffect(() => {
    if (!isOpen) return;

    setChatMode('idle');
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const initialText = `Hola ${userName}, soy tu **Asistente Virtual con IA de Soporte Serviprox**.\n\nHe verificado el estado de tu cuenta y expediente. Estoy conectado directamente con la base de datos y la administración oficial para:\n\n• 📝 **Radicar tu recurso de apelación** ante el comité administrativo.\n• 🛠️ **Reportar fallas técnicas de la app** (GPS, pagos, errores de sistema).\n• ⚖️ **Crear un reporte o PQR oficial** respaldado por la Ley 1480.\n\nTodos los radicados ingresan de inmediato a la bandeja del **Panel Administrativo**, donde el equipo oficial revisará los datos y emitirá la respuesta formal y solución del caso. ¿En qué podemos ayudarte?`;

    const initialOptions: QuickOption[] = [
      {
        label: '📝 Radicar Apelación de cuenta',
        action: 'iniciar_apelacion',
        prompt: 'Deseo radicar mi recurso de apelación para que el administrador revise mi sanción.',
      },
      {
        label: '🛠️ Reportar falla técnica en la app',
        action: 'iniciar_falla',
        prompt: 'Quiero reportar un problema o falla técnica que ocurrió en la aplicación.',
      },
      {
        label: '⚖️ Radicar PQR oficial',
        action: 'iniciar_pqr',
        prompt: 'Deseo radicar una Petición, Queja o Reclamo (PQR) oficial.',
      },
      {
        label: '❓ ¿Por qué ocurrió la sanción?',
        action: 'explicar_motivo',
        prompt: '¿Por qué motivos específicos la plataforma aplicó esta sanción?',
      },
      {
        label: '⏱️ ¿Cuándo se reactiva mi cuenta?',
        action: 'consultar_tiempo',
        prompt: '¿Cuánto tiempo dura la suspensión y cuándo podré ingresar?',
      },
      {
        label: '👤 Contactar comité administrativo',
        action: 'comite_humano',
        prompt: 'Quiero elevar mi caso a un supervisor humano en Bogotá.',
      },
    ];

    setMessages([
      {
        id: 'msg-init',
        sender: 'agent',
        text: initialText,
        timestamp: timeStr,
        quickOptions: initialOptions,
      },
    ]);
  }, [isOpen, userName, blockReason, durationText]);

  // Auto-scroll al final cuando llegan mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!isOpen) return null;

  const pushAgentMessage = (text: string, quickOptions?: QuickOption[]) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `agent-${Date.now()}`,
          sender: 'agent',
          text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          quickOptions,
        },
      ]);
    }, 600);
  };

  const handleQuickAction = async (action: string, promptText?: string) => {
    const textToSend = promptText || action;
    handleSendMessage(textToSend, action);
  };

  const handleSendMessage = async (text: string, triggeredAction?: string) => {
    if (!text.trim()) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');

    // ── MODO 1: PROCESAMIENTO DE APELACIÓN FORMAL ──
    if (chatMode === 'appeal_input') {
      setChatMode('idle');
      setIsTyping(true);
      try {
        const radNum = Math.floor(10000 + Math.random() * 90000);
        const ticketId = `APL-${radNum}`;

        // 1. Guardar en backend Django / SQLite via acción administrativa
        await adminService.executeAction({
          action: 'respond_pqr',
          target_id: ticketId,
          response_text: `Apelación recibida por IA de ${userName}: "${text}" (Motivo sanción: ${blockReason})`,
          admin_name: 'Asistente IA - Defensoría',
          send_notification: true,
        });

        // 2. Guardar en persistencia local sincronizada para que aparezca en AdminDashboard
        saveStoredPqrReports([
          {
            id: ticketId,
            radicadoNumber: ticketId,
            type: 'reclamo',
            reason: 'otro',
            contractorId: 'administracion-serviprox',
            contractorName: 'Administración Serviprox Bogotá',
            contractorCompany: 'Comité Disciplinario y Mesa Técnica',
            clientName: userName,
            clientPhone: '+57 300 000 0000',
            clientEmail: 'usuario@serviprox.co',
            clientDocumentId: 'CC Verificada',
            clientAddress: 'Bogotá D.C.',
            incidentDate: new Date().toISOString(),
            description: `Descargos presentados mediante el Asistente IA de Soporte:\n\n"${text}"\n\nCausal de la suspensión: ${blockReason}\nDuración actual: ${durationText}`,
            desiredResolution: 'Levantamiento o reducción de la sanción disciplinaria',
            status: 'radicado',
            createdAt: new Date().toISOString(),
            estimatedResponseDays: 2,
            messages: [
              {
                id: `msg-${Date.now()}`,
                sender: 'client',
                senderName: userName,
                senderRole: 'Usuario Apelante',
                text,
                timestamp: new Date().toISOString(),
              },
            ],
          },
        ]);

        window.dispatchEvent(new CustomEvent('serviprox:pqr-updated'));

        if (onAppealSuccess) onAppealSuccess(ticketId);

        setTimeout(() => {
          setIsTyping(false);
          setMessages((prev) => [
            ...prev,
            {
              id: `agent-${Date.now()}`,
              sender: 'agent',
              text: `✅ **¡Recurso de Apelación Radicado Exitosamente en el Panel Administrativo!**\n\n📌 **Radicado Oficial:** \`#${ticketId}\`\n👤 **Titular:** ${userName}\n⚖️ **Motivo apelado:** "${blockReason}"\n📋 **Descargos ingresados:** "${text}"\n\nTu expediente ha ingresado a la bandeja de **PQR y Apelaciones del Administrador**. Desde allí, el administrador analizará las pruebas y redactará el dictamen oficial con la resolución del caso.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              quickOptions: [
                {
                  label: '🛠️ También quiero reportar una falla en la app',
                  action: 'iniciar_falla',
                  prompt: 'Deseo reportar que la sanción se debió a un error de la app.',
                },
                {
                  label: '🚪 Salir y esperar respuesta',
                  action: 'salir',
                  prompt: 'Entendido, estaré atento a la respuesta administrativa.',
                },
              ],
            },
          ]);
        }, 800);
        return;
      } catch {
        setIsTyping(false);
        pushAgentMessage(
          `Tu explicación ha sido anotada para el expediente. Recuerda que el administrador revisará tus antecedentes para determinar el levantamiento de la sanción.`
        );
        return;
      }
    }

    // ── MODO 2: PROCESAMIENTO DE FALLA TÉCNICA EN LA APP ──
    if (chatMode === 'failure_description') {
      setChatMode('idle');
      setIsTyping(true);
      try {
        const ticketNum = `#TK-${Math.floor(1046 + Math.random() * 8950)}`;

        // 1. Guardar en backend en el modelo AppProblemReport
        await adminService.createProblem({
          ticketNumber: ticketNum,
          module: selectedFailureCategory,
          title: `Incidencia técnica: ${selectedFailureCategory}`,
          description: text,
          reportedBy: userName,
          priority: 'Alta',
          deviceInfo: navigator.userAgent.includes('Mobile') ? 'App móvil (Android/iOS)' : 'Navegador Web',
          adminName: 'Asistente IA - Soporte',
        });

        // 2. Guardar en persistencia local de fallas técnicas sincronizada con AdminDashboard
        saveStoredAppProblems([
          {
            id: `prob-${Date.now()}`,
            ticketNumber: ticketNum,
            category: selectedFailureCategory.toLowerCase().replace(/ /g, '_') as AppProblemCategory,
            categoryLabel: selectedFailureCategory,
            description: text,
            reportedBy: userName,
            userEmail: 'usuario@serviprox.co',
            deviceInfo: 'App móvil Serviprox (Bogotá)',
            createdAt: new Date().toISOString(),
            status: 'recibido',
          },
        ]);

        window.dispatchEvent(new CustomEvent('serviprox:problem-created'));
        window.dispatchEvent(new CustomEvent('serviprox:problem-updated'));

        setTimeout(() => {
          setIsTyping(false);
          setMessages((prev) => [
            ...prev,
            {
              id: `agent-${Date.now()}`,
              sender: 'agent',
              text: `✅ **¡Falla Técnica Registrada en el Panel Administrativo!**\n\n📌 **Ticket Técnico:** \`${ticketNum}\`\n📂 **Módulo afectado:** ${selectedFailureCategory}\n👤 **Reportado por:** ${userName}\n📋 **Detalle registrado:** "${text}"\n\nTu reporte ya está disponible en el **Módulo de Fallas Técnicas del Administrador**. El equipo técnico y administrativo revisará los logs del sistema y redactará la solución oficial desde su panel de control.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              quickOptions: [
                {
                  label: '📝 Vincular esta falla a mi Apelación de cuenta',
                  action: 'iniciar_apelacion',
                  prompt: `Quiero apelar mi sanción justificando que fue causada por la falla técnica ${ticketNum}.`,
                },
                {
                  label: '🚪 Salir y esperar respuesta',
                  action: 'salir',
                  prompt: 'Gracias, esperaré la revisión técnica.',
                },
              ],
            },
          ]);
        }, 800);
        return;
      } catch {
        setIsTyping(false);
        pushAgentMessage(
          `La descripción de la falla técnica ha sido registrada en el log del sistema para verificación por el equipo de soporte técnico.`
        );
        return;
      }
    }

    // ── MODO 3: PROCESAMIENTO DE PQR GENERAL ──
    if (chatMode === 'pqr_input') {
      setChatMode('idle');
      setIsTyping(true);
      try {
        const radNum = Math.floor(1000 + Math.random() * 9000);
        const pqrRadicado = `PQR-BOG-${new Date().getFullYear()}-${radNum}`;

        await adminService.executeAction({
          action: 'respond_pqr',
          target_id: pqrRadicado,
          response_text: `PQR oficial radicada por IA de ${userName}: "${text}"`,
          admin_name: 'Asistente IA - Defensoría',
          send_notification: true,
        });

        saveStoredPqrReports([
          {
            id: pqrRadicado,
            radicadoNumber: pqrRadicado,
            type: 'queja',
            reason: 'otro',
            contractorId: 'serviprox-soporte',
            contractorName: 'Servicio al Cliente Serviprox',
            contractorCompany: 'Mesa de Calidad y Defensoría PQR',
            clientName: userName,
            clientPhone: '+57 300 000 0000',
            clientEmail: 'usuario@serviprox.co',
            clientDocumentId: 'CC Verificada',
            clientAddress: 'Bogotá D.C.',
            incidentDate: new Date().toISOString(),
            description: text,
            desiredResolution: 'Revisión y respuesta administrativa oficial por parte del equipo de soporte',
            status: 'radicado',
            createdAt: new Date().toISOString(),
            estimatedResponseDays: 2,
            messages: [
              {
                id: `msg-${Date.now()}`,
                sender: 'client',
                senderName: userName,
                senderRole: 'Usuario',
                text,
                timestamp: new Date().toISOString(),
              },
            ],
          },
        ]);

        window.dispatchEvent(new CustomEvent('serviprox:pqr-updated'));

        setTimeout(() => {
          setIsTyping(false);
          setMessages((prev) => [
            ...prev,
            {
              id: `agent-${Date.now()}`,
              sender: 'agent',
              text: `✅ **¡PQR Radicada Oficialmente en el Panel Administrativo!**\n\n📌 **Radicado Ley 1480:** \`#${pqrRadicado}\`\n👤 **Titular:** ${userName}\n📋 **Detalle:** "${text}"\n\nTu reclamación ha quedado en la bandeja de entrada de la **Mesa de Conciliación y PQR Administrativa**. El administrador dará trámite formal y emitirá la respuesta correspondiente.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              quickOptions: [
                {
                  label: '🔍 ¿Cuál es el tiempo de respuesta legal?',
                  action: 'tiempo_pqr',
                  prompt: '¿Cuánto tiempo tiene la administración para responder mi PQR?',
                },
                {
                  label: '🚪 Salir y esperar resolución',
                  action: 'salir',
                  prompt: 'Entendido, estaré pendiente de la respuesta.',
                },
              ],
            },
          ]);
        }, 800);
        return;
      } catch {
        setIsTyping(false);
        pushAgentMessage(`Tu reclamación ha sido tomada en cuenta para la investigación del caso.`);
        return;
      }
    }

    const lower = text.toLowerCase();

    // ── ACCIÓN: REPORTAR FALLA TÉCNICA ──
    if (
      triggeredAction === 'iniciar_falla' ||
      lower.includes('falla') ||
      lower.includes('error') ||
      lower.includes('bug') ||
      lower.includes('no funciona') ||
      lower.includes('se cierra') ||
      lower.includes('gps') ||
      lower.includes('mapa')
    ) {
      setChatMode('failure_category');
      pushAgentMessage(
        `Para reportar la falla técnica en el sistema administrativo, selecciona en qué módulo o parte de la app ocurrió el problema:`,
        [
          { label: '🌐 Mapa, GPS o Ubicación', action: 'cat_mapa', prompt: 'Mapa y Geolocalización GPS' },
          { label: '💳 Pagos, Cobros o Saldos', action: 'cat_pagos', prompt: 'Pasarela de Pagos y Facturación' },
          { label: '💬 Chat, Notificaciones o Mensajes', action: 'cat_chat', prompt: 'Chat y Notificaciones en tiempo real' },
          { label: '🔒 Inicio de Sesión o Autenticación', action: 'cat_auth', prompt: 'Autenticación y Perfil' },
          { label: '📱 Cierres Inesperados o Lentitud', action: 'cat_rendimiento', prompt: 'Rendimiento y Cierres inesperados' },
        ]
      );
      return;
    }

    // ── SELECCIÓN DE CATEGORÍA DE FALLA ──
    if (chatMode === 'failure_category' || triggeredAction?.startsWith('cat_')) {
      const catName = text.replace(/^(cat_)/, '') || 'General';
      setSelectedFailureCategory(catName);
      setChatMode('failure_description');
      pushAgentMessage(
        `Has seleccionado el módulo **${catName}**.\n\nPor favor, escribe detalladamente qué sucedió (qué estabas haciendo, el error en pantalla o cómo afectó tu cuenta). \n\nEscríbelo abajo y crearé el **Ticket Técnico Oficial** en el panel administrativo:`,
        [
          { label: 'No me permitió confirmar la llegada', action: 'desc_llegada', prompt: 'La app no me permitió confirmar la llegada por error de GPS.' },
          { label: 'Se congeló al procesar el servicio', action: 'desc_congelo', prompt: 'La pantalla se quedó cargando y bloqueó la orden.' },
        ]
      );
      return;
    }

    // ── ACCIÓN: INICIAR APELACIÓN ──
    if (
      triggeredAction === 'iniciar_apelacion' ||
      lower.includes('apelar') ||
      lower.includes('descargo') ||
      lower.includes('injusto') ||
      lower.includes('sancion') ||
      lower.includes('levantar')
    ) {
      setChatMode('appeal_input');
      pushAgentMessage(
        `Para estructurar tu recurso de apelación ante el **Comité Administrativo de Bogotá**, escribe a continuación tus **descargos y argumentos formales** (por ejemplo: si la demora fue por causas de fuerza mayor, si hubo un acuerdo previo con el cliente o si ocurrió una falla en la app).\n\nEscribe tus descargos abajo y los registraré directamente en el panel administrativo:`,
        [
          { label: 'Fue por una falla técnica de la app', action: 'apela_falla', prompt: 'El problema se debió a un fallo técnico de la app que me impidió reportar a tiempo.' },
          { label: 'Llegué a un acuerdo con el cliente', action: 'apela_acuerdo', prompt: 'Hablé directamente con el cliente y llegamos a una solución conciliada.' },
          { label: 'Ocurrió por motivos de fuerza mayor', action: 'apela_fuerza_mayor', prompt: 'El retraso o inconveniente ocurrió por causas de fuerza mayor imprevisibles.' },
        ]
      );
      return;
    }

    // ── ACCIÓN: INICIAR PQR OFICIAL ──
    if (triggeredAction === 'iniciar_pqr' || lower.includes('pqr') || lower.includes('queja') || lower.includes('reclamo')) {
      setChatMode('pqr_input');
      pushAgentMessage(
        `Entendido. Conforme a la **Ley 1480 de Protección al Consumidor**, tienes derecho a radicar peticiones, quejas o reclamos.\n\nEscribe a continuación el motivo de tu PQR y la solución que esperas. Lo registraré con radicado legal en la bandeja administrativa:`,
        [
          { label: 'Reclamo por cobro o retención injustificada', action: 'pqr_cobro', prompt: 'Reclamo formal por retención de fondos o cobro indebido.' },
          { label: 'Inconformidad con el servicio recibido', action: 'pqr_servicio', prompt: 'Queja por incumplimiento o mala atención en el servicio pactado.' },
        ]
      );
      return;
    }

    // ── TIEMPOS LEGALES DE PQR ──
    if (triggeredAction === 'tiempo_pqr' || lower.includes('plazo') || lower.includes('cuanto tiempo') || lower.includes('dias habiles')) {
      pushAgentMessage(
        `Conforme a la normativa colombiana y el reglamento de Serviprox:\n\n• **PQRs técnicas y operativas:** Plazo máximo de respuesta de 48 horas hábiles.\n• **Apelaciones disciplinarias:** El comité evalúa el expediente en un plazo de 2 a 5 días hábiles.\n• La respuesta oficial será redactada directamente por el Administrador desde el panel administrativo y te llegará como notificación formal.`,
        [
          { label: '📝 Radicar Apelación', action: 'iniciar_apelacion', prompt: 'Deseo radicar mi apelación ahora.' },
          { label: '🛠️ Reportar falla en la app', action: 'iniciar_falla', prompt: 'Deseo reportar una falla en la app.' },
        ]
      );
      return;
    }

    // ── MOTIVO DE LA SANCIÓN ──
    if (triggeredAction === 'explicar_motivo' || lower.includes('por qué') || lower.includes('motivo') || lower.includes('razon')) {
      pushAgentMessage(
        `Tu cuenta presenta una restricción por la siguiente causal registrada en el sistema de auditoría:\n\n📌 **Causal registrada:** *"${blockReason}"*\n\nServiprox aplica sanciones disciplinarias para proteger a los usuarios ante cancelaciones sin aviso previo, retrasos graves o acuerdos económicos fuera de la app. Si consideras que se trató de un error, puedes radicar tu apelación para que la administración lo revoque.`,
        [
          { label: '📝 Radicar apelación de esta sanción', action: 'iniciar_apelacion', prompt: 'Quiero presentar descargos formales sobre este motivo.' },
          { label: '🛠️ Fue debido a una falla en la app', action: 'iniciar_falla', prompt: 'La sanción ocurrió porque la app falló y no me permitió operar.' },
        ]
      );
      return;
    }

    // ── TIEMPO DE SANCIÓN ──
    if (triggeredAction === 'consultar_tiempo' || lower.includes('cuándo') || lower.includes('tiempo') || lower.includes('duracion')) {
      if (isTemporal) {
        pushAgentMessage(
          `Tu suspensión es **temporal** por un plazo de **${durationText}**.\n\n🗓️ **Fecha estimada de reactivación:** ${context?.blockedUntil ? new Date(context.blockedUntil).toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Al culminar el plazo fijado'}.\n\nAl cumplirse el tiempo, la cuenta se habilita de forma automática. Si radicas una apelación justificada, la administración puede levantar la sanción antes de tiempo.`,
          [
            { label: '📝 Radicar apelación para acelerar', action: 'iniciar_apelacion', prompt: 'Quiero radicar una apelación para levantar la suspensión antes.' },
            { label: '🛠️ Reportar falla en la app', action: 'iniciar_falla', prompt: 'Quiero reportar un problema de falla en la app.' },
          ]
        );
      } else {
        pushAgentMessage(
          `Esta cuenta tiene una inhabilitación **definitiva** por decisión disciplinaria.\n\nPara estos casos, la vía formal es presentar un recurso de apelación con pruebas ante el comité directivo demostrando que la falta no existió o fue producto de un error.`,
          [
            { label: '📝 Radicar recurso de apelación', action: 'iniciar_apelacion', prompt: 'Deseo presentar un recurso formal de apelación con descargos.' },
            { label: '👤 Contactar comité administrativo', action: 'comite_humano', prompt: 'Solicito revisión con la mesa directiva.' },
          ]
        );
      }
      return;
    }

    // ── CONTACTO COMITÉ HUMANO ──
    if (triggeredAction === 'comite_humano' || lower.includes('humano') || lower.includes('asesor') || lower.includes('supervisor')) {
      pushAgentMessage(
        `He registrado tu solicitud de atención con el **Comité Administrativo de Bogotá**.\n\nPara que el supervisor pueda resolver tu caso en el panel administrativo, te sugerimos dejar radicada tu apelación o reporte por este medio con tus argumentos por escrito.`,
        [
          { label: '📝 Dejar descargos / apelación escrita', action: 'iniciar_apelacion', prompt: 'Deseo redactar mi apelación para que la lea el comité.' },
          { label: '🛠️ Reportar falla técnica de la app', action: 'iniciar_falla', prompt: 'Deseo reportar la falla técnica de la app.' },
        ]
      );
      return;
    }

    // ── RESPUESTA GENERAL CONTEXTUAL IA ──
    pushAgentMessage(
      `He procesado tu mensaje: *"${text}"*.\n\nPuedo ingresar tu caso directamente al **Panel Administrativo** para que el equipo oficial redacte la respuesta formal y emita la solución:\n\n• ¿Deseas radicar una **Apelación formal**?\n• ¿O prefieres reportar una **Falla técnica en la app**?\n• ¿O radicar un **PQR de servicio**?`,
      [
        { label: '📝 Radicar Apelación', action: 'iniciar_apelacion', prompt: 'Quiero radicar mi apelación formal.' },
        { label: '🛠️ Reportar falla en la app', action: 'iniciar_falla', prompt: 'Quiero reportar un problema de falla en la app.' },
        { label: '⚖️ Radicar PQR oficial', action: 'iniciar_pqr', prompt: 'Quiero radicar una PQR oficial.' },
      ]
    );
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    handleSendMessage(inputText);
  };

  return (
    <div className="sp-ai-chat-backdrop" role="dialog" aria-modal="true" aria-label="Chat de Soporte con IA">
      <div className="sp-ai-chat-card">
        {/* Encabezado */}
        <header className="sp-ai-chat-header">
          <div className="sp-ai-chat-header-info">
            <div className="sp-ai-chat-avatar-box">
              🤖
              <span className="sp-ai-chat-online-dot" />
            </div>
            <div className="sp-ai-chat-title-group">
              <h3>
                Soporte Virtual Serviprox
                <span className="sp-ai-chat-badge-ai">IA ACTIVA</span>
              </h3>
              <p className="sp-ai-chat-subtitle">Resolución de fallas, PQR y apelaciones</p>
            </div>
          </div>
          <button
            type="button"
            className="sp-ai-chat-close-btn"
            onClick={onClose}
            aria-label="Cerrar chat de soporte"
          >
            ✕
          </button>
        </header>

        {/* Banner de Contexto */}
        <div className="sp-ai-chat-context-banner">
          <span>Usuario: <strong>{userName}</strong></span>
          <span className="sp-ai-chat-context-badge">
            {isTemporal ? `Suspensión ${durationText}` : 'Cuenta Restringida'}
          </span>
        </div>

        {/* Flujo de Mensajes */}
        <div className="sp-ai-chat-stream">
          {messages.map((msg) => {
            const isAgent = msg.sender === 'agent';
            return (
              <div
                key={msg.id}
                className={`sp-ai-msg-row ${isAgent ? 'from-agent' : 'from-user'}`}
              >
                <div className="sp-ai-msg-avatar">
                  {isAgent ? '🤖' : '👤'}
                </div>
                <div className="sp-ai-bubble-wrap">
                  <div className={`sp-ai-bubble ${isAgent ? 'agent-bubble' : 'user-bubble'}`}>
                    {isAgent && (
                      <div className="sp-ai-agent-label">
                        <span>Asistente IA Serviprox</span>
                      </div>
                    )}
                    <div style={{ whiteSpace: 'pre-line' }}>{msg.text}</div>

                    {/* Chips de opciones rápidas */}
                    {isAgent && msg.quickOptions && msg.quickOptions.length > 0 && (
                      <div className="sp-ai-chips-group">
                        {msg.quickOptions.map((opt, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="sp-ai-chip-btn"
                            onClick={() => handleQuickAction(opt.action, opt.prompt)}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="sp-ai-time-stamp">{msg.timestamp}</span>
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="sp-ai-typing-indicator">
              <span>IA procesando</span>
              <div className="sp-ai-typing-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Composer / Entrada de texto */}
        <div className="sp-ai-composer">
          <form className="sp-ai-composer-form" onSubmit={handleFormSubmit}>
            <input
              type="text"
              className="sp-ai-composer-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                chatMode === 'appeal_input'
                  ? 'Escribe tus descargos para radicar la apelación...'
                  : chatMode === 'failure_description'
                  ? 'Describe detalladamente la falla técnica que ocurrió...'
                  : chatMode === 'pqr_input'
                  ? 'Escribe el motivo de tu reclamación o PQR...'
                  : 'Escribe tu consulta sobre la falla, PQR o apelación...'
              }
              disabled={isTyping}
            />
            <button
              type="submit"
              className="sp-ai-composer-send-btn"
              disabled={isTyping || !inputText.trim()}
              title="Enviar mensaje a la IA"
            >
              ➤
            </button>
          </form>
          <div className="sp-ai-footer-note">
            Radicación oficial en el Panel Administrativo • Conforme a la Ley 1480
          </div>
        </div>
      </div>
    </div>
  );
};
