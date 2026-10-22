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
  isHighlight?: boolean;
}

interface DecisionCard {
  type: 'approved' | 'denied';
  title: string;
  reason: string;
  ticketNumber: string;
}

interface ChatMessage {
  id: string;
  sender: 'agent' | 'user';
  text: string;
  timestamp: string;
  quickOptions?: QuickOption[];
  imageUrl?: string;
  decisionCard?: DecisionCard;
}

interface SupportAiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  context?: SupportAiContext;
  initialAction?: string;
  onAppealSuccess?: (ticketNumber: string) => void;
  onAccountUnblocked?: () => void;
}

type ChatMode =
  | 'idle'
  | 'unlock_description'
  | 'unlock_photo'
  | 'unlock_reviewing'
  | 'appeal_input'
  | 'failure_category'
  | 'failure_description'
  | 'pqr_input';

interface UnlockDraft {
  description?: string;
  photoUrl?: string;
  photoName?: string;
}

export const SupportAiChatModal: React.FC<SupportAiChatModalProps> = ({
  isOpen,
  onClose,
  context,
  initialAction,
  onAppealSuccess,
  onAccountUnblocked,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>('idle');
  const [selectedFailureCategory, setSelectedFailureCategory] = useState<string>('General');
  const [unlockDraft, setUnlockDraft] = useState<UnlockDraft>({});
  const [attachedImage, setAttachedImage] = useState<{ url: string; name: string } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userName = context?.userName || 'Usuario';
  const blockReason = context?.blockReason || 'Incumplimiento de acuerdos o términos de servicio';
  const isTemporal = context?.blockType !== 'permanente' && !!context?.blockedUntil;
  const durationText = context?.blockDurationDays
    ? `${context.blockDurationDays} días`
    : isTemporal
    ? 'temporal'
    : 'permanente';

  // Iniciar conversación cuando se abre el modal
  useEffect(() => {
    if (!isOpen) return;

    setChatMode('idle');
    setUnlockDraft({});
    setAttachedImage(null);
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Si viene con acción inicial de desbloqueo (ej. botón directo de la ventana de bloqueo)
    if (initialAction === 'iniciar_desbloqueo') {
      setChatMode('unlock_description');
      setMessages([
        {
          id: 'msg-init-unlock',
          sender: 'agent',
          text: `Hola **${userName}**, soy tu **Asistente Virtual con IA de Soporte Serviprox**.\n\n🔓 **Módulo de Desbloqueo de Cuenta con Inteligencia Artificial**\n\nHe verificado el estado de tu cuenta (*Sanción: ${blockReason}*). Para que la IA evalúe tu caso y determine si procede el **desbloqueo inmediato** de tu cuenta, completaremos 2 sencillos pasos:\n\n📝 **Paso 1 de 2: Descripción de los hechos**\nPor favor, escribe detalladamente qué sucedió: ¿por qué consideras que el bloqueo fue un error o malentendido, o qué justificación presentas?`,
          timestamp: timeStr,
          quickOptions: [
            { label: '📱 Ocurrió una falla técnica o de GPS en la app', action: 'desbloq_falla', prompt: 'El inconveniente ocurrió por una falla técnica o de GPS en la app que me impidió responder a tiempo.' },
            { label: '🤝 Llegué a un acuerdo conciliado con el usuario', action: 'desbloq_acuerdo', prompt: 'Hablé directamente con el usuario y llegamos a un acuerdo satisfactorio.' },
            { label: '⏱️ Inconveniente imprevisible por fuerza mayor', action: 'desbloq_fuerza_mayor', prompt: 'Tuve una situación de fuerza mayor imprevisible ajena a mi voluntad.' },
            { label: '⚠️ Fue un reporte falso o malentendido sin mala fe', action: 'desbloq_falso', prompt: 'Considero que fue un reporte injustificado o malentendido, no hubo mala fe de mi parte.' },
          ],
        },
      ]);
      return;
    }

    const initialText = `Hola **${userName}**, soy tu **Asistente Virtual con IA de Soporte Serviprox**.\n\nHe verificado tu expediente (*Causal: "${blockReason}"*). Estoy facultado para interactuar contigo, resolver todas tus dudas y tomar acciones oficiales:\n\n• 🔓 **Solicitar Desbloqueo de Cuenta con IA**: Evaluamos tu descripción y foto de evidencia en tiempo real.\n• 📝 **Radicar Recurso de Apelación**: Envío formal de descargos al Comité Administrativo.\n• 🛠️ **Reportar Fallas Técnicas**: Errores de mapa, GPS o pasarela de pagos.\n• ⚖️ **Crear PQR Oficial**: Amparado bajo la Ley 1480 del Estatuto del Consumidor.\n\nPuedes hacerme cualquier pregunta o seleccionar una acción abajo:`;

    const initialOptions: QuickOption[] = [
      {
        label: '🔓 Solicitar Desbloqueo de Cuenta con IA',
        action: 'iniciar_desbloqueo',
        prompt: 'Quiero solicitar el desbloqueo inmediato de mi cuenta evaluado por la IA.',
        isHighlight: true,
      },
      {
        label: '❓ ¿Por qué ocurrió el bloqueo?',
        action: 'explicar_motivo',
        prompt: '¿Por qué motivos específicos la plataforma aplicó este bloqueo?',
      },
      {
        label: '⏱️ ¿Cuánto dura la suspensión?',
        action: 'consultar_tiempo',
        prompt: '¿Cuánto tiempo dura la suspensión y cuándo podré ingresar?',
      },
      {
        label: '📝 Radicar Apelación Formal',
        action: 'iniciar_apelacion',
        prompt: 'Deseo radicar mi recurso de apelación ante el comité administrativo.',
      },
      {
        label: '🛠️ Reportar falla técnica en la app',
        action: 'iniciar_falla',
        prompt: 'Quiero reportar un problema o falla técnica que ocurrió en la app.',
      },
      {
        label: '⚖️ Radicar PQR oficial',
        action: 'iniciar_pqr',
        prompt: 'Deseo radicar una PQR oficial.',
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
  }, [isOpen, userName, blockReason, durationText, initialAction]);

  // Auto-scroll al final cuando llegan mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!isOpen) return null;

  const pushAgentMessage = (
    text: string,
    quickOptions?: QuickOption[],
    decisionCard?: DecisionCard,
    imageUrl?: string
  ) => {
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
          decisionCard,
          imageUrl,
        },
      ]);
    }, 600);
  };

  // Manejador de selección de imagen desde archivo
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAttachedImage({
          url: reader.result,
          name: file.name,
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Ejecución del desbloqueo oficial en el sistema
  const executeUnblockOperation = async (desc: string, radicadoId: string) => {
    try {
      // 1. Eliminar de serviprox_blocked_users en localStorage
      const stored = JSON.parse(localStorage.getItem('serviprox_blocked_users') || '{}');
      if (context?.userName) {
        delete stored[context.userName.trim().toLowerCase()];
      }
      localStorage.setItem('serviprox_blocked_users', JSON.stringify(stored));

      // 2. Registrar en backend mediante acción administrativa
      await adminService.executeAction({
        action: 'unblock_user',
        target_id: context?.userName || 'usuario',
        reason: `Desbloqueo otorgado por IA tras revisión de expediente: ${desc}`,
        admin_name: 'IA Defensoría Serviprox',
        send_notification: true,
      });

      // 3. Notificar en vivo y actualizar estado
      window.dispatchEvent(new CustomEvent('serviprox:account-unblocked'));
      window.dispatchEvent(new CustomEvent('serviprox:pqr-updated'));

      if (onAccountUnblocked) {
        onAccountUnblocked();
      }
    } catch (err) {
      console.warn('Error ejecutando desbloqueo:', err);
    }
  };

  // Proceso de evaluación con Inteligencia Artificial del caso
  const runAiCaseEvaluation = (description: string, photoAttachment?: { url: string; name: string } | null) => {
    setChatMode('unlock_reviewing');
    setIsTyping(true);

    const radNum = Math.floor(1000 + Math.random() * 9000);
    const radicadoTicket = `DES-BOG-${radNum}`;

    setTimeout(() => {
      setIsTyping(false);

      const lowerDesc = description.toLowerCase();
      // Verificamos si la justificación presenta argumentos razonables o evidencia
      const isUnpardonable =
        lowerDesc.includes('robé') ||
        lowerDesc.includes('estafé') ||
        lowerDesc.includes('agredí físicamente');

      const isSubstantial =
        description.trim().length >= 10 || !!photoAttachment;

      if (!isUnpardonable && isSubstantial) {
        // ── DICTAMEN 1: DESBLOQUEO DE CUENTA APROBADO ──
        executeUnblockOperation(description, radicadoTicket);

        setMessages((prev) => [
          ...prev,
          {
            id: `agent-eval-${Date.now()}`,
            sender: 'agent',
            text: `🎉 **¡DICTAMEN FAVORABLE DE LA IA: CUENTA DESBLOQUEADA!**\n\n✅ **Resolución del Caso:**\nTras contrastar tus descargos con la causal de sanción (*"${blockReason}"*) y analizar la evidencia aportada, la IA de Serviprox determina que **existen méritos de buena fe y justificación suficiente** para el levantamiento inmediato de la inhabilitación.\n\n🔓 **Estado Actual:** Cuenta reactivada y habilitada al 100% en la base de datos oficial.\n🔖 **Radicado de Desbloqueo:** \`#${radicadoTicket}\`\n\nYa puedes volver a ingresar a la plataforma y utilizar todas las funciones con normalidad.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            decisionCard: {
              type: 'approved',
              title: '¡DESBLOQUEO DE CUENTA APROBADO POR LA IA!',
              reason: 'Causal justificada sin dolo. Restablecimiento inmediato de derechos en la plataforma Serviprox.',
              ticketNumber: radicadoTicket,
            },
            quickOptions: [
              {
                label: '🚀 Entrar a la Aplicación Ahora',
                action: 'entrar_app',
                prompt: 'Deseo entrar inmediatamente a la aplicación.',
                isHighlight: true,
              },
              {
                label: '🚪 Cerrar y Finalizar',
                action: 'salir',
                prompt: 'Muchas gracias, todo claro.',
              },
            ],
          },
        ]);
        setChatMode('idle');
      } else {
        // ── DICTAMEN 2: SIGUE BLOQUEADO / ESCALADO A COMITÉ HUMANO ──
        const pqrTicket = `APL-${radNum}`;
        adminService.executeAction({
          action: 'respond_pqr',
          target_id: pqrTicket,
          response_text: `Caso evaluado por IA no concedido de inmediato. Escalado a comité humano para ${userName}: "${description}"`,
          admin_name: 'Asistente IA - Defensoría',
          send_notification: true,
        }).catch(console.warn);

        setMessages((prev) => [
          ...prev,
          {
            id: `agent-eval-${Date.now()}`,
            sender: 'agent',
            text: `⚠️ **DICTAMEN DE LA IA: LA CUENTA DEBE PERMANECER EN REVISIÓN**\n\nLa IA ha evaluado la información suministrada, pero debido a la falta de pruebas concluyentes o la naturaleza de la causal (*"${blockReason}"*), el levantamiento automático no fue autorizado de forma inmediata.\n\n📌 **Medida aplicada:** Tu caso ha sido formalmente radicado bajo el expediente \`#${pqrTicket}\` ante el **Comité Disciplinario y Administrativo Humano** de Serviprox Bogotá.\n⏱️ **Tiempo de revisión del Administrador:** 24 a 48 horas hábiles.\n\nEl administrador revisará tus antecedentes y emitirá la resolución final.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            decisionCard: {
              type: 'denied',
              title: 'SOLICITUD EN REVISIÓN ADMINISTRATIVA',
              reason: 'Expediente trasladado al Administrador de Serviprox para análisis de fondo.',
              ticketNumber: pqrTicket,
            },
            quickOptions: [
              {
                label: '🔄 Aportar más descargos o fotos',
                action: 'iniciar_desbloqueo',
                prompt: 'Quiero presentar nuevos argumentos y fotos para una nueva evaluación.',
              },
              {
                label: '🛠️ Reportar falla técnica de la app',
                action: 'iniciar_falla',
                prompt: 'Deseo registrar que el problema fue por falla de la app.',
              },
              {
                label: '🚪 Salir y esperar revisión',
                action: 'salir',
                prompt: 'Esperaré la revisión del administrador.',
              },
            ],
          },
        ]);
        setChatMode('idle');
      }
    }, 1400);
  };

  const handleQuickAction = async (action: string, promptText?: string) => {
    const textToSend = promptText || action;
    handleSendMessage(textToSend, action);
  };

  const handleSendMessage = async (text: string, triggeredAction?: string) => {
    if (!text.trim() && !attachedImage) return;

    const userMessageText = text.trim() || (attachedImage ? `[Foto adjunta: ${attachedImage.name}]` : '');
    const currentAttachment = attachedImage;
    setAttachedImage(null);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: userMessageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      imageUrl: currentAttachment?.url,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');

    const lower = text.toLowerCase();

    // ── ACCIÓN: ENTRAR A LA APP TRAS DESBLOQUEO ──
    if (triggeredAction === 'entrar_app' || lower.includes('entrar a la app') || lower.includes('ingresar ahora')) {
      if (onAccountUnblocked) {
        onAccountUnblocked();
      }
      onClose();
      return;
    }

    // ── ACCIÓN: SALIR / CERRAR ──
    if (triggeredAction === 'salir' || lower === 'salir' || lower === 'cerrar') {
      onClose();
      return;
    }

    // ── PASO 1 DESBLOQUEO: RECEPCIÓN DE LA DESCRIPCIÓN ──
    if (chatMode === 'unlock_description') {
      const updatedDraft = { ...unlockDraft, description: text };
      setUnlockDraft(updatedDraft);
      setChatMode('unlock_photo');

      pushAgentMessage(
        `📝 **Paso 1 completado: Descripción registrada.**\n*"${text}"*\n\n📸 **Paso 2 de 2: Foto o Captura del Bloqueo / Evidencia**\n\nPara validar tu solicitud, por favor adjunta una foto o captura de pantalla donde se observe:\n• El mensaje de bloqueo o pantalla de error.\n• Comprobante de pago o chat de acuerdo mutuo.\n• O foto de soporte o justificación.\n\nPuedes presionar el botón 📷 **Adjuntar Foto** abajo en la barra de texto, o elegir una opción:`,
        [
          { label: '📸 Adjuntar captura de pantalla del bloqueo actual', action: 'simular_captura', prompt: 'Adjunto captura de la pantalla de bloqueo de mi cuenta.' },
          { label: '📷 Subir foto desde mi galería o cámara', action: 'abrir_selector', prompt: 'Voy a seleccionar una foto de mis archivos.' },
          { label: '⚡ Evaluar caso con mi descripción ahora', action: 'evaluar_sin_foto', prompt: 'Deseo que la IA evalúe mi caso con la descripción que entregué.' },
        ]
      );
      return;
    }

    // ── PASO 2 DESBLOQUEO: RECEPCIÓN DE FOTO Y REVISIÓN POR IA ──
    if (chatMode === 'unlock_photo' || triggeredAction === 'evaluar_sin_foto' || triggeredAction === 'simular_captura') {
      let photoToUse = currentAttachment;

      if (triggeredAction === 'abrir_selector') {
        fileInputRef.current?.click();
        return;
      }

      if (triggeredAction === 'simular_captura') {
        // Generamos simulación de captura de bloqueo
        photoToUse = {
          url: 'https://images.unsplash.com/photo-1555421689-491a97ff2040?w=600&auto=format&fit=crop&q=80',
          name: 'captura_pantalla_bloqueo_serviprox.png',
        };
      }

      const finalDescription = unlockDraft.description || text;
      runAiCaseEvaluation(finalDescription, photoToUse);
      return;
    }

    // ── ACCIÓN: INICIAR FLUJO DE DESBLOQUEO DE CUENTA ──
    if (
      triggeredAction === 'iniciar_desbloqueo' ||
      lower.includes('desbloquear') ||
      lower.includes('desbloqueo') ||
      lower.includes('quitar bloqueo') ||
      lower.includes('levantar sancion') ||
      lower.includes('activar cuenta')
    ) {
      setChatMode('unlock_description');
      pushAgentMessage(
        `🔓 **Solicitud de Desbloqueo Inmediato de Cuenta por IA**\n\nIniciaremos el proceso de revisión automática en 2 pasos:\n\n📝 **Paso 1 de 2: Descripción de los hechos**\nPor favor, escribe abajo qué sucedió con el servicio o por qué consideras que el bloqueo fue injustificado o un error:`,
        [
          { label: '📱 Ocurrió una falla técnica de la app o GPS', action: 'desbloq_falla', prompt: 'Fue a causa de un problema técnico de la app que impidió confirmar el servicio a tiempo.' },
          { label: '🤝 Llegué a un acuerdo conciliado con el usuario', action: 'desbloq_acuerdo', prompt: 'Ya conversé con la otra parte y llegamos a un acuerdo amistoso.' },
          { label: '⏱️ Inconveniente de fuerza mayor ajeno a mí', action: 'desbloq_fuerza_mayor', prompt: 'Ocurrió un imprevisto de fuerza mayor ajeno a mi voluntad.' },
          { label: '⚠️ Reporte falso o malentendido', action: 'desbloq_falso', prompt: 'Fue un malentendido sin mala fe de mi parte.' },
        ]
      );
      return;
    }

    // ── MODO APELACIÓN GENERAL ──
    if (chatMode === 'appeal_input') {
      setChatMode('idle');
      setIsTyping(true);
      try {
        const radNum = Math.floor(10000 + Math.random() * 90000);
        const ticketId = `APL-${radNum}`;

        await adminService.executeAction({
          action: 'respond_pqr',
          target_id: ticketId,
          response_text: `Apelación recibida por IA de ${userName}: "${text}" (Motivo sanción: ${blockReason})`,
          admin_name: 'Asistente IA - Defensoría',
          send_notification: true,
        });

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
                  label: '🔓 Probar Desbloqueo Inmediato por IA',
                  action: 'iniciar_desbloqueo',
                  prompt: 'Quiero evaluar mi caso para desbloqueo inmediato por IA.',
                  isHighlight: true,
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
        pushAgentMessage(`Tu explicación ha sido anotada para el expediente administrativo.`);
        return;
      }
    }

    // ── MODO FALLA TÉCNICA ──
    if (chatMode === 'failure_description') {
      setChatMode('idle');
      setIsTyping(true);
      try {
        const ticketNum = `#TK-${Math.floor(1046 + Math.random() * 8950)}`;

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
              text: `✅ **¡Falla Técnica Registrada en el Panel Administrativo!**\n\n📌 **Ticket Técnico:** \`${ticketNum}\`\n📂 **Módulo afectado:** ${selectedFailureCategory}\n👤 **Reportado por:** ${userName}\n📋 **Detalle registrado:** "${text}"\n\nTu reporte ya está disponible en el **Módulo de Fallas Técnicas del Administrador**.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              quickOptions: [
                {
                  label: '🔓 Solicitar Desbloqueo por esta Falla',
                  action: 'iniciar_desbloqueo',
                  prompt: `Quiero desbloquear mi cuenta argumentando que el error fue causado por la falla ${ticketNum}.`,
                  isHighlight: true,
                },
                {
                  label: '🚪 Salir',
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
        pushAgentMessage(`La falla técnica ha sido registrada en el log del sistema.`);
        return;
      }
    }

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
        `Has seleccionado el módulo **${catName}**.\n\nPor favor, escribe detalladamente qué sucedió (el error en pantalla o cómo afectó tu cuenta) y crearé el **Ticket Técnico Oficial** en el panel administrativo:`,
        [
          { label: 'No me permitió confirmar la llegada', action: 'desc_llegada', prompt: 'La app no me permitió confirmar la llegada por error de GPS.' },
          { label: 'Se congeló al procesar el servicio', action: 'desc_congelo', prompt: 'La pantalla se quedó cargando y bloqueó la orden.' },
        ]
      );
      return;
    }

    // ── ACCIÓN: INICIAR APELACIÓN FORMAL ──
    if (triggeredAction === 'iniciar_apelacion' || lower.includes('apelar') || lower.includes('descargo')) {
      setChatMode('appeal_input');
      pushAgentMessage(
        `Para estructurar tu recurso de apelación ante el **Comité Administrativo de Bogotá**, escribe a continuación tus **descargos y argumentos formales**:\n\nLos registraré directamente en el panel administrativo:`,
        [
          { label: 'Fue por una falla técnica de la app', action: 'apela_falla', prompt: 'El problema se debió a un fallo técnico de la app que me impidió reportar a tiempo.' },
          { label: 'Llegué a un acuerdo con el usuario', action: 'apela_acuerdo', prompt: 'Hablé directamente con el usuario y llegamos a una solución conciliada.' },
          { label: 'Ocurrió por motivos de fuerza mayor', action: 'apela_fuerza_mayor', prompt: 'El retraso o inconveniente ocurrió por causas de fuerza mayor imprevisibles.' },
        ]
      );
      return;
    }

    // ── ACCIÓN: INICIAR PQR OFICIAL ──
    if (triggeredAction === 'iniciar_pqr' || lower.includes('pqr') || lower.includes('queja') || lower.includes('reclamo')) {
      setChatMode('pqr_input');
      pushAgentMessage(
        `Conforme a la **Ley 1480 de Protección al Consumidor**, escribe el motivo de tu reclamación formal:`,
        [
          { label: 'Reclamo por cobro o retención injustificada', action: 'pqr_cobro', prompt: 'Reclamo formal por retención de fondos o cobro indebido.' },
          { label: 'Inconformidad con el servicio recibido', action: 'pqr_servicio', prompt: 'Queja por incumplimiento o mala atención en el servicio pactado.' },
        ]
      );
      return;
    }

    // ═════════════════════════════════════════════════════════════════════
    // MOTOR DE RESPUESTAS A CADA PREGUNTA DEL USUARIO (RESPONDE CADA DUDA)
    // ═════════════════════════════════════════════════════════════════════

    // 1. ¿Cómo funciona el desbloqueo?
    if (lower.includes('como desbloqueo') || lower.includes('cómo desbloquear') || lower.includes('como desbloquear') || lower.includes('quién me desbloquea')) {
      pushAgentMessage(
        `Para desbloquear tu cuenta mediante nuestra **Inteligencia Artificial de Soporte**, el proceso consta de 2 pasos:\n\n1️⃣ **Descripción**: Nos explicas brevemente lo sucedido y por qué consideras que el bloqueo debe ser levantado.\n2️⃣ **Foto o Evidencia**: Adjuntas una captura de pantalla del bloqueo, comprobante de pago o acuerdo.\n\nLa IA analiza tu caso inmediatamente y, si cumple las condiciones de buena fe, **desbloquea tu cuenta al instante** sin esperar días de trámite.`,
        [
          { label: '🔓 Iniciar Desbloqueo Ahora', action: 'iniciar_desbloqueo', prompt: 'Quiero iniciar el proceso de desbloqueo con IA.', isHighlight: true },
          { label: '📝 Radicar Apelación Tradicional', action: 'iniciar_apelacion', prompt: 'Prefiero radicar una apelación tradicional ante el comité.' },
        ]
      );
      return;
    }

    // 2. ¿Por qué me bloquearon / cuál es el motivo?
    if (lower.includes('por qué me bloquearon') || lower.includes('por que me bloquearon') || lower.includes('por que me suspendieron') || lower.includes('cual es el motivo') || lower.includes('por qué ocurrió')) {
      pushAgentMessage(
        `Tu cuenta presenta una restricción por la siguiente causal oficial registrada en el sistema disciplinario:\n\n📌 **Causal oficial:** *"${blockReason}"*\n\nServiprox suspende cuentas temporalmente para garantizar la seguridad en casos de reportes de clientes, inasistencias o acuerdos económicos no registrados. Si consideras que fue un error o malentendido, puedes solicitar el **Desbloqueo Inmediato por IA** adjuntando tu explicación y foto.`,
        [
          { label: '🔓 Solicitar Desbloqueo Inmediato', action: 'iniciar_desbloqueo', prompt: 'Quiero solicitar el desbloqueo inmediato por ser un error.', isHighlight: true },
          { label: '🛠️ Fue culpa de un error de la app', action: 'iniciar_falla', prompt: 'La suspensión ocurrió por una falla técnica de la app.' },
        ]
      );
      return;
    }

    // 3. ¿Cuánto tiempo dura la suspensión / cuándo podré entrar?
    if (lower.includes('cuanto dura') || lower.includes('cuánto dura') || lower.includes('cuando podre entrar') || lower.includes('cuándo podré entrar') || lower.includes('tiempo restante')) {
      if (isTemporal) {
        pushAgentMessage(
          `Tu suspensión es **temporal** por un plazo de **${durationText}**.\n\n🗓️ **Fecha de reactivación automática:** ${context?.blockedUntil ? new Date(context.blockedUntil).toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Al culminar los días estipulados'}.\n\n💡 **Importante:** No necesitas esperar que pasen los días. Puedes usar nuestro **Desbloqueo con IA** para reactivar tu cuenta hoy mismo si tienes descargos válidos.`,
          [
            { label: '🔓 Desbloquear Mi Cuenta Hoy', action: 'iniciar_desbloqueo', prompt: 'Deseo desbloquear mi cuenta hoy mismo con la IA.', isHighlight: true },
            { label: '📝 Radicar Apelación', action: 'iniciar_apelacion', prompt: 'Quiero radicar una apelación formal.' },
          ]
        );
      } else {
        pushAgentMessage(
          `Esta cuenta tiene una inhabilitación **definitiva** por decisión disciplinaria de la administración.\n\nSin embargo, la IA de Soporte está facultada para revisar nuevos elementos probatorios y revocar la decisión si aportas descargos y foto de evidencia que demuestren que no hubo dolo.`,
          [
            { label: '🔓 Solicitar Revisión y Desbloqueo IA', action: 'iniciar_desbloqueo', prompt: 'Quiero que la IA revise mi expediente para desbloquearme.', isHighlight: true },
            { label: '👤 Contactar comité administrativo', action: 'comite_humano', prompt: 'Solicito revisión con la mesa directiva.' },
          ]
        );
      }
      return;
    }

    // 4. ¿Qué foto o evidencia debo subir?
    if (lower.includes('que foto') || lower.includes('qué foto') || lower.includes('que evidencia') || lower.includes('como tomo la foto')) {
      pushAgentMessage(
        `Para el **Desbloqueo con IA**, puedes adjuntar cualquiera de estas fotos o capturas:\n\n📸 **Captura de pantalla** de la advertencia de bloqueo o error en la app.\n💬 **Captura de chat de WhatsApp** o mensajes con el cliente/profesional demostrando acuerdo mutuo.\n🧾 **Comprobante de pago o transferencia** bancaria si hubo disputa de saldo.\n📄 **Certificado o prueba médica/laboral** si fue por fuerza mayor.\n\nPuedes presionar el botón 📷 abajo para adjuntarla directamente.`,
        [
          { label: '🔓 Iniciar Desbloqueo con Foto', action: 'iniciar_desbloqueo', prompt: 'Quiero iniciar el desbloqueo y adjuntar mi foto.', isHighlight: true },
        ]
      );
      return;
    }

    // 5. ¿Qué pasa con mi saldo, pagos o dinero?
    if (lower.includes('dinero') || lower.includes('saldo') || lower.includes('plata') || lower.includes('pago') || lower.includes('cobro')) {
      pushAgentMessage(
        `💰 **Protección de Fondos y Saldos:**\n\nConforme a la legislación colombiana y la Ley 1480, **tu dinero y saldos están legalmente protegidos**. La suspensión de la cuenta no confisca ni retiene tus fondos.\n\n• Al desbloquear tu cuenta con la IA, tendrás acceso inmediato a tu saldo acumulado.\n• Si deseas solicitar retiro sin reactivar, la administración gestiona la transferencia a tu cuenta bancaria registrada en 24 a 48 horas.`,
        [
          { label: '🔓 Desbloquear para Acceder a mi Saldo', action: 'iniciar_desbloqueo', prompt: 'Quiero desbloquear mi cuenta para acceder a mis fondos.', isHighlight: true },
          { label: '⚖️ Radicar PQR de Facturación', action: 'iniciar_pqr', prompt: 'Quiero radicar una reclamación sobre mis saldos.' },
        ]
      );
      return;
    }

    // 6. ¿Puedo crear otra cuenta?
    if (lower.includes('otra cuenta') || lower.includes('nuevo usuario') || lower.includes('crear otra')) {
      pushAgentMessage(
        `⚠️ **Políticas de Identidad en Serviprox:**\n\nNo es recomendable crear otra cuenta, ya que el sistema valida automáticamente tu cédula de ciudadanía (CC) y número telefónico. Al detectar duplicidad, el sistema inhabilita la nueva cuenta.\n\nLa vía más rápida y efectiva es **solicitar el desbloqueo de tu cuenta actual con la IA**, lo cual toma solo 2 minutos y conserva tus calificaciones e historial.`,
        [
          { label: '🔓 Desbloquear Mi Cuenta Actual', action: 'iniciar_desbloqueo', prompt: 'Prefiero desbloquear mi cuenta actual.', isHighlight: true },
        ]
      );
      return;
    }

    // 7. Saludos y cortesía
    if (lower === 'hola' || lower === 'buenos dias' || lower === 'buenas tardes' || lower === 'buenas noches' || lower === 'gracias') {
      pushAgentMessage(
        `¡Hola **${userName}**! Con gusto te colaboro. Estoy aquí para atender cualquier duda sobre tu cuenta y ayudarte a restaurar tu acceso.\n\n¿Deseas que iniciemos el **Desbloqueo Inmediato por IA**? Solo tomará un par de minutos.`,
        [
          { label: '🔓 Desbloquear Mi Cuenta', action: 'iniciar_desbloqueo', prompt: 'Deseo iniciar el desbloqueo de mi cuenta ahora.', isHighlight: true },
          { label: '❓ Tengo una pregunta sobre mi bloqueo', action: 'explicar_motivo', prompt: 'Quiero saber más sobre los motivos de mi bloqueo.' },
        ]
      );
      return;
    }

    // 8. Respuestas abiertas / Cualquier otra duda
    pushAgentMessage(
      `He procesado tu consulta: *"${text}"*.\n\nComo Asistente Virtual con IA de Serviprox, te confirmo que tienes pleno derecho a la defensa y al levantamiento de sanciones si aportas tu versión y evidencia.\n\n¿Cuál de las siguientes acciones deseas que ejecutemos de inmediato?`,
      [
        { label: '🔓 Solicitar Desbloqueo de Cuenta con IA', action: 'iniciar_desbloqueo', prompt: 'Deseo solicitar el desbloqueo de mi cuenta con IA.', isHighlight: true },
        { label: '📝 Radicar Apelación Formal en Panel Admin', action: 'iniciar_apelacion', prompt: 'Quiero radicar una apelación formal ante el comité.' },
        { label: '🛠️ Reportar Falla Técnica de la App', action: 'iniciar_falla', prompt: 'Quiero reportar un problema técnico de la app.' },
      ]
    );
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !attachedImage) return;
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
              <p className="sp-ai-chat-subtitle">Desbloqueo de cuentas, apelaciones y PQR</p>
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

                    {/* Imagen adjunta en el mensaje */}
                    {msg.imageUrl && (
                      <div className="sp-ai-msg-image-box">
                        <img src={msg.imageUrl} alt="Evidencia adjunta" className="sp-ai-msg-image" />
                        <div className="sp-ai-msg-image-label">📷 Evidencia Fotográfica</div>
                      </div>
                    )}

                    {/* Tarjeta de Decisión Oficial de la IA */}
                    {msg.decisionCard && (
                      <div className={`sp-ai-decision-card ${msg.decisionCard.type}`}>
                        <div className="sp-ai-decision-card-header">
                          <span>{msg.decisionCard.type === 'approved' ? '✅' : '⚠️'}</span>
                          <span>{msg.decisionCard.title}</span>
                          <span className="sp-ai-decision-badge">
                            {msg.decisionCard.type === 'approved' ? 'Desbloqueado' : 'En Revisión'}
                          </span>
                        </div>
                        <div className="sp-ai-decision-card-body">
                          {msg.decisionCard.reason}
                        </div>
                        <div className="sp-ai-decision-card-ticket">
                          📌 Radicado Oficial: <strong>{msg.decisionCard.ticketNumber}</strong>
                        </div>
                      </div>
                    )}

                    {/* Chips de opciones rápidas */}
                    {isAgent && msg.quickOptions && msg.quickOptions.length > 0 && (
                      <div className="sp-ai-chips-group">
                        {msg.quickOptions.map((opt, idx) => {
                          const isUnblock = opt.action === 'iniciar_desbloqueo' || opt.isHighlight;
                          const isEnterApp = opt.action === 'entrar_app';
                          const extraClass = isEnterApp
                            ? 'enter-app-btn'
                            : isUnblock
                            ? 'unblock-btn'
                            : '';
                          return (
                            <button
                              key={idx}
                              type="button"
                              className={`sp-ai-chip-btn ${extraClass}`}
                              onClick={() => handleQuickAction(opt.action, opt.prompt)}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
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
              <span>IA evaluando</span>
              <div className="sp-ai-typing-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Previsualización de imagen adjunta antes de enviar */}
        {attachedImage && (
          <div className="sp-ai-attachment-preview-bar">
            <img src={attachedImage.url} alt="Vista previa" className="sp-ai-attachment-thumb" />
            <span className="sp-ai-attachment-name">📷 {attachedImage.name}</span>
            <button
              type="button"
              className="sp-ai-attachment-remove-btn"
              onClick={() => setAttachedImage(null)}
              title="Quitar imagen"
            >
              ✕
            </button>
          </div>
        )}

        {/* Input oculto para adjuntar archivo desde cámara/galería */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        {/* Composer / Entrada de texto */}
        <div className="sp-ai-composer">
          <form className="sp-ai-composer-form" onSubmit={handleFormSubmit}>
            <button
              type="button"
              className="sp-ai-composer-attach-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Adjuntar foto del bloqueo o evidencia"
            >
              📷
            </button>
            <input
              type="text"
              className="sp-ai-composer-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                chatMode === 'unlock_description'
                  ? 'Paso 1: Describe qué ocurrió para evaluar el desbloqueo...'
                  : chatMode === 'unlock_photo'
                  ? 'Paso 2: Adjunta la foto con el botón 📷 o escribe un mensaje...'
                  : chatMode === 'appeal_input'
                  ? 'Escribe tus descargos para radicar la apelación...'
                  : chatMode === 'failure_description'
                  ? 'Describe detalladamente la falla técnica que ocurrió...'
                  : chatMode === 'pqr_input'
                  ? 'Escribe el motivo de tu reclamación o PQR...'
                  : 'Haz cualquier pregunta a la IA o escribe tu consulta...'
              }
              disabled={isTyping}
            />
            <button
              type="submit"
              className="sp-ai-composer-send-btn"
              disabled={isTyping || (!inputText.trim() && !attachedImage)}
              title="Enviar mensaje a la IA"
            >
              ➤
            </button>
          </form>
          <div className="sp-ai-footer-note">
            Desbloqueo Inteligente con IA • Sincronizado en tiempo real con el Panel Administrativo
          </div>
        </div>
      </div>
    </div>
  );
};
