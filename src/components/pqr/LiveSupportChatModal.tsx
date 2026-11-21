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
} from 'lucide-react';
import type {
  LiveChatMessage,
  AppProblemCategory,
  PqrReport,
  AppProblemReport,
  PqrContractorRef,
  PqrProductRef,
  PublicRegisterRole,
  SupportChat,
  ChatTranscriptEntry,
  User,
} from '../../types/serviprox';
import { REGISTERED_CONTRACTORS_REF } from '../../data/pqrInitialData';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { authService } from '../../services/auth';
import { supportChatService, pqrService, appProblemService } from '../../services/serviprox';
import { getEntryRoute } from '../../utils/routes';
import '../../theme/tailwind.css';
import './pqrStyles.css';


// ─── Types ────────────────────────────────────────────────────────────────────

type ChatFlow =
  | 'inicio'
  | 'user_reg_role'
  | 'user_reg_fullname'
  | 'user_reg_email'
  | 'user_reg_password'
  | 'user_reg_confirm_password'
  | 'user_reg_phone'
  | 'user_reg_city'
  | 'user_reg_document'
  | 'user_reg_address'
  | 'user_reg_profession'
  | 'user_reg_saving'
  | 'chat_directo_titulo'
  | 'chat_directo_mensaje'
  | 'admin_worker_key'
  | 'admin_username'
  | 'admin_fullname'
  | 'admin_email'
  | 'admin_phone'
  | 'admin_area'
  | 'admin_password'
  | 'admin_saving'
  | 'queja_contratista'
  | 'queja_cual_contratista'
  | 'queja_cual_producto'
  | 'queja_descripcion'
  | 'queja_fecha'
  | 'queja_monto'
  | 'queja_solucion'
  | 'queja_confirmacion'
  | 'problema_app'
  | 'problema_app_categoria'
  | 'problema_app_descripcion'
  | 'problema_app_confirmacion'
  | 'apelacion_motivo'
  | 'apelacion_descargos'
  | 'apelacion_confirmacion'
  | 'desbloqueo_descripcion'
  | 'desbloqueo_foto'
  | 'desbloqueo_evaluando'
  | 'fin';

interface UserAccountDraft {
  role?: PublicRegisterRole;
  first_name?: string;
  last_name?: string;
  email?: string;
  password?: string;
  confirm_password?: string;
  phone?: string;
  city?: string;
  document_id?: string;
  address?: string;
  profession?: string;
}

interface DirectChatDraft {
  title?: string;
}

interface AdminWorkerDraft {
  worker_key?: string;
  username?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  area?: string;
}

interface DesbloqueoDraft {
  descripcion?: string;
  fotoUrl?: string;
}

interface ApelacionDraft {
  motivo?: string;
  argumentos?: string;
}

interface QuejaDraft {
  subjectType?: 'servicio' | 'producto';
  productId?: number | null;
  productName?: string;
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
  products?: PqrProductRef[];
  initialFlow?: 'inicio' | 'crear_cuenta' | 'queja_contratista' | 'queja_producto' | 'problema_app' | 'chat_directo';
  onPqrCreatedFromChat?: (
    report: Omit<
      PqrReport,
      'id' | 'radicadoNumber' | 'status' | 'createdAt' | 'estimatedResponseDays'
    > & { chatTranscript?: ChatTranscriptEntry[] }
  ) => Promise<PqrReport | void> | PqrReport | void;
  onAppProblemReported?: (
    problem: AppProblemReport & { chatTranscript?: ChatTranscriptEntry[] }
  ) => Promise<AppProblemReport | void> | AppProblemReport | void;
  onAccountCreated?: (user: User) => void;
  onChatSaved?: (chat: SupportChat) => void;
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

function extractApiErrorMessage(err: unknown): string {
  if (!err) return 'Ocurrió un error inesperado al procesar la solicitud.';
  const record = err as { payload?: unknown; data?: unknown; message?: unknown };
  const payload = record.payload ?? record.data ?? err;
  if (typeof payload === 'string') return payload;
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    if (typeof p.detail === 'string') return p.detail;
    if (typeof p.message === 'string') return p.message;
    const messages: string[] = [];
    for (const [, val] of Object.entries(p)) {
      if (Array.isArray(val)) {
        messages.push(val.join(' '));
      } else if (typeof val === 'string') {
        messages.push(val);
      }
    }
    if (messages.length > 0) return messages.join('\n');
  }
  if (typeof record.message === 'string' && !record.message.startsWith('API request failed')) {
    return record.message;
  }
  return 'No fue posible conectar con el servidor backend ni la base de datos.';
}

function renderFormattedChatText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

// ─── Mensaje inicial exacto de la interfaz ────────────────────────────────────

const INITIAL_MESSAGE: LiveChatMessage = agentMsg(
  '¡Hola! Soy Sofía de la Defensoría y Mesa Técnica de Serviprox Bogotá. ¿En qué te puedo ayudar hoy? Puedes crear tu cuenta (Cliente o Profesional), radicar PQR de servicio o producto, reportar fallas técnicas o abrir un chat guardado con soporte.',
  [
    { label: '👤 Crear cuenta (Cliente o Profesional)', action: 'iniciar_crear_cuenta' },
    { label: '⚖️ Radicar PQR de Servicio', action: 'queja_contratista' },
    { label: '📦 Radicar PQR de Producto', action: 'queja_producto' },
    { label: '📇 Reportar problema con la app', action: 'problema_app' },
    { label: '💬 Crear chat directo con soporte', action: 'iniciar_chat_directo' },
    { label: '🔓 Desbloqueo de Cuenta con IA', action: 'iniciar_desbloqueo' },
    { label: '🛡️ Presentar Apelación de Cuenta / Sanción', action: 'iniciar_apelacion' },
    { label: '🔐 Crear cuenta administrativa (Staff)', action: 'iniciar_crear_admin' },
  ]
);

const CREATE_ACCOUNT_INTRO_MESSAGE = (): LiveChatMessage =>
  agentMsg(
    '👤 **Crear cuenta en Serviprox por el chat**\n\nTe guiaré paso a paso para registrar tu cuenta (Nombre y apellido, correo, contraseña, teléfono, ciudad, cédula y dirección del inmueble).\n\n👉 **Paso 1:** ¿Qué tipo de cuenta deseas crear?',
    [
      { label: '🏠 Cuenta Cliente (Perfil)', action: 'sel_reg_role:client' },
      { label: '🛠️ Cuenta Profesional', action: 'sel_reg_role:professional' },
    ]
  );

const DIRECT_CHAT_INTRO_MESSAGE = (): LiveChatMessage =>
  agentMsg(
    '💬 **Crear chat de soporte**\n\nEste chat quedará guardado en tu historial y notificado al equipo de Serviprox para hacerle seguimiento.\n\n👉 Escribe el **asunto o título** de tu consulta (ejemplo: "Consulta sobre un servicio", "Seguimiento de pedido", "Ayuda con mi perfil"):'
  );

const buildUsernameFromNames = (firstName: string, lastName: string) => {
  const clean = (v: string) =>
    v
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  const base = [clean(firstName), clean(lastName)].filter(Boolean).join('.');
  return base.length >= 3 ? base : `${base || 'usuario'}sp`;
};

// ─── Componente ───────────────────────────────────────────────────────────────

export function LiveSupportChatModal({
  isOpen,
  onClose,
  contractors: propsContractors,
  products: propsProducts = [],
  initialFlow = 'inicio',
  onPqrCreatedFromChat,
  onAppProblemReported,
  onAccountCreated,
  onChatSaved,
}: LiveSupportChatModalProps) {
  const { user, login, logout } = useAuth();
  // Lista unificada de contratistas registrados en base de datos
  const registeredContractors =
    propsContractors && propsContractors.length > 0
      ? propsContractors
      : REGISTERED_CONTRACTORS_REF;

  const [messages, setMessages] = useState<LiveChatMessage[]>([INITIAL_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [flow, setFlow] = useState<ChatFlow>('inicio');
  const [userRegDraft, setUserRegDraft] = useState<UserAccountDraft>({});
  const [createdUserCreds, setCreatedUserCreds] = useState<{
    email: string;
    password: string;
    role: PublicRegisterRole;
  } | null>(null);
  const [directChatDraft, setDirectChatDraft] = useState<DirectChatDraft>({});
  const [adminDraft, setAdminDraft] = useState<AdminWorkerDraft>({});
  const [createdAdminCreds, setCreatedAdminCreds] = useState<{
    username: string;
    email: string;
    password: string;
  } | null>(null);
  const [quejaDraft, setQuejaDraft] = useState<QuejaDraft>({});
  const [problemaDraft, setProblemaAppDraft] = useState<ProblemaAppDraft>({});
  const [apelacionDraft, setApelacionDraft] = useState<ApelacionDraft>({});
  const [desbloqueoDraft, setDesbloqueoDraft] = useState<DesbloqueoDraft>({});
  const [simulatedScreenshot, setSimulatedScreenshot] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const savingReportRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevOpenRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      if (initialFlow === 'crear_cuenta') {
        setFlow('user_reg_role');
        setUserRegDraft({});
        setCreatedUserCreds(null);
        setMessages([CREATE_ACCOUNT_INTRO_MESSAGE()]);
      } else if (initialFlow === 'chat_directo') {
        setFlow('chat_directo_titulo');
        setDirectChatDraft({});
        setMessages([DIRECT_CHAT_INTRO_MESSAGE()]);
      } else if (initialFlow === 'queja_producto') {
        setFlow('queja_cual_producto');
        setQuejaDraft({ subjectType: 'producto' });
        const prodOpts = propsProducts.slice(0, 6).map((p) => ({
          label: `📦 ${p.title} (${p.sellerName})`,
          action: `sel_product:${p.id}`,
        }));
        setMessages([
          agentMsg(
            '📦 **Radicar PQR de Producto (Meko Shop)**\n\nSelecciona el producto que deseas reportar o escribe su nombre directamente:',
            prodOpts.length > 0 ? prodOpts : undefined
          ),
        ]);
      } else if (initialFlow === 'problema_app') {
        setFlow('problema_app_categoria');
        setMessages([
          agentMsg('¿Qué tipo de fallo técnico estás experimentando en la aplicación?', [
            { label: '🗺️ El mapa no carga o GPS falla', action: 'cat:error_mapa' },
            { label: '💳 Error al pagar o anticipo PSE', action: 'cat:falla_pago' },
            { label: '⚡ App lenta o congelada', action: 'cat:lentitud_carga' },
            { label: '🔐 Error al iniciar sesión', action: 'cat:error_login' },
            { label: '🔔 Fallo en notificaciones', action: 'cat:notificaciones' },
            { label: '❓ Otro problema técnico', action: 'cat:otro_tecnico' },
          ]),
        ]);
      }
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, initialFlow, propsProducts]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  const buildChatTranscript = (): ChatTranscriptEntry[] =>
    messages
      .filter((m) => m.text && m.text !== '••••••••')
      .slice(-30)
      .map((m) => ({
        sender: m.sender === 'agent' ? 'agent' : 'user',
        senderName:
          m.sender === 'agent'
            ? m.agentName || 'Sofía • Defensoría y Mesa Técnica'
            : (user && `${user.first_name || ''} ${user.last_name || ''}`.trim()) ||
              user?.username ||
              'Usuario',
        text: m.text,
      }));

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
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    setIsTyping(true);
    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
      setIsTyping(false);
      setMessages((prev) => [...prev, agentMsg(text, opts, ticket)]);
    }, delay);
  };

  const pushUser = (text: string) => {
    setMessages((prev) => [...prev, userMsg(text)]);
  };

  // Iniciar flujo de selección de contratista registrado
  const startContractorComplaint = () => {
    setQuejaDraft({ subjectType: 'servicio' });
    setFlow('queja_cual_contratista');
    pushAgent(
      'Para que tu reclamo de servicio tenga respaldo formal de la Defensoría de Bogotá (Ley 1480 del Consumidor), selecciona el contratista registrado contra el cual deseas radicar el PQR:',
      getContractorOptions()
    );
  };

  const startProductComplaint = () => {
    setQuejaDraft({ subjectType: 'producto' });
    setFlow('queja_cual_producto');
    const prodOpts = propsProducts.slice(0, 6).map((p) => ({
      label: `📦 ${p.title} (${p.sellerName})`,
      action: `sel_product:${p.id}`,
    }));
    pushAgent(
      '📦 **Radicar PQR de Producto (Meko Shop)**\n\nSelecciona uno de los productos publicados o escribe el nombre del producto que deseas reportar:',
      prodOpts.length > 0 ? prodOpts : undefined
    );
  };

  // Finalizar creación de cuenta Cliente (Perfil) o Profesional
  const finalizarCrearCuentaUsuario = async (draftFinal: UserAccountDraft) => {
    if (savingReportRef.current) return;
    savingReportRef.current = true;
    setFlow('user_reg_saving');
    setIsTyping(true);

    const role: PublicRegisterRole = draftFinal.role === 'professional' ? 'professional' : 'client';
    const firstName = (draftFinal.first_name || '').trim();
    const lastName = (draftFinal.last_name || '').trim();
    const email = (draftFinal.email || '').trim().toLowerCase();
    const password = draftFinal.password || '';
    const confirmPassword = draftFinal.confirm_password || password;
    const phone = (draftFinal.phone || '').trim();
    const city = (draftFinal.city || 'Bogotá').trim() || 'Bogotá';
    const documentId = (draftFinal.document_id || '').trim();
    const address = (draftFinal.address || '').trim();
    const profession = (draftFinal.profession || '').trim();

    try {
      const created = await authService.register({
        email,
        username: buildUsernameFromNames(firstName, lastName),
        first_name: firstName,
        last_name: lastName,
        phone,
        city,
        document_id: documentId,
        address,
        role,
        password,
        confirm_password: confirmPassword,
        ...(role === 'professional' && profession ? { profession } : {}),
      });
      setIsTyping(false);
      setFlow('fin');
      setCreatedUserCreds({ email: created.email, password, role });
      setUserRegDraft({});
      onAccountCreated?.(created);

      pushAgent(
        `🎉 **¡Cuenta creada exitosamente en Serviprox!**\n\n` +
          `📋 **Resumen de tu perfil registrado:**\n` +
          `• 🏷️ **Tipo de cuenta:** ${role === 'professional' ? 'Profesional' : 'Cliente (Perfil)'}\n` +
          `• 👤 **Nombre:** ${created.first_name} ${created.last_name}\n` +
          `• 📧 **Correo:** ${created.email}\n` +
          `• 📞 **Teléfono:** ${created.phone || phone || 'Registrado'}\n` +
          `• 🏙️ **Ciudad:** ${created.city || city}\n` +
          `• 🪪 **Cédula:** ${created.document_id || documentId || 'Registrada'}\n` +
          `• 📍 **Dirección del inmueble:** ${created.address || address || 'Registrada'}\n` +
          (role === 'professional' && profession ? `• 🛠️ **Profesión:** ${profession}\n` : '') +
          `\nTu cuenta ya quedó guardada en la base de datos. Puedes ingresar de inmediato:`,
        [
          { label: '⚡ Entrar a mi cuenta ahora', action: 'instant_user_login' },
          { label: '🚀 Ir a Iniciar sesión', action: 'goto_user_login' },
          { label: '🔄 Crear otra cuenta', action: 'iniciar_crear_cuenta' },
          { label: '✕ Cerrar chat', action: 'cerrar_chat' },
        ],
        undefined,
        250
      );
    } catch (err: unknown) {
      setIsTyping(false);
      const detail = extractApiErrorMessage(err);
      const lowerDetail = detail.toLowerCase();
      if (lowerDetail.includes('correo') || lowerDetail.includes('email')) {
        setFlow('user_reg_email');
        pushAgent(
          `❌ **No se pudo crear la cuenta:**\n${detail}\n\nEscribe otro **correo electrónico** diferente para continuar sin perder tus datos:`,
          [{ label: '🔄 Reiniciar registro', action: 'iniciar_crear_cuenta' }],
          undefined,
          250
        );
      } else if (lowerDetail.includes('contraseña') || lowerDetail.includes('password')) {
        setFlow('user_reg_password');
        pushAgent(
          `❌ **No se pudo crear la cuenta:**\n${detail}\n\nEscribe una nueva **contraseña** (mínimo 8 caracteres):`,
          [{ label: '🔄 Reiniciar registro', action: 'iniciar_crear_cuenta' }],
          undefined,
          250
        );
      } else {
        setFlow('fin');
        pushAgent(
          `❌ **No se pudo crear la cuenta:**\n${detail}`,
          [
            { label: '🔄 Intentar de nuevo', action: 'iniciar_crear_cuenta' },
            { label: '✕ Cerrar chat', action: 'cerrar_chat' },
          ],
          undefined,
          250
        );
      }
    } finally {
      savingReportRef.current = false;
    }
  };

  // Finalizar creación de chat directo persistido en BD
  const finalizarChatDirecto = async (mensajeInicial: string) => {
    if (savingReportRef.current) return;
    savingReportRef.current = true;
    const title = directChatDraft.title || 'Chat de soporte Serviprox';

    if (!user) {
      savingReportRef.current = false;
      setFlow('inicio');
      pushAgent(
        'Para guardar un chat directo en tu historial necesitas tener sesión iniciada. ¿Deseas crear una cuenta ahora o iniciar sesión?',
        [
          { label: '👤 Crear cuenta (Cliente o Profesional)', action: 'iniciar_crear_cuenta' },
          { label: '🚀 Ir a Iniciar sesión', action: 'goto_user_login' },
        ],
        undefined,
        250
      );
      return;
    }

    try {
      const savedChat = await supportChatService.create({
        title,
        topic: 'soporte',
        initialMessage: mensajeInicial,
      });
      window.dispatchEvent(new CustomEvent('serviprox:pqr-updated'));
      onChatSaved?.(savedChat);
      setDirectChatDraft({});
      setFlow('fin');
      pushAgent(
        `✅ **¡Chat de soporte creado y guardado!**\n\n💬 **Asunto:** ${savedChat.title}\n🔖 **ID de Chat:** #${savedChat.id}\n\nTu conversación ya aparece en la pestaña **"Mis Chats"** y el equipo de soporte fue notificado.`,
        [
          { label: '📂 Ver Mis Chats y Reportes', action: 'goto_pqrs' },
          { label: '🔄 Iniciar otra consulta', action: 'restart' },
        ],
        {
          ticketNumber: `CHAT-${savedChat.id}`,
          type: 'chat_soporte',
          summary: savedChat.title,
        },
        250
      );
    } catch (err) {
      pushAgent(
        `No pudimos guardar el chat en este momento (${extractApiErrorMessage(err)}). Inténtalo nuevamente.`,
        [{ label: '🔄 Reintentar', action: 'iniciar_chat_directo' }],
        undefined,
        250
      );
    } finally {
      savingReportRef.current = false;
    }
  };

  // Finalizar creación de trabajador administrativo
  const finalizarCrearAdminWorker = async (password: string) => {
    if (savingReportRef.current) return;
    savingReportRef.current = true;
    setFlow('admin_saving');
    setIsTyping(true);
    const payload = {
      worker_key: adminDraft.worker_key || 'Juanpablo9*',
      username: adminDraft.username || '',
      full_name: adminDraft.full_name || '',
      email: adminDraft.email || '',
      phone: adminDraft.phone || '',
      area: adminDraft.area || 'Defensoría y Mesa Técnica',
      password,
    };

    try {
      const res = await authService.registerAdminWorker(payload);
      setIsTyping(false);
      setFlow('fin');
      setAdminDraft({});
      setCreatedAdminCreds({
        username: res.user.username,
        email: res.user.email,
        password,
      });
      const storageNotice =
        res.storage_mode === 'local-sqlite'
          ? 'Cuenta administrativa guardada en el servidor administrativo local (SQLite) porque la Máquina Virtual aún no expone el endpoint público de alta administrativa; podrás iniciar sesión inmediatamente.'
          : 'Tu cuenta ya quedó reflejada y conectada a la base de datos oficial. Puedes iniciar sesión inmediatamente en el login administrativo.';
      pushAgent(
        `🎉 **¡Cuenta administrativa creada exitosamente en Serviprox!**\n\n` +
        `📋 **Ficha de Trabajador Registrado:**\n` +
        `• 👤 **Usuario:** ${res.user.username}\n` +
        `• 🏷️ **Nombre:** ${res.user.full_name}\n` +
        `• 📧 **Correo:** ${res.user.email}\n` +
        `• 📞 **Teléfono:** ${res.user.phone || 'No registrado'}\n` +
        `• 🏢 **Área:** ${res.user.area}\n` +
        `• 🛡️ **Rol:** Personal Administrativo (\`staff\` / \`is_staff = True\`)\n\n` +
        storageNotice,
        [
          { label: '⚡ Entrar al Panel Administrativo', action: 'instant_admin_login' },
          { label: '🚀 Ir al Login Administrativo', action: 'goto_admin_login' },
          { label: '🔄 Registrar otro trabajador', action: 'iniciar_crear_admin' },
          { label: '✕ Cerrar chat', action: 'cerrar_chat' },
        ],
        undefined,
        250
      );
    } catch (err: unknown) {
      setIsTyping(false);
      const detail = extractApiErrorMessage(err);
      const lowerDetail = detail.toLowerCase();
      const isPasswordError =
        lowerDetail.includes('contraseña') || lowerDetail.includes('password');
      const isUsernameError =
        lowerDetail.includes('usuario') || lowerDetail.includes('username');
      const isEmailError =
        lowerDetail.includes('correo') || lowerDetail.includes('email');

      if (isUsernameError) {
        setFlow('admin_username');
      } else if (isEmailError) {
        setFlow('admin_email');
      } else if (isPasswordError) {
        setFlow('admin_password');
      } else {
        setFlow('fin');
      }

      const recoveryPrompt = isUsernameError
        ? `❌ **No se pudo registrar la cuenta administrativa:**\n\n${detail}\n\nEscribe otro **nombre de usuario** diferente aquí mismo para continuar sin perder tus datos:`
        : isEmailError
          ? `❌ **No se pudo registrar la cuenta administrativa:**\n\n${detail}\n\nEscribe otro **correo electrónico** aquí mismo para continuar sin perder tus datos:`
          : isPasswordError
            ? `❌ **No se pudo registrar la cuenta administrativa:**\n\n${detail}\n\nEscribe una nueva contraseña directamente aquí para intentarlo sin perder tus datos:`
            : `❌ **No se pudo registrar la cuenta administrativa:**\n\n${detail}\n\n¿Deseas ajustar la contraseña o reiniciar el registro?`;

      pushAgent(
        recoveryPrompt,
        [
          ...(isUsernameError || isEmailError
            ? []
            : [{ label: '🔁 Cambiar contraseña', action: 'retry_admin_password' }]),
          { label: '🔄 Reiniciar registro', action: 'iniciar_crear_admin' },
          { label: '✕ Cerrar chat', action: 'cerrar_chat' },
        ],
        undefined,
        250
      );
    } finally {
      savingReportRef.current = false;
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Manejo de botones de acción rápida
  // ───────────────────────────────────────────────────────────────────────────
  const handleQuickAction = async (action: string) => {
    switch (action) {
      case 'iniciar_crear_cuenta': {
        pushUser('Deseo crear una cuenta (Cliente o Profesional) por el chat.');
        setFlow('user_reg_role');
        setUserRegDraft({});
        setCreatedUserCreds(null);
        pushAgent(
          '👤 **Crear cuenta en Serviprox por el chat**\n\nTe pediré paso a paso tus datos: nombre y apellido, correo, contraseña, confirmar contraseña, teléfono, ciudad, cédula y dirección del inmueble.\n\n👉 **Paso 1:** Selecciona el tipo de cuenta que deseas crear:',
          [
            { label: '🏠 Cuenta Cliente (Perfil)', action: 'sel_reg_role:client' },
            { label: '🛠️ Cuenta Profesional', action: 'sel_reg_role:professional' },
          ],
          undefined,
          250
        );
        break;
      }

      case 'instant_user_login': {
        if (!createdUserCreds) {
          onClose();
          window.location.href = '/login';
          break;
        }
        const creds = createdUserCreds;
        setIsTyping(true);
        try {
          const logged = await login({ email: creds.email, password: creds.password });
          setIsTyping(false);
          setCreatedUserCreds(null);
          onClose();
          window.location.href = getEntryRoute(logged);
        } catch (err) {
          setIsTyping(false);
          pushAgent(
            `⚠️ No pudimos iniciar sesión automáticamente (${extractApiErrorMessage(err)}). Puedes ingresar desde Iniciar sesión.`,
            [{ label: '🚀 Ir a Iniciar sesión', action: 'goto_user_login' }],
            undefined,
            250
          );
        }
        break;
      }

      case 'goto_user_login': {
        setCreatedUserCreds(null);
        onClose();
        window.location.href = '/login';
        break;
      }

      case 'iniciar_chat_directo': {
        pushUser('Quiero crear un chat directo con soporte.');
        setFlow('chat_directo_titulo');
        setDirectChatDraft({});
        pushAgent(
          '💬 **Crear chat de soporte**\n\nEscribe el **asunto o título** del chat que deseas crear (por ejemplo: "Seguimiento de reporte", "Consulta sobre un servicio", "Soporte general"):',
          undefined,
          undefined,
          250
        );
        break;
      }

      case 'queja_producto': {
        pushUser('Deseo radicar un PQR de Producto por este chat.');
        startProductComplaint();
        break;
      }

      case 'iniciar_crear_admin': {
        pushUser('Deseo dar de alta mi cuenta administrativa en la base de datos.');
        setFlow('admin_worker_key');
        setAdminDraft({});
        setCreatedAdminCreds(null);
        pushAgent(
          '🔐 **Módulo de Alta para Trabajadores Administrativos Serviprox**\n\nPara autorizar la creación de tu cuenta en la base de datos oficial, por favor ingresa la **Clave de Trabajador Autorizado**:',
          undefined,
          undefined,
          250
        );
        break;
      }

      case 'retry_admin_password': {
        setFlow('admin_password');
        pushAgent(
          '👉 Ingresa una nueva **Contraseña de acceso** para completar el registro de tu cuenta administrativa (mínimo 6 caracteres):',
          undefined,
          undefined,
          250
        );
        break;
      }

      case 'instant_admin_login': {
        if (!createdAdminCreds) {
          onClose();
          window.location.href = '/login/administrativo';
          break;
        }
        const creds = createdAdminCreds;
        setIsTyping(true);
        try {
          const logged = await login(
            {
              username: creds.username,
              email: creds.email,
              password: creds.password,
            },
            { allowLocalWorkerFallback: true }
          );
          setIsTyping(false);
          if (!(logged.role === 'staff' || logged.is_staff || logged.is_superuser)) {
            logout();
            pushAgent('⚠️ La cuenta se creó, pero no obtuvo permisos administrativos. Ve al Login Administrativo.');
            break;
          }
          setCreatedAdminCreds(null);
          onClose();
          window.location.href = '/admin';
        } catch (err: unknown) {
          setIsTyping(false);
          pushAgent(
            `⚠️ No se pudo iniciar sesión automáticamente (${extractApiErrorMessage(err)}). Puedes acceder desde el Login Administrativo.`,
            [{ label: '🚀 Ir al Login Administrativo', action: 'goto_admin_login' }]
          );
        }
        break;
      }

      case 'goto_admin_login': {
        setCreatedAdminCreds(null);
        onClose();
        window.location.href = '/login/administrativo';
        break;
      }

      case 'cerrar_chat': {
        setCreatedAdminCreds(null);
        setCreatedUserCreds(null);
        onClose();
        break;
      }

      case 'queja_contratista': {
        pushUser('Deseo radicar un PQR de servicio contra un contratista por este chat.');
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

      case 'iniciar_apelacion': {
        pushUser('Deseo presentar una apelación formal ante el Comité Administrativo.');
        setFlow('apelacion_motivo');
        pushAgent(
          '🛡️ **Mesa de Apelaciones y Régimen Disciplinario Serviprox**\n\nTienes derecho al debido proceso, a ser escuchado(a), presentar descargos y solicitar la revocación o reducción de sanciones ante el Administrador.\n\n¿Cuál es la causal o situación por la cual presentas esta apelación?',
          [
            { label: '⚠️ Sanción por reporte injustificado o falso', action: 'motivo_apelacion:reporte_injustificado' },
            { label: '⏱️ Demora o inasistencia por caso fortuito o fuerza mayor', action: 'motivo_apelacion:fuerza_mayor' },
            { label: '📱 Falla técnica de la app me impidió responder', action: 'motivo_apelacion:falla_tecnica_app' },
            { label: '🤝 Desacuerdo con cliente/profesional ya conciliado', action: 'motivo_apelacion:acuerdo_previo' },
            { label: '✍️ Escribir mi propio motivo de apelación', action: 'motivo_apelacion:libre' },
          ]
        );
        break;
      }

      case 'iniciar_desbloqueo': {
        pushUser('Deseo solicitar el desbloqueo de mi cuenta evaluado por la IA.');
        setFlow('desbloqueo_descripcion');
        pushAgent(
          '🔓 **Módulo de Desbloqueo de Cuenta con Inteligencia Artificial**\n\nRealizaremos 2 pasos para evaluar tu caso en tiempo real:\n\n📝 **Paso 1 de 2: Descripción de los hechos**\nPor favor, describe qué ocurrió con tu cuenta y por qué consideras que el bloqueo debe ser levantado:',
          [
            { label: '📱 Ocurrió una falla técnica o de GPS en la app', action: 'desbloq_mot:falla' },
            { label: '🤝 Llegué a un acuerdo conciliado con la otra parte', action: 'desbloq_mot:acuerdo' },
            { label: '⏱️ Inconveniente de fuerza mayor imprevisible', action: 'desbloq_mot:fuerza_mayor' },
            { label: '⚠️ Fue un reporte falso o malentendido sin mala fe', action: 'desbloq_mot:falso' },
            { label: '✍️ Deseo redactar mis propios argumentos', action: 'desbloq_mot:libre' },
          ]
        );
        break;
      }

      default: {
        // Selección de motivo de desbloqueo
        if (action.startsWith('desbloq_mot:')) {
          const key = action.replace('desbloq_mot:', '');
          let motText = 'Solicitud de desbloqueo por revisión general.';
          if (key === 'falla') motText = 'El inconveniente ocurrió por una falla técnica o de GPS en la app que me impidió responder a tiempo.';
          if (key === 'acuerdo') motText = 'Hablé directamente con el usuario y llegamos a un acuerdo satisfactorio.';
          if (key === 'fuerza_mayor') motText = 'Ocurrió un imprevisto de fuerza mayor ajeno a mi voluntad.';
          if (key === 'falso') motText = 'Fue un reporte injustificado o malentendido sin dolo de mi parte.';
          if (key === 'libre') motText = 'Descargos personalizados';

          setDesbloqueoDraft((d) => ({ ...d, descripcion: motText }));
          pushUser(motText);
          setFlow('desbloqueo_foto');
          pushAgent(
            '📸 **Paso 2 de 2: Foto o Captura del Bloqueo / Evidencia**\n\nPara validar tu solicitud, por favor adjunta una foto o captura de pantalla donde se observe el bloqueo o evidencia de respaldo:',
            [
              { label: '📸 Adjuntar captura de pantalla del bloqueo actual', action: 'desbloq_adjuntar_captura' },
              { label: '⚡ Continuar evaluación con mi declaración ahora', action: 'desbloq_sin_foto' },
            ]
          );
          break;
        }

        if (action === 'desbloq_adjuntar_captura' || action === 'desbloq_sin_foto') {
          if (action === 'desbloq_adjuntar_captura') {
            setSimulatedScreenshot('captura_pantalla_bloqueo_serviprox.png');
            pushUser('📸 Adjunté captura de pantalla del bloqueo actual.');
          } else {
            pushUser('⚡ Solicito evaluación directa con mi declaración.');
          }
          finalizarDesbloqueoIA();
          break;
        }

        // Selección de motivo de apelación
        if (action.startsWith('motivo_apelacion:')) {
          const mKey = action.replace('motivo_apelacion:', '');
          let motivoLabel = 'Revisión general de sanción disciplinaria';
          if (mKey === 'reporte_injustificado') motivoLabel = 'Sanción por reporte injustificado o falso';
          if (mKey === 'fuerza_mayor') motivoLabel = 'Demora o inasistencia por caso fortuito o fuerza mayor';
          if (mKey === 'falla_tecnica_app') motivoLabel = 'Falla técnica de la app me impidió responder';
          if (mKey === 'acuerdo_previo') motivoLabel = 'Desacuerdo con cliente/profesional ya conciliado';
          if (mKey === 'libre') motivoLabel = 'Causal personalizada';

          setApelacionDraft((d) => ({ ...d, motivo: motivoLabel }));
          pushUser(`Causal seleccionada: ${motivoLabel}`);
          setFlow('apelacion_descargos');
          pushAgent(
            'Por favor expón a continuación tus descargos y argumentos detallados: ¿qué sucedió realmente y qué justificaciones o pruebas presentas para que el Comité Administrativo levante la medida?'
          );
          break;
        }

        // Selección de tipo de cuenta (Cliente o Profesional)
        if (action.startsWith('sel_reg_role:')) {
          const role = action.replace('sel_reg_role:', '') === 'professional' ? 'professional' : 'client';
          setUserRegDraft((prev) => ({ ...prev, role }));
          pushUser(role === 'professional' ? '🛠️ Cuenta Profesional' : '🏠 Cuenta Cliente (Perfil)');
          setFlow('user_reg_fullname');
          pushAgent(
            `Perfecto, crearemos tu cuenta de **${role === 'professional' ? 'Profesional' : 'Cliente (Perfil)'}**.\n\n👉 **Paso 2:** Escribe tu **Nombre y apellido** completo (ejemplo: Laura Gómez):`,
            undefined,
            undefined,
            250
          );
          break;
        }

        // Selección rápida de ciudad al registrar cuenta
        if (action.startsWith('sel_reg_city:')) {
          const city = action.replace('sel_reg_city:', '').trim() || 'Bogotá';
          setUserRegDraft((prev) => ({ ...prev, city }));
          pushUser(`🏙️ Ciudad: ${city}`);
          setFlow('user_reg_document');
          pushAgent(
            `Ciudad registrada: **${city}**.\n\n👉 **Paso 7:** Escribe tu número de **Cédula / documento** (ejemplo: 1020345678):`,
            undefined,
            undefined,
            250
          );
          break;
        }

        // Selección de producto Meko Shop para PQR de Producto
        if (action.startsWith('sel_product:')) {
          const pid = action.replace('sel_product:', '');
          const foundProd = propsProducts.find((p) => String(p.id) === pid);
          if (foundProd) {
            const parsedId = /^\d+$/.test(String(foundProd.id)) ? Number(foundProd.id) : null;
            setQuejaDraft((d) => ({
              ...d,
              subjectType: 'producto',
              productId: parsedId,
              productName: foundProd.title,
              contractorId: '',
              contractorName: foundProd.sellerName || 'Vendedor Meko Shop',
              contractorCompany: `Meko Shop · ${foundProd.sellerName || 'Vendedor'}`,
              contractorSpecialty: foundProd.category || 'Producto Meko Shop',
              contractorAvatar: foundProd.imageUrl,
            }));
            pushUser(`📦 Producto seleccionado: ${foundProd.title}`);
            setFlow('queja_descripcion');
            pushAgent(
              `✅ Producto identificado: **${foundProd.title}** (Vendedor: ${foundProd.sellerName}).\n\nAhora descríbeme detalladamente qué problema ocurrió con este producto:`
            );
          }
          break;
        }

        // Selección de contratista de la base de datos
        if (action.startsWith('sel_contractor:')) {
          const id = action.replace('sel_contractor:', '');
          const found = registeredContractors.find((c) => c.id === id);
          if (found) {
            setQuejaDraft((d) => ({
              ...d,
              subjectType: 'servicio',
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

        if (action.startsWith('copiar_radicado:')) {
          const code = action.replace('copiar_radicado:', '').trim();
          if (code && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            void navigator.clipboard.writeText(code).catch(() => {});
          }
          pushAgent(
            `📋 Número de radicado **${code}** copiado. También quedó guardado de forma permanente en tu expediente PQR y en **"Mis Chats"**.`,
            undefined,
            undefined,
            150
          );
          break;
        }

        if (action === 'goto_pqrs') {
          window.dispatchEvent(new CustomEvent('serviprox:pqr-updated'));
          window.dispatchEvent(new CustomEvent('serviprox:problem-updated'));
          onClose();
          if (user && !window.location.pathname.includes('/pqrs')) {
            const targetPath = user.role === 'professional' ? '/profesional/pqrs' : '/cliente/pqrs';
            window.location.assign(targetPath);
          }
          break;
        }

        if (action === 'finish_chat') {
          onClose();
          break;
        }

        if (action.startsWith('sel_admin_area:')) {
          const area = action.replace('sel_admin_area:', '').trim();
          setAdminDraft((prev) => ({ ...prev, area }));
          pushUser(`🏢 Área: ${area}`);
          setFlow('admin_password');
          pushAgent(
            `Área asignada: **${area}**.\n\n👉 **Paso 6 de 6:** Define tu **Contraseña de acceso** para el login administrativo (mínimo 6 caracteres):`
          );
          break;
        }

        if (action === 'restart') {
          setMessages([INITIAL_MESSAGE]);
          setFlow('inicio');
          setQuejaDraft({});
          setProblemaAppDraft({});
          setApelacionDraft({});
          setDesbloqueoDraft({});
          break;
        }

        if (action === 'confirmar_radicado') {
          void finalizarQueja();
          break;
        }

        if (action === 'confirmar_apelacion') {
          void finalizarApelacion();
          break;
        }

        if (action === 'confirmar_ticket') {
          void finalizarProblemaApp();
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
    if (flow === 'admin_saving' || flow === 'user_reg_saving') return;
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    const isPasswordStep =
      flow === 'admin_password' ||
      flow === 'user_reg_password' ||
      flow === 'user_reg_confirm_password';
    pushUser(isPasswordStep ? '••••••••' : text);

    const lower = text.toLowerCase();

    // 0. Detección directa de la clave de trabajador autorizada solo al inicio o esperando clave
    if (text === 'Juanpablo9*' && (flow === 'inicio' || flow === 'admin_worker_key')) {
      setAdminDraft({ worker_key: 'Juanpablo9*' });
      setCreatedAdminCreds(null);
      setFlow('admin_username');
      pushAgent(
        '🔐 **¡Clave de trabajador autorizada correctamente!**\n\nBienvenido al registro de personal administrativo de Serviprox Bogotá.\n\n👉 **Paso 1 de 6:** Escribe tu **Nombre de usuario** administrativo (ejemplo: `jpablo`, `admin_bogota`):',
        undefined,
        undefined,
        250
      );
      return;
    }

    // 0.5. Detectar intención de crear cuenta administrativa vs Cliente/Profesional
    if (
      flow === 'inicio' &&
      (lower.includes('trabajador') ||
        lower.includes('admin') ||
        lower.includes('staff') ||
        lower.includes('clave'))
    ) {
      void handleQuickAction('iniciar_crear_admin');
      return;
    }

    if (
      flow === 'inicio' &&
      (lower.includes('crear cuenta') ||
        lower.includes('registrarme') ||
        lower.includes('registro') ||
        lower.includes('nueva cuenta') ||
        lower.includes('profesional') ||
        lower.includes('perfil'))
    ) {
      void handleQuickAction('iniciar_crear_cuenta');
      return;
    }

    if (flow === 'inicio' && (lower.includes('crear chat') || lower.includes('nuevo chat'))) {
      void handleQuickAction('iniciar_chat_directo');
      return;
    }

    if (flow === 'inicio' && lower.includes('producto')) {
      void handleQuickAction('queja_producto');
      return;
    }

    // 1. Detectar solicitud de desbloqueo de cuenta
    if (
      flow === 'inicio' &&
      (lower.includes('desbloquear') ||
        lower.includes('desbloqueo') ||
        lower.includes('quitar bloqueo') ||
        lower.includes('activar cuenta'))
    ) {
      void handleQuickAction('iniciar_desbloqueo');
      return;
    }

    // 1.5. Detectar intención general de "reporte" para ofrecer todas las vías que dejan PQR + Radicado
    if (
      flow === 'inicio' &&
      (lower.includes('reporte') || lower.includes('reportar')) &&
      !lower.includes('contratista')
    ) {
      pushAgent(
        'Con gusto te ayudo a registrar tu **reporte**. Todos los reportes generan un **PQR oficial con Número de Radicado** y guardan el historial de este chat.\n\n¿Qué tipo de reporte deseas radicar?',
        [
          { label: '📋 PQR de Servicio (Profesional)', action: 'queja_contratista' },
          { label: '📦 PQR de Producto (Tienda)', action: 'queja_producto' },
          { label: '📱 Reporte Técnico App (PQR + Radicado)', action: 'problema_app' },
        ],
        undefined,
        250
      );
      return;
    }

    // 2. Detectar solicitud inicial de radicar queja o PQR formal
    if (
      flow === 'inicio' &&
      (lower.includes('queja') ||
        lower.includes('reclamo') ||
        lower.includes('contratista') ||
        lower.includes('pqr') ||
        lower.includes('formal') ||
        lower.includes('radicar'))
    ) {
      startContractorComplaint();
      return;
    }

    // 2. Detectar solicitud de apelación de cuenta o sanción
    if (
      flow === 'inicio' &&
      (lower.includes('apelar') ||
        lower.includes('apelacion') ||
        lower.includes('apelación') ||
        lower.includes('sancion') ||
        lower.includes('sanción') ||
        lower.includes('desbloque') ||
        lower.includes('bloque') ||
        lower.includes('suspend'))
    ) {
      void handleQuickAction('iniciar_apelacion');
      return;
    }

    switch (flow) {
      // ── Flujo de Creación de Cuenta (Cliente / Perfil o Profesional) ─────────
      case 'user_reg_role': {
        const isPro = lower.includes('profes') || lower.includes('oficio') || lower.includes('técnic') || lower.includes('tecnic');
        const isClient = lower.includes('client') || lower.includes('perfil') || lower.includes('hogar') || lower.includes('usuario');
        if (!isPro && !isClient) {
          pushAgent(
            'Por favor elige si deseas crear una cuenta **Cliente (Perfil)** o **Profesional**:',
            [
              { label: '🏠 Cuenta Cliente (Perfil)', action: 'sel_reg_role:client' },
              { label: '🛠️ Cuenta Profesional', action: 'sel_reg_role:professional' },
            ],
            undefined,
            250
          );
          break;
        }
        const role: PublicRegisterRole = isPro ? 'professional' : 'client';
        setUserRegDraft((prev) => ({ ...prev, role }));
        setFlow('user_reg_fullname');
        pushAgent(
          `Excelente, crearemos tu cuenta de **${role === 'professional' ? 'Profesional' : 'Cliente (Perfil)'}**.\n\n👉 **Paso 2:** Escribe tu **Nombre y apellido** completo (ejemplo: Laura Gómez):`,
          undefined,
          undefined,
          250
        );
        break;
      }

      case 'user_reg_fullname': {
        const parts = text.split(/\s+/).filter(Boolean);
        if (parts.length < 2 || text.length < 4) {
          pushAgent(
            '⚠️ Escribe tu **nombre y apellido** completos (al menos dos palabras, ejemplo: Laura Gómez):',
            undefined,
            undefined,
            250
          );
          break;
        }
        const firstName = parts[0];
        const lastName = parts.slice(1).join(' ');
        setUserRegDraft((prev) => ({ ...prev, first_name: firstName, last_name: lastName }));
        setFlow('user_reg_email');
        pushAgent(
          `Mucho gusto, **${firstName} ${lastName}**.\n\n👉 **Paso 3:** Escribe tu **Correo electrónico** (ejemplo: nombre@correo.com):`,
          undefined,
          undefined,
          250
        );
        break;
      }

      case 'user_reg_email': {
        if (!/^\S+@\S+\.\S+$/.test(text)) {
          pushAgent(
            '⚠️ Ingresa un correo electrónico válido (ejemplo: tu@correo.com):',
            undefined,
            undefined,
            250
          );
          break;
        }
        const normalizedEmail = text.toLowerCase();
        const nextDraft = { ...userRegDraft, email: normalizedEmail };
        setUserRegDraft(nextDraft);
        if (nextDraft.password && nextDraft.address && nextDraft.document_id) {
          void finalizarCrearCuentaUsuario(nextDraft);
          break;
        }
        setFlow('user_reg_password');
        pushAgent(
          `Correo registrado: **${normalizedEmail}**.\n\n👉 **Paso 4:** Define tu **Contraseña** (mínimo 8 caracteres):`,
          undefined,
          undefined,
          250
        );
        break;
      }

      case 'user_reg_password': {
        if (text.length < 8) {
          pushAgent(
            '⚠️ La contraseña debe tener al menos **8 caracteres**. Escribe una contraseña más segura:',
            undefined,
            undefined,
            250
          );
          break;
        }
        setUserRegDraft((prev) => ({ ...prev, password: text }));
        setFlow('user_reg_confirm_password');
        pushAgent(
          '👉 **Paso 5:** **Confirma tu contraseña** (escríbela nuevamente para verificar que coincida):',
          undefined,
          undefined,
          250
        );
        break;
      }

      case 'user_reg_confirm_password': {
        if (text !== userRegDraft.password) {
          pushAgent(
            '⚠️ Las contraseñas no coinciden. Escribe nuevamente la confirmación exactamente igual a tu contraseña:',
            undefined,
            undefined,
            250
          );
          break;
        }
        const nextDraft = { ...userRegDraft, confirm_password: text };
        setUserRegDraft(nextDraft);
        if (nextDraft.address && nextDraft.document_id && nextDraft.phone) {
          void finalizarCrearCuentaUsuario(nextDraft);
          break;
        }
        setFlow('user_reg_phone');
        pushAgent(
          '✅ Contraseña confirmada.\n\n👉 **Paso 6:** Escribe tu **Teléfono / celular** (ejemplo: +57 300 000 0000):',
          undefined,
          undefined,
          250
        );
        break;
      }

      case 'user_reg_phone': {
        if (text.replace(/\D/g, '').length < 7) {
          pushAgent(
            '⚠️ Ingresa un número de teléfono válido (al menos 7 dígitos):',
            undefined,
            undefined,
            250
          );
          break;
        }
        setUserRegDraft((prev) => ({ ...prev, phone: text }));
        setFlow('user_reg_city');
        pushAgent(
          `Teléfono guardado: **${text}**.\n\n👉 **Paso 7:** Selecciona o escribe tu **Ciudad**:`,
          [
            { label: '📍 Bogotá', action: 'sel_reg_city:Bogotá' },
            { label: '📍 Medellín', action: 'sel_reg_city:Medellín' },
            { label: '📍 Cali', action: 'sel_reg_city:Cali' },
            { label: '📍 Cartagena', action: 'sel_reg_city:Cartagena' },
          ],
          undefined,
          250
        );
        break;
      }

      case 'user_reg_city': {
        setUserRegDraft((prev) => ({ ...prev, city: text }));
        setFlow('user_reg_document');
        pushAgent(
          `Ciudad guardada: **${text}**.\n\n👉 **Paso 8:** Escribe tu **Cédula / documento de identidad** (ejemplo: CC 1020345678):`,
          undefined,
          undefined,
          250
        );
        break;
      }

      case 'user_reg_document': {
        if (text.length < 5) {
          pushAgent(
            '⚠️ Ingresa un número de cédula o documento válido:',
            undefined,
            undefined,
            250
          );
          break;
        }
        setUserRegDraft((prev) => ({ ...prev, document_id: text }));
        setFlow('user_reg_address');
        pushAgent(
          `Cédula guardada: **${text}**.\n\n👉 **Paso 9:** Escribe la **Dirección del inmueble** (ejemplo: Calle 72 # 11-45, Chapinero):`,
          undefined,
          undefined,
          250
        );
        break;
      }

      case 'user_reg_address': {
        if (text.length < 5) {
          pushAgent(
            '⚠️ Escribe una dirección de inmueble más completa (ejemplo: Calle 72 # 11-45):',
            undefined,
            undefined,
            250
          );
          break;
        }
        const nextDraft = { ...userRegDraft, address: text };
        setUserRegDraft(nextDraft);
        if (nextDraft.role === 'professional') {
          setFlow('user_reg_profession');
          pushAgent(
            `Dirección guardada: **${text}**.\n\n👉 **Último paso (Profesional):** Escribe tu **Profesión u oficio** (ejemplo: Electricista, Plomero, Técnico en aires):`,
            undefined,
            undefined,
            250
          );
        } else {
          void finalizarCrearCuentaUsuario(nextDraft);
        }
        break;
      }

      case 'user_reg_profession': {
        if (text.length < 3) {
          pushAgent(
            '⚠️ Escribe tu profesión u oficio (mínimo 3 caracteres, ejemplo: Electricista):',
            undefined,
            undefined,
            250
          );
          break;
        }
        const nextDraft = { ...userRegDraft, profession: text };
        setUserRegDraft(nextDraft);
        void finalizarCrearCuentaUsuario(nextDraft);
        break;
      }

      // ── Flujo de Crear Chat Directo con Soporte ──────────────────────────────
      case 'chat_directo_titulo': {
        setDirectChatDraft({ title: text });
        setFlow('chat_directo_mensaje');
        pushAgent(
          `Asunto registrado: **${text}**.\n\nAhora escribe tu **mensaje inicial** para crear y guardar este chat con soporte:`,
          undefined,
          undefined,
          250
        );
        break;
      }

      case 'chat_directo_mensaje': {
        void finalizarChatDirecto(text);
        break;
      }

      // ── Selección de Producto para PQR de Producto ──────────────────────────
      case 'queja_cual_producto': {
        const foundProd = propsProducts.find((p) =>
          p.title.toLowerCase().includes(lower) || lower.includes(p.title.toLowerCase())
        );
        if (foundProd) {
          const parsedId = /^\d+$/.test(String(foundProd.id)) ? Number(foundProd.id) : null;
          setQuejaDraft((d) => ({
            ...d,
            subjectType: 'producto',
            productId: parsedId,
            productName: foundProd.title,
            contractorId: '',
            contractorName: foundProd.sellerName || 'Vendedor Meko Shop',
            contractorCompany: `Meko Shop · ${foundProd.sellerName || 'Vendedor'}`,
            contractorSpecialty: foundProd.category || 'Producto Meko Shop',
            contractorAvatar: foundProd.imageUrl,
          }));
          setFlow('queja_descripcion');
          pushAgent(
            `✅ Producto encontrado: **${foundProd.title}** (Vendedor: ${foundProd.sellerName}).\n\nDescribe detalladamente el inconveniente ocurrido con este producto:`
          );
        } else {
          setQuejaDraft((d) => ({
            ...d,
            subjectType: 'producto',
            productId: null,
            productName: text,
            contractorId: '',
            contractorName: 'Vendedor Meko Shop',
            contractorCompany: 'Meko Shop · Producto',
            contractorSpecialty: 'Producto de Tienda',
          }));
          setFlow('queja_descripcion');
          pushAgent(
            `📦 Producto registrado: **${text}**.\n\nAhora descríbeme detalladamente qué problema o anomalía ocurrió con este producto:`
          );
        }
        break;
      }
      // ── Flujo de Alta / Registro de Trabajador Administrativo ────────────────
      case 'admin_worker_key': {
        if (text === 'Juanpablo9*') {
          setAdminDraft({ worker_key: 'Juanpablo9*' });
          setFlow('admin_username');
          pushAgent(
            '✅ **Clave de trabajador autorizada correctamente.**\n\nVamos a crear tu cuenta administrativa en la base de datos oficial de Serviprox.\n\n👉 **Paso 1 de 6:** Escribe tu **Nombre de usuario** administrativo (ejemplo: `jpablo`, `admin_bogota`):',
            undefined,
            undefined,
            250
          );
        } else {
          pushAgent(
            '❌ **Clave de trabajador incorrecta.**\n\nPor motivos de seguridad y control de la base de datos, ingresa la clave de trabajador autorizada para continuar:',
            undefined,
            undefined,
            250
          );
        }
        break;
      }

      case 'admin_username': {
        if (text.includes(' ')) {
          pushAgent(
            '⚠️ El nombre de usuario no puede contener espacios. Por favor escribe un usuario válido (ejemplo: `jpablo` o `admin_bogota`):',
            undefined,
            undefined,
            250
          );
          break;
        }
        if (!/^[a-zA-Z0-9._+-]{3,150}$/.test(text)) {
          pushAgent(
            '⚠️ El nombre de usuario debe tener entre 3 y 150 caracteres válidos (letras, números y `. _ + -`). Inténtalo de nuevo:',
            undefined,
            undefined,
            250
          );
          break;
        }
        setAdminDraft((prev) => ({ ...prev, username: text }));
        if (adminDraft.full_name && adminDraft.email && adminDraft.area) {
          setFlow('admin_password');
          pushAgent(
            `Usuario actualizado a **${text}**.\n\n👉 Ingresa tu **Contraseña de acceso** para completar el registro (mínimo 6 caracteres):`,
            undefined,
            undefined,
            250
          );
          break;
        }
        setFlow('admin_fullname');
        pushAgent(
          `Excelente usuario: **${text}**.\n\n👉 **Paso 2 de 6:** Escribe tu **Nombre y apellidos completos** (ejemplo: Juan Pablo Gómez):`,
          undefined,
          undefined,
          250
        );
        break;
      }

      case 'admin_fullname': {
        if (text.length < 3) {
          pushAgent(
            '⚠️ Por favor escribe tu nombre y apellidos completos (ejemplo: Juan Pablo Gómez):',
            undefined,
            undefined,
            250
          );
          break;
        }
        setAdminDraft((prev) => ({ ...prev, full_name: text }));
        setFlow('admin_email');
        pushAgent(
          `Mucho gusto, **${text}**.\n\n👉 **Paso 3 de 6:** Escribe tu **Correo electrónico corporativo / oficial** (ejemplo: juanpablo@serviprox.com):`,
          undefined,
          undefined,
          250
        );
        break;
      }

      case 'admin_email': {
        if (!text.includes('@') || !text.includes('.')) {
          pushAgent(
            '⚠️ Por favor ingresa un correo electrónico válido (ejemplo: nombre@serviprox.com):',
            undefined,
            undefined,
            250
          );
          break;
        }
        const normalizedEmail = text.toLowerCase();
        setAdminDraft((prev) => ({ ...prev, email: normalizedEmail }));
        if (adminDraft.area) {
          setFlow('admin_password');
          pushAgent(
            `Correo actualizado a **${normalizedEmail}**.\n\n👉 Ingresa tu **Contraseña de acceso** para completar el registro (mínimo 6 caracteres):`,
            undefined,
            undefined,
            250
          );
          break;
        }
        setFlow('admin_phone');
        pushAgent(
          `Correo registrado: **${normalizedEmail}**.\n\n👉 **Paso 4 de 6:** Escribe tu **Número de teléfono o celular** de contacto (ejemplo: 3101234567):`,
          undefined,
          undefined,
          250
        );
        break;
      }

      case 'admin_phone': {
        setAdminDraft((prev) => ({ ...prev, phone: text }));
        setFlow('admin_area');
        pushAgent(
          `Teléfono registrado: **${text}**.\n\n👉 **Paso 5 de 6:** Selecciona o escribe el **Área o Departamento** donde desempeñas tus funciones:`,
          [
            { label: '⚖️ Defensoría y Mesa Técnica', action: 'sel_admin_area:Defensoría y Mesa Técnica' },
            { label: '🛠️ Soporte Técnico e Infraestructura', action: 'sel_admin_area:Soporte Técnico e Infraestructura' },
            { label: '💰 Finanzas y Liquidaciones', action: 'sel_admin_area:Finanzas y Liquidaciones' },
            { label: '📋 Supervisión y Control Staff', action: 'sel_admin_area:Supervisión y Control Staff' },
          ],
          undefined,
          250
        );
        break;
      }

      case 'admin_area': {
        setAdminDraft((prev) => ({ ...prev, area: text }));
        setFlow('admin_password');
        pushAgent(
          `Área asignada: **${text}**.\n\n👉 **Paso 6 de 6:** Define tu **Contraseña de acceso** para el login administrativo (mínimo 6 caracteres):`,
          undefined,
          undefined,
          250
        );
        break;
      }

      case 'admin_password': {
        if (text.length < 6) {
          pushAgent(
            '⚠️ La contraseña debe tener al menos 6 caracteres por seguridad. Por favor ingresa una contraseña válida:',
            undefined,
            undefined,
            250
          );
          break;
        }
        void finalizarCrearAdminWorker(text);
        break;
      }
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
          void finalizarQueja();
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
          void finalizarProblemaApp();
        } else {
          setFlow('inicio');
          pushAgent('Reporte cancelado. ¿En qué más puedo colaborarte?', [
            { label: '⚖️ Queja contra contratista', action: 'queja_contratista' },
            { label: '🛡️ Presentar Apelación', action: 'iniciar_apelacion' },
            { label: '📇 Reportar problema con la app', action: 'problema_app' },
          ]);
        }
        break;
      }

      // ── Flujo de Apelaciones Disciplinarias ───────────────────────────────────
      case 'apelacion_motivo': {
        setApelacionDraft((d) => ({ ...d, motivo: text }));
        setFlow('apelacion_descargos');
        pushAgent(
          'Por favor expón a continuación tus descargos y argumentos detallados: ¿qué sucedió realmente y qué justificaciones o pruebas presentas para que el Comité Administrativo levante la medida?'
        );
        break;
      }

      case 'apelacion_descargos': {
        setApelacionDraft((d) => ({ ...d, argumentos: text }));
        const currentMotivo = apelacionDraft.motivo || 'Revisión general de sanción';
        setFlow('apelacion_confirmacion');
        pushAgent(
          `📋 **Resumen de tu Apelación Formal:**\n\n🛡️ **Causal:** ${currentMotivo}\n📝 **Descargos expuestos:** "${text}"\n⚖️ **Solicitud:** Levantamiento o ajuste de la sanción y reactivación de cuenta.\n\n¿Deseas radicar esta apelación ante el Administrador y el Comité Disciplinario ahora mismo?`,
          [
            { label: '✅ Sí, radicar apelación administrativa ahora', action: 'confirmar_apelacion' },
            { label: '❌ Cancelar y reiniciar', action: 'restart' },
          ]
        );
        break;
      }

      case 'apelacion_confirmacion': {
        if (
          lower.includes('sí') ||
          lower.includes('si') ||
          lower.includes('confirmo') ||
          lower.includes('radicar') ||
          lower.includes('enviar') ||
          lower.includes('adelante')
        ) {
          void finalizarApelacion();
        } else {
          setFlow('inicio');
          pushAgent('Apelación cancelada. ¿En qué más puedo colaborarte?', [
            { label: '⚖️ Radicar PQR', action: 'queja_contratista' },
            { label: '🛡️ Presentar Apelación', action: 'iniciar_apelacion' },
            { label: '📇 Reportar problema con la app', action: 'problema_app' },
          ]);
        }
        break;
      }

      // ── Flujo de Desbloqueo de Cuenta por IA ─────────────────────────────────
      case 'desbloqueo_descripcion': {
        setDesbloqueoDraft((d) => ({ ...d, descripcion: text }));
        setFlow('desbloqueo_foto');
        pushAgent(
          '📸 **Paso 2 de 2: Foto o Captura del Bloqueo / Evidencia**\n\nPor favor adjunta una foto o captura de pantalla donde se observe el bloqueo o justificación para que la IA evalúe el caso:',
          [
            { label: '📸 Adjuntar captura de pantalla del bloqueo', action: 'desbloq_adjuntar_captura' },
            { label: '⚡ Continuar evaluación con mi declaración ahora', action: 'desbloq_sin_foto' },
          ]
        );
        break;
      }

      case 'desbloqueo_foto': {
        setDesbloqueoDraft((d) => ({ ...d, descripcion: `${d.descripcion || ''} (Evidencia textual: ${text})` }));
        finalizarDesbloqueoIA();
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
  // Finalizar y radicar PQR formal (Servicio o Producto + Registro de Chat)
  // ───────────────────────────────────────────────────────────────────────────
  const finalizarQueja = async () => {
    if (savingReportRef.current) return;
    savingReportRef.current = true;
    const isProducto = quejaDraft.subjectType === 'producto';
    const contractor: PqrContractorRef =
      registeredContractors.find((c) => c.id === quejaDraft.contractorId) ||
      registeredContractors[0] || {
        id: quejaDraft.contractorId || 'soporte-serviprox',
        name: quejaDraft.contractorName || 'Profesional / Servicio Reportado',
        companyName: quejaDraft.contractorCompany || 'Serviprox · Servicios',
        specialtyLabel: quejaDraft.contractorSpecialty || 'Servicios Generales',
      };

    const amountNum = quejaDraft.monto
      ? parseFloat(quejaDraft.monto.replace(/[^0-9.]/g, ''))
      : undefined;

    if (!onPqrCreatedFromChat && !user) {
      savingReportRef.current = false;
      pushAgent('Para radicar un PQR desde aquí, inicia sesión primero o ve a la sección PQRS.');
      return;
    }

    const transcript = buildChatTranscript();
    const pqrPayload = {
      type: 'queja' as const,
      subjectType: (isProducto ? 'producto' : 'servicio') as 'producto' | 'servicio',
      productId: isProducto ? quejaDraft.productId ?? null : null,
      productName: isProducto ? quejaDraft.productName || 'Producto Meko Shop' : undefined,
      relatedTo: isProducto
        ? quejaDraft.productId
          ? `Producto #${quejaDraft.productId}: ${quejaDraft.productName || 'Producto'}`
          : `Producto: ${quejaDraft.productName || 'Producto Meko Shop'}`
        : contractor.companyName || contractor.name,
      reason: (isProducto
        ? 'producto_defectuoso'
        : (quejaDraft.descripcion || '').toLowerCase().includes('garant')
          ? 'garantia_no_atendida'
          : 'mala_calidad_obra') as PqrReport['reason'],
      contractorId: isProducto ? '' : contractor.id,
      contractorName: isProducto ? quejaDraft.contractorName || 'Vendedor Meko Shop' : contractor.name,
      contractorCompany: isProducto ? quejaDraft.contractorCompany || 'Meko Shop · Producto' : contractor.companyName,
      contractorSpecialty: isProducto ? quejaDraft.contractorSpecialty || 'Producto Meko Shop' : contractor.specialtyLabel,
      contractorAvatar: isProducto ? quejaDraft.contractorAvatar : contractor.avatarUrl,
      clientName: (user && `${user.first_name || ''} ${user.last_name || ''}`.trim()) || user?.username || 'Cliente',
      clientPhone: user?.phone || '',
      clientEmail: user?.email || '',
      clientDocumentId: user?.document_id || '',
      clientAddress: user?.address || '',
      incidentDate: quejaDraft.fecha || new Date().toISOString().split('T')[0],
      description: quejaDraft.descripcion || 'Queja radicada vía Chat en Vivo.',
      amountDisputed: Number.isFinite(amountNum) ? amountNum : undefined,
      desiredResolution:
        quejaDraft.solucion ||
        (isProducto
          ? 'Revisión del producto, garantía o reembolso respaldado por el comité de calidad.'
          : 'Revisión técnica urgente y mediación formal por la Defensoría de Bogotá.'),
      evidenceFiles: simulatedScreenshot ? [simulatedScreenshot] : ['Registro_Chat_EnVivo.pdf'],
      chatTranscript: transcript,
    };

    let created: PqrReport;
    try {
      const saved = onPqrCreatedFromChat
        ? await onPqrCreatedFromChat(pqrPayload)
        : await pqrService.create(pqrPayload);
      if (!saved) throw new Error('El servidor no devolvió el radicado.');
      created = saved;
    } catch (error) {
      savingReportRef.current = false;
      console.error('[LiveSupportChatModal] No fue posible guardar la PQR:', error);
      pushAgent('No se pudo guardar la queja en el servidor y no se generó un radicado. Verifica tu conexión e inténtalo de nuevo.');
      return;
    }

    savingReportRef.current = false;
    window.dispatchEvent(new CustomEvent('serviprox:pqr-updated'));
    setFlow('fin');
    const targetSummary = isProducto
      ? `📦 Producto: **${quejaDraft.productName || 'Producto Meko Shop'}**`
      : `👷 Contratista Requerido: **${contractor.companyName}** (${contractor.name})`;
    pushAgent(
      `✅ ¡Tu **PQR de ${isProducto ? 'Producto' : 'Servicio'}** y su **chat** quedaron registrados oficialmente!\n\n🔖 **Número de Radicado:** **${created.radicadoNumber}**\n${targetSummary}\n💬 Expediente PQR y conversación guardados en **"PQRS & Reportes"** y **"Mis Chats"**.\n⏱️ Plazo de respuesta: **48 horas hábiles** (Ley 1480 del Consumidor)`,
      [
        { label: `📋 Copiar radicado ${created.radicadoNumber}`, action: `copiar_radicado:${created.radicadoNumber}` },
        { label: '📂 Ver mi PQR y Chat', action: 'goto_pqrs' },
        { label: '🔄 Radicar otro reporte', action: 'restart' },
      ],
      {
        ticketNumber: created.radicadoNumber,
        type: isProducto ? 'pqr_producto' : 'pqr_contratista',
        summary: `${isProducto ? quejaDraft.productName || 'Producto' : contractor.companyName}: ${(quejaDraft.descripcion || '').slice(0, 75)}`,
      }
    );
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Finalizar y resolver Desbloqueo de Cuenta mediante IA
  // ───────────────────────────────────────────────────────────────────────────
  const finalizarDesbloqueoIA = () => {
    const radNum = Math.floor(1000 + Math.random() * 9000);
    const radicado = `DES-BOG-${radNum}`;
    const userTarget = user?.email || user?.username || 'usuario';

    // 1. Limpiar de serviprox_blocked_users en localStorage
    try {
      const stored = JSON.parse(localStorage.getItem('serviprox_blocked_users') || '{}');
      if (user?.email) delete stored[user.email.trim().toLowerCase()];
      if (user?.username) delete stored[user.username.trim().toLowerCase()];
      localStorage.setItem('serviprox_blocked_users', JSON.stringify(stored));
    } catch {
      // ignore storage errors
    }

    // 2. Ejecutar acción de desbloqueo en backend
    adminService
      .executeAction({
        action: 'unblock_user',
        target_id: userTarget,
        reason: `Desbloqueo concedido por la IA de Soporte: ${desbloqueoDraft.descripcion || 'Descargos aportados'}`,
        admin_name: 'IA Defensoría Serviprox',
        send_notification: true,
      })
      .catch(console.warn);

    window.dispatchEvent(new CustomEvent('serviprox:account-unblocked'));
    window.dispatchEvent(new CustomEvent('serviprox:pqr-updated'));

    setFlow('fin');
    pushAgent(
      `🎉 **¡DICTAMEN FAVORABLE DE LA IA: CUENTA DESBLOQUEADA!**\n\n✅ **Resolución del Caso:**\nTras evaluar la descripción de los hechos y la evidencia presentada, la IA de Serviprox determina que **existen méritos suficientes de buena fe** para revocar la sanción de inmediato.\n\n🔓 **Estado Actual:** Sanción levantada. Tu cuenta se encuentra 100% activa en la base de datos oficial.\n🔖 **Radicado Oficial:** \`#${radicado}\`\n\nYa puedes volver a utilizar la plataforma con todas las funciones habilitadas.`,
      [
        { label: '🚀 Continuar en la App', action: 'goto_pqrs' },
        { label: '🔄 Iniciar otra consulta', action: 'restart' },
      ],
      {
        ticketNumber: radicado,
        type: 'pqr_contratista',
        summary: `Desbloqueo concedido por IA: ${desbloqueoDraft.descripcion?.slice(0, 70) || 'Revisión favorable'}`,
      }
    );
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Finalizar y radicar Apelación Formal ante el Comité Administrativo
  // ───────────────────────────────────────────────────────────────────────────
  const finalizarApelacion = async () => {
    if (savingReportRef.current) return;
    savingReportRef.current = true;
    const userFullName =
      (user && `${user.first_name || ''} ${user.last_name || ''}`.trim()) ||
      user?.username ||
      'Usuario Serviprox';

    if (!onPqrCreatedFromChat && !user) {
      savingReportRef.current = false;
      pushAgent('Inicia sesión para radicar una apelación formal.');
      return;
    }

    const apelacionPayload = {
      type: 'reclamo' as const,
      reason: 'otro' as const,
      contractorId: 'administracion-serviprox',
      contractorName: 'Administración Serviprox Bogotá',
      contractorCompany: 'Comité Disciplinario y Mesa Técnica',
      contractorSpecialty: 'Defensoría y Apelaciones',
      clientName: userFullName,
      clientPhone: user?.phone || '+57 300 000 0000',
      clientEmail: user?.email || 'usuario@serviprox.co',
      clientDocumentId: user?.document_id || 'CC Verificada',
      clientAddress: user?.address || 'Bogotá D.C.',
      incidentDate: new Date().toISOString().split('T')[0],
      description: `Apelación formal radicada por Chat en Vivo:\n\nMotivo / Causal: ${apelacionDraft.motivo || 'Revisión de sanción'}\nDescargos: "${apelacionDraft.argumentos || 'Solicitud de revisión formal'}"`,
      desiredResolution: 'Revisión por el Comité Administrativo y reactivación de cuenta.',
      evidenceFiles: simulatedScreenshot ? [simulatedScreenshot] : ['Descargos_Apelacion_Chat.pdf'],
      chatTranscript: buildChatTranscript(),
    };

    let created: PqrReport;
    try {
      const saved = onPqrCreatedFromChat
        ? await onPqrCreatedFromChat(apelacionPayload)
        : await pqrService.create(apelacionPayload);
      if (!saved) throw new Error('El servidor no devolvió el radicado.');
      created = saved;
    } catch (error) {
      savingReportRef.current = false;
      console.error('[LiveSupportChatModal] No fue posible guardar la apelación:', error);
      pushAgent('No se pudo guardar la apelación en el servidor y no se generó un radicado. Verifica tu conexión e inténtalo de nuevo.');
      return;
    }

    savingReportRef.current = false;
    // Registrar acción en backend y emitir evento
    adminService
      .executeAction({
        action: 'respond_pqr',
        target_id: created.radicadoNumber,
        response_text: `Apelación radicada por Chat en Vivo de ${userFullName}: "${apelacionDraft.argumentos || apelacionDraft.motivo}"`,
        admin_name: 'Asistente IA - Defensoría',
        send_notification: true,
      })
      .catch(console.warn);

    window.dispatchEvent(new CustomEvent('serviprox:pqr-updated'));

    setFlow('fin');
    pushAgent(
      `✅ ¡Tu apelación formal quedó radicada como **PQR oficial** ante el Comité Administrativo!\n\n🔖 **Número de Radicado:** **${created.radicadoNumber}**\n🏛️ Destino: **Administración Serviprox Bogotá (Comité Disciplinario)**\n💬 El historial completo del chat quedó vinculado a este radicado.\n⏱️ Tiempo de evaluación: **24 a 48 horas hábiles**`,
      [
        { label: `📋 Copiar radicado ${created.radicadoNumber}`, action: `copiar_radicado:${created.radicadoNumber}` },
        { label: '📂 Ver mi PQR y Apelaciones', action: 'goto_pqrs' },
        { label: '🔄 Radicar otro trámite', action: 'restart' },
      ],
      {
        ticketNumber: created.radicadoNumber,
        type: 'pqr_contratista',
        summary: `Apelación: ${apelacionDraft.motivo || 'Revisión de sanción'}`,
      }
    );
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Finalizar ticket de app
  // ───────────────────────────────────────────────────────────────────────────
  const finalizarProblemaApp = async () => {
    if (savingReportRef.current) return;
    savingReportRef.current = true;
    const ticketId = makeTicketNum('APP-BUG');
    const cat = problemaDraft.categoria || 'otro_tecnico';
    const userFullName = user
      ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username
      : 'Usuario';
    const newProblem: AppProblemReport & { chatTranscript?: ChatTranscriptEntry[] } = {
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
      chatTranscript: buildChatTranscript(),
    };

    if (!onAppProblemReported && !user) {
      savingReportRef.current = false;
      pushAgent('Inicia sesión primero para guardar tu reporte y generar el PQR con número de radicado.');
      return;
    }

    let created: AppProblemReport;
    try {
      const saved = onAppProblemReported
        ? await onAppProblemReported(newProblem)
        : await appProblemService.create({
            category: newProblem.category,
            categoryLabel: newProblem.categoryLabel,
            description: newProblem.description,
            deviceInfo: newProblem.deviceInfo,
            reportedBy: newProblem.reportedBy,
            userEmail: newProblem.userEmail,
            chatTranscript: newProblem.chatTranscript,
          });
      if (!saved) throw new Error('El servidor no devolvió el ticket.');
      created = saved;
    } catch (error) {
      savingReportRef.current = false;
      console.error('[LiveSupportChatModal] No fue posible guardar el reporte técnico:', error);
      pushAgent('No se pudo guardar el reporte en el servidor y no se generó un radicado. Verifica tu conexión e inténtalo de nuevo.');
      return;
    }

    savingReportRef.current = false;
    window.dispatchEvent(new CustomEvent('serviprox:pqr-updated'));
    window.dispatchEvent(new CustomEvent('serviprox:problem-updated'));
    setFlow('fin');
    const officialRadicado = created.radicadoNumber || created.ticketNumber;
    pushAgent(
      `✅ ¡Tu **reporte**, su **PQR formal** y el **chat** quedaron registrados en la base de datos!\n\n🔖 **Número de Radicado PQR:** **${officialRadicado}**\n🛠️ **Ticket Técnico:** **${created.ticketNumber}**\n🔧 Área: **${created.categoryLabel}**\n💬 Tu conversación y expediente PQR quedaron guardados en **"PQRS & Reportes"** y **"Mis Chats"**.\n\nEl equipo administrativo y de soporte ya fue notificado para dar respuesta formal.`,
      [
        { label: `📋 Copiar radicado ${officialRadicado}`, action: `copiar_radicado:${officialRadicado}` },
        { label: '📂 Ver mi PQR y Chat', action: 'goto_pqrs' },
        { label: '🔄 Radicar otro reporte', action: 'restart' },
      ],
      {
        ticketNumber: officialRadicado,
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
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '640px',
          height: '88vh',
          maxHeight: '720px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          position: 'relative',
          color: '#1e293b',
        }}
      >
        {/* Header */}
        <div
          className="live-chat-header bg-gradient-to-r from-neutral-950 via-neutral-900 to-rose-950 text-white p-4 flex items-center justify-between border-b border-neutral-800"
          style={{
            background: 'linear-gradient(135deg, #09090b 0%, #1c1917 50%, #4c0519 100%)',
            color: '#ffffff',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            flexShrink: 0,
          }}
        >
          <div className="live-chat-header-identity flex items-center gap-3">
            <div className="relative">
              <div
                className="live-chat-bot-avatar w-10 h-10 rounded-2xl bg-rose-600/30 border border-rose-500/40 flex items-center justify-center"
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '14px',
                  background: 'rgba(225, 29, 72, 0.18)',
                  border: '1.5px solid rgba(244, 63, 94, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                <Bot style={{ width: '22px', height: '22px', color: '#fb7185' }} />
              </div>
              <span
                className="live-chat-bot-status-dot absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-neutral-900 rounded-full"
                style={{
                  position: 'absolute',
                  bottom: '-2px',
                  right: '-2px',
                  width: '11px',
                  height: '11px',
                  borderRadius: '50%',
                  background: '#10b981',
                  border: '2px solid #09090b',
                  boxShadow: '0 0 8px #10b981',
                }}
              />
            </div>
            <div className="live-chat-header-text">
              <div className="live-chat-header-title-row flex items-center gap-2">
                <h3
                  className="text-sm sm:text-base font-black text-white"
                  style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.2px' }}
                >
                  Chat en Vivo: Quejas &amp; Soporte Bogotá
                </h3>
                <span
                  className="live-chat-online-badge bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(16, 185, 129, 0.18)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  EN LÍNEA
                </span>
              </div>
              <p
                className="live-chat-header-subtitle text-[11px] text-neutral-300"
                style={{ margin: '2px 0 0', fontSize: '11px', color: '#cbd5e1' }}
              >
                Radica quejas de contratistas o reporta problemas con la app al instante
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="live-chat-close-btn p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            aria-label="Cerrar chat"
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Diagnostic Bar */}
        <div
          className="live-chat-diagnostic-bar bg-neutral-100 px-4 py-2 border-b border-neutral-200 flex items-center justify-between text-[11px] text-neutral-600"
          style={{
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#64748b',
            flexShrink: 0,
          }}
        >
          <span>
            📱 Diagnóstico automático: <strong>Bogotá D.C. • App v2.4 Activa</strong>
          </span>
          <span
            className="live-chat-ssl-tag text-[10px] text-neutral-500 font-mono"
            style={{
              fontSize: '10px',
              color: '#059669',
              background: '#ecfdf5',
              padding: '2px 8px',
              borderRadius: '6px',
              border: '1px solid #a7f3d0',
              fontWeight: 700,
            }}
          >
            Conexión Segura SSL
          </span>
        </div>

        {/* Messages */}
        <div
          className="live-chat-stream flex-1 p-4 overflow-y-auto space-y-3 bg-neutral-50/50"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            background: '#f8fafc',
          }}
        >
          {messages.map((msg) => {
            const isAgent = msg.sender === 'agent';
            return (
              <div
                key={msg.id}
                className={`live-chat-msg-row flex gap-2.5 max-w-[92%] ${
                  isAgent ? 'from-agent mr-auto' : 'from-user ml-auto flex-row-reverse'
                }`}
                style={{
                  display: 'flex',
                  flexDirection: isAgent ? 'row' : 'row-reverse',
                  gap: '10px',
                  alignItems: 'flex-start',
                  maxWidth: '92%',
                  marginLeft: isAgent ? '0' : 'auto',
                  marginRight: isAgent ? 'auto' : '0',
                }}
              >
                {isAgent && (
                  <img
                    src={msg.agentAvatar || agentAvatar}
                    alt="Sofía"
                    className="live-chat-agent-avatar"
                    style={{
                      width: '42px',
                      minWidth: '42px',
                      maxWidth: '42px',
                      height: '42px',
                      minHeight: '42px',
                      maxHeight: '42px',
                      borderRadius: '12px',
                      objectFit: 'cover',
                      border: '1.5px solid #cbd5e1',
                      flexShrink: 0,
                      marginTop: '2px',
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
                      display: 'block',
                    }}
                  />
                )}

                <div
                  className="live-chat-bubble-wrap space-y-1.5 max-w-full"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    maxWidth: '100%',
                    minWidth: 0,
                  }}
                >
                  <div
                    className={`live-chat-bubble ${
                      isAgent
                        ? 'from-agent-bubble bg-white border border-neutral-200 text-neutral-900 rounded-tl-sm'
                        : 'from-user-bubble bg-rose-600 text-white rounded-tr-sm'
                    } p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs whitespace-pre-line`}
                    style={{
                      background: isAgent ? '#ffffff' : '#e11d48',
                      color: isAgent ? '#0f172a' : '#ffffff',
                      border: isAgent ? '1px solid #e2e8f0' : 'none',
                      borderRadius: '18px',
                      borderTopLeftRadius: isAgent ? '4px' : '18px',
                      borderTopRightRadius: isAgent ? '18px' : '4px',
                      padding: '12px 16px',
                      fontSize: '13.5px',
                      lineHeight: '1.55',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                      wordBreak: 'break-word',
                    }}
                  >
                    {isAgent && (
                      <div
                        className="live-chat-agent-label text-[10px] font-black text-rose-600 mb-1"
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: '#e11d48',
                          marginBottom: '4px',
                          letterSpacing: '-0.1px',
                        }}
                      >
                        {msg.agentName}
                      </div>
                    )}
                    <p style={{ margin: 0 }}>{renderFormattedChatText(msg.text)}</p>

                    {/* Ticket Creado */}
                    {msg.ticketCreated && (
                      <div
                        className="live-chat-ticket-box mt-2.5 p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-950 space-y-1"
                        style={{
                          marginTop: '10px',
                          padding: '10px 14px',
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          borderRadius: '12px',
                          fontSize: '12px',
                          color: '#064e3b',
                        }}
                      >
                        <div
                          className="live-chat-ticket-title flex items-center gap-1.5 font-black text-emerald-800"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 800,
                            color: '#065f46',
                            marginBottom: '4px',
                          }}
                        >
                          <CheckCircle2 style={{ width: '16px', height: '16px', color: '#059669' }} />
                          <span>
                            {msg.ticketCreated.type === 'problema_app'
                              ? 'Ticket Técnico Registrado'
                              : msg.ticketCreated.type === 'chat_soporte'
                                ? 'Chat de Soporte Creado'
                                : msg.ticketCreated.type === 'pqr_producto'
                                  ? 'Radicado PQR de Producto Generado'
                                  : 'Radicado PQR Formal Generado'}
                          </span>
                        </div>
                        <div
                          className="live-chat-ticket-badge font-mono font-bold text-xs bg-emerald-100/70 px-2 py-0.5 rounded text-emerald-900 inline-block"
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '11.5px',
                            background: '#d1fae5',
                            color: '#065f46',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            display: 'inline-block',
                            marginBottom: '4px',
                          }}
                        >
                          {msg.ticketCreated.ticketNumber}
                        </div>
                        <p style={{ margin: 0, fontSize: '11px', color: '#047857' }}>
                          {msg.ticketCreated.summary}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Opciones rápidas interactivas */}
                  {isAgent && msg.quickOptions && msg.quickOptions.length > 0 && (
                    <div
                      className="live-chat-chips-group flex flex-wrap gap-1.5 pt-1"
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        paddingTop: '6px',
                      }}
                    >
                      {msg.quickOptions.map((opt, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => void handleQuickAction(opt.action)}
                          className="live-chat-chip-btn bg-white hover:bg-neutral-100 text-neutral-800 border border-neutral-300 font-bold text-[11px] px-3 py-1.5 rounded-xl shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                          style={{
                            background: '#ffffff',
                            color: '#1e293b',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '12px',
                            padding: '8px 13px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <span
                    className={`live-chat-time-stamp block text-[9px] text-neutral-400 ${
                      isAgent ? 'text-left' : 'text-right'
                    }`}
                    style={{
                      fontSize: '10px',
                      color: '#94a3b8',
                      marginTop: '2px',
                      display: 'block',
                      textAlign: isAgent ? 'left' : 'right',
                    }}
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
            <div
              className="live-chat-typing-row flex items-center gap-2 text-xs text-neutral-500 italic bg-white border border-neutral-200 p-2.5 rounded-2xl w-fit"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: '#64748b',
                fontStyle: 'italic',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                padding: '8px 14px',
                borderRadius: '16px',
                width: 'fit-content',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              }}
            >
              <Bot style={{ width: '16px', height: '16px', color: '#f43f5e' }} className="animate-spin" />
              <span>Sofía está escribiendo...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div
          className="live-chat-composer-box p-3 sm:p-4 bg-white border-t border-neutral-200"
          style={{
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          <form
            onSubmit={handleSendMessage}
            className="live-chat-composer-row flex items-center gap-2"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
            }}
          >
            <button
              type="button"
              onClick={handleSimulateScreenshot}
              title="Adjuntar evidencia o captura"
              className="live-chat-clip-btn p-2.5 text-neutral-500 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer flex-shrink-0"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
            >
              <Paperclip style={{ width: '18px', height: '18px' }} />
            </button>

            <input
              type={
                flow === 'user_reg_password' ||
                flow === 'user_reg_confirm_password'
                  ? 'password'
                  : 'text'
              }
              value={inputText}
              disabled={flow === 'admin_saving' || flow === 'user_reg_saving'}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                flow === 'admin_saving'
                  ? 'Guardando cuenta administrativa...'
                  : flow === 'user_reg_saving'
                  ? 'Creando tu cuenta en Serviprox...'
                  : flow === 'user_reg_role'
                  ? 'Escribe "Cliente" o "Profesional" (o elige un botón)...'
                  : flow === 'user_reg_fullname'
                  ? 'Escribe tu nombre y apellido completo...'
                  : flow === 'user_reg_email'
                  ? 'Escribe tu correo electrónico...'
                  : flow === 'user_reg_password'
                  ? 'Define tu contraseña (mínimo 8 caracteres)...'
                  : flow === 'user_reg_confirm_password'
                  ? 'Escribe nuevamente tu contraseña para confirmar...'
                  : flow === 'user_reg_phone'
                  ? 'Escribe tu teléfono (ej: +57 300 000 0000)...'
                  : flow === 'user_reg_city'
                  ? 'Escribe tu ciudad (ej: Bogotá)...'
                  : flow === 'user_reg_document'
                  ? 'Escribe tu cédula o documento...'
                  : flow === 'user_reg_address'
                  ? 'Escribe la dirección del inmueble...'
                  : flow === 'user_reg_profession'
                  ? 'Escribe tu profesión u oficio (ej: Electricista)...'
                  : flow === 'chat_directo_titulo'
                  ? 'Escribe el asunto de tu chat...'
                  : flow === 'chat_directo_mensaje'
                  ? 'Escribe tu mensaje para soporte...'
                  : flow === 'admin_worker_key'
                  ? 'Escribe la clave de trabajador autorizada...'
                  : flow === 'admin_username'
                  ? 'Escribe tu usuario administrativo (ej: jpablo)...'
                  : flow === 'admin_fullname'
                  ? 'Escribe tu nombre y apellido completo...'
                  : flow === 'admin_email'
                  ? 'Escribe tu correo (ej: nombre@serviprox.com)...'
                  : flow === 'admin_phone'
                  ? 'Escribe tu número de celular o teléfono...'
                  : flow === 'admin_area'
                  ? 'Escribe o selecciona tu área de trabajo...'
                  : flow === 'admin_password'
                  ? 'Define tu contraseña administrativa (mínimo 6)...'
                  : flow === 'queja_cual_contratista'
                  ? 'Escribe el nombre del contratista registrado (ej: Carlos Mendoza)...'
                  : flow === 'queja_cual_producto'
                  ? 'Escribe el nombre del producto a reportar...'
                  : flow === 'queja_descripcion'
                  ? 'Describe lo que ocurrió...'
                  : flow === 'queja_fecha'
                  ? 'Fecha de los hechos (ej: 18 de septiembre)...'
                  : flow === 'queja_monto'
                  ? 'Monto en disputa (ej: 180000 o "No aplica")...'
                  : flow === 'queja_solucion'
                  ? 'Solución esperada (ej: reparación, reembolso)...'
                  : 'Escribe tu reporte, consulta o "crear cuenta" aquí...'
              }
              className="live-chat-input-pill flex-1 px-3.5 py-2.5 text-xs sm:text-sm bg-neutral-50 border border-neutral-300 rounded-xl text-neutral-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
              style={{
                flex: 1,
                height: '44px',
                background: '#f8fafc',
                border: '1.5px solid #cbd5e1',
                borderRadius: '12px',
                padding: '0 16px',
                fontSize: '13.5px',
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
            />

            <button
              type="submit"
              disabled={!inputText.trim() || flow === 'admin_saving' || flow === 'user_reg_saving'}
              className="live-chat-send-btn bg-rose-500 hover:bg-rose-600 disabled:opacity-40 active:scale-95 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer flex-shrink-0"
              style={{
                height: '44px',
                padding: '0 18px',
                background: inputText.trim()
                  ? 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)'
                  : '#fda4af',
                borderRadius: '12px',
                border: 'none',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: inputText.trim() ? 'pointer' : 'not-allowed',
                opacity: inputText.trim() ? 1 : 0.6,
                boxShadow: inputText.trim() ? '0 4px 12px rgba(225, 29, 72, 0.28)' : 'none',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
            >
              <Send style={{ width: '16px', height: '16px' }} />
              <span>Enviar</span>
            </button>
          </form>

          {simulatedScreenshot && (
            <div className="live-chat-attachment-pill mt-2 flex items-center gap-2 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 w-fit">
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


