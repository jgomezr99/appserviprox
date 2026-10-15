import React from "react";
import { Card, FieldDef, FieldList, Footer, TabProps } from "./ui";

const T = "toggle" as const;
const S = "select" as const;

const BLOCKS: Array<{ title: string; icon: string; fields: FieldDef[] }> = [
  {
    title: "Información de la aplicación",
    icon: "📱",
    fields: [
      { key: "app_name", label: "Nombre de la app" },
      { key: "app_version", label: "Versión actual" },
      { key: "app_description", label: "Descripción corta", kind: "textarea" },
    ],
  },
  {
    title: "Plataformas y publicación",
    icon: "🚀",
    fields: [
      { key: "android_version", label: "Android - versión mínima soportada" },
      { key: "android_published", label: "Android publicada", kind: T },
      { key: "ios_version", label: "iOS - versión mínima soportada" },
      { key: "ios_published", label: "iOS publicada", kind: T },
      { key: "web_domain", label: "Dominio principal (Web)" },
      { key: "web_active", label: "Web activa", kind: T },
    ],
  },
  {
    title: "Registro de usuarios y onboarding",
    icon: "👤",
    fields: [
      { key: "reg_clients", label: "Permitir registro de clientes", kind: T },
      { key: "reg_pros", label: "Permitir registro de profesionales", kind: T },
      { key: "verify_email", label: "Verificación de correo electrónico", kind: T },
      { key: "kyc", label: "Verificación de identidad (KYC)", kind: T },
      { key: "welcome_tutorial", label: "Tutorial de bienvenida", kind: T },
      { key: "redo_profile", label: "Redirigir a completar perfil", kind: T },
    ],
  },
  {
    title: "Categorías de servicios",
    icon: "🗂️",
    fields: [
      { key: "show_categories", label: "Mostrar categorías en la app", kind: T },
      { key: "categories_order", label: "Orden de visualización (una por línea)", kind: "textarea", rows: 5 },
    ],
  },
  {
    title: "Contrataciones y reservas",
    icon: "📅",
    fields: [
      { key: "min_anticipation", label: "Anticipación mínima de reserva", kind: S, options: ["1 hora", "2 horas", "4 horas", "24 horas"] },
      { key: "max_anticipation", label: "Anticipación máxima de reserva", kind: S, options: ["7 días", "15 días", "30 días", "60 días"] },
      { key: "cancel_time", label: "Tiempo para cancelar", kind: S, options: ["1 hora", "2 horas", "4 horas", "24 horas"] },
      { key: "cancel_policy", label: "Política de cancelación", kind: "textarea" },
      { key: "auto_confirm", label: "Confirmación automática", kind: T },
      { key: "urgent", label: "Permitir contrataciones urgentes", kind: T },
    ],
  },
  {
    title: "Archivos y multimedia",
    icon: "🖼️",
    fields: [
      { key: "max_image_size", label: "Tamaño máximo de imágenes", kind: S, options: ["5 MB", "10 MB", "20 MB"] },
      { key: "image_formats", label: "Formatos permitidos" },
      { key: "max_images", label: "Máximo de imágenes por publicación", kind: "number" },
      { key: "max_video_size", label: "Tamaño máximo de videos", kind: S, options: ["25 MB", "50 MB", "100 MB"] },
      { key: "video_formats", label: "Formatos de video" },
    ],
  },
  {
    title: "Chat y mensajería",
    icon: "💬",
    fields: [
      { key: "chat_enabled", label: "Habilitar chat entre usuarios", kind: T },
      { key: "chat_images", label: "Permitir envío de imágenes", kind: T },
      { key: "chat_files", label: "Permitir envío de archivos", kind: T },
      { key: "chat_templates", label: "Mensajes automáticos (plantillas)", kind: "number" },
      { key: "chat_response", label: "Tiempo de respuesta sugerido", kind: S, options: ["30 minutos", "1 hora", "4 horas", "24 horas"] },
    ],
  },
  {
    title: "Geolocalización y mapas",
    icon: "📍",
    fields: [
      { key: "map_provider", label: "Proveedor de mapas", kind: S, options: ["OpenStreetMap (gratuito)", "Google Maps"] },
      { key: "default_radius", label: "Radio de búsqueda por defecto", kind: S, options: ["5 km", "10 km", "25 km", "50 km"] },
      { key: "show_location", label: "Mostrar ubicación exacta", kind: T },
      { key: "mandatory_location", label: "Usar geolocalización obligatoria", kind: T },
      { key: "city_search", label: "Permitir búsqueda por ciudad", kind: T },
    ],
  },
  {
    title: "Privacidad y seguridad",
    icon: "🛡️",
    fields: [
      { key: "ask_policies", label: "Solicitar aceptación de políticas", kind: T },
      { key: "show_privacy", label: "Mostrar aviso de privacidad", kind: T },
      { key: "hide_contact", label: "Ocultar datos de contacto", kind: T },
      { key: "allow_reports", label: "Permitir reportes de usuarios", kind: T },
      { key: "moderation", label: "Modo de moderación de contenido", kind: S, options: ["Automático", "Manual", "Desactivado"] },
      { key: "activity_log", label: "Registro de actividad en la app", kind: T },
    ],
  },
  {
    title: "API y servicios externos",
    icon: "🔌",
    fields: [
      { key: "api_url", label: "URL de la API", placeholder: "https://api.serviprox.com" },
      { key: "api_key", label: "Clave de API", kind: "password" },
      { key: "api_timeout", label: "Tiempo de espera (timeout)", kind: S, options: ["15 segundos", "30 segundos", "60 segundos"] },
    ],
  },
  {
    title: "Funciones adicionales",
    icon: "✨",
    fields: [
      { key: "extra_store", label: "Tienda de productos", kind: T },
      { key: "extra_benefits", label: "Sistema de beneficios", kind: T },
      { key: "extra_pqr", label: "PQR y reportes", kind: T },
      { key: "extra_reviews", label: "Valoraciones y reseñas", kind: T },
      { key: "extra_share", label: "Compartir en redes sociales", kind: T },
      { key: "extra_push", label: "Notificaciones push", kind: T },
    ],
  },
];

export const AppParamsTab: React.FC<TabProps> = ({ sec, setSec, busy, save, reset }) => (
  <>
    <div className="as-grid as-grid-3">
      {BLOCKS.map((b) => (
        <Card key={b.title} title={b.title} icon={b.icon}>
          <FieldList fields={b.fields} values={sec} onChange={(k, v) => setSec({ [k]: v })} disabled={busy} />
        </Card>
      ))}
    </div>
    <Footer
      busy={busy}
      save={save}
      reset={reset}
      note="Los cambios en los parámetros de la app pueden afectar el funcionamiento de la plataforma."
    />
  </>
);
