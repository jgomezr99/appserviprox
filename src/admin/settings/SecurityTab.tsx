import React from "react";
import { Card, Empty, FieldList, Footer, TabProps } from "./ui";

const ROLES = [
  ["Administradores", "Acceso total a la plataforma."],
  ["Profesionales", "Acceso a publicaciones y contrataciones."],
  ["Clientes", "Acceso a servicios y compras."],
  ["Soporte", "Acceso a PQR y reportes."],
];

export const SecurityTab: React.FC<TabProps> = ({ form, sec, setSec, busy, save, reset }) => {
  const onChange = (k: string, v: unknown) => setSec({ [k]: v });
  const users = form.system?.users_total;

  return (
    <>
      <div className="as-grid as-grid-4">
        {[
          ["🛡️", "—", "Sesiones activas"],
          ["👥", users === undefined ? "—" : users.toLocaleString("es-CO"), "Usuarios registrados"],
          ["🔒", "—", "Intentos fallidos (24h)"],
          ["💻", "—", "Dispositivos conectados"],
        ].map(([icon, value, label]) => (
          <div className="as-card as-stat" key={label}>
            <span aria-hidden="true">{icon}</span>
            <div><strong>{value}</strong><small>{label}</small></div>
          </div>
        ))}
      </div>

      <div className="as-grid as-grid-3">
        <Card title="Política de contraseñas" icon="🔑">
          <FieldList
            fields={[
              { key: "pw_enforce", label: "Aplicar política", kind: "toggle" },
              { key: "pw_min", label: "Longitud mínima (caracteres)", kind: "number" },
              { key: "pw_upper", label: "Incluir al menos una letra mayúscula (A-Z)", kind: "toggle" },
              { key: "pw_lower", label: "Incluir al menos una letra minúscula (a-z)", kind: "toggle" },
              { key: "pw_number", label: "Incluir al menos un número (0-9)", kind: "toggle" },
              { key: "pw_special", label: "Incluir al menos un carácter especial (!@#$%)", kind: "toggle" },
              { key: "pw_expiry", label: "Expiración de contraseña", kind: "select", options: ["Nunca", "Cada 30 días", "Cada 60 días", "Cada 90 días", "Cada 180 días"] },
            ]}
            values={sec}
            onChange={onChange}
            disabled={busy}
          />
          <div className="as-note">La política se aplicará a todos los usuarios (administradores, profesionales y clientes).</div>
        </Card>

        <Card title="Autenticación y acceso" icon="🔐">
          <FieldList
            fields={[
              { key: "twofa", label: "Autenticación en dos pasos (2FA)", kind: "toggle" },
              { key: "twofa_method", label: "Métodos de 2FA permitidos", kind: "select", options: ["Aplicación de autenticación (Google Authenticator)", "SMS", "Correo electrónico"] },
              { key: "idle", label: "Tiempo de sesión inactiva", kind: "select", options: ["15 minutos", "30 minutos", "1 hora", "4 horas"] },
              { key: "max_attempts", label: "Máximo de intentos de inicio de sesión", kind: "select", options: ["3 intentos", "5 intentos", "10 intentos"] },
              { key: "lock", label: "Bloqueo de cuenta", kind: "select", options: ["15 minutos", "30 minutos", "1 hora", "24 horas"] },
            ]}
            values={sec}
            onChange={onChange}
            disabled={busy}
          />
        </Card>

        <div className="as-side">
          <Card title="Conexión segura" icon="🌐">
            <div className="as-row"><span>Estado de TLS/SSL</span><span className="as-badge as-badge-green">Activo</span></div>
            <FieldList
              fields={[
                { key: "force_https", label: "Forzar HTTPS", kind: "toggle" },
                { key: "redirect_https", label: "Redirección HTTPS", kind: "toggle" },
              ]}
              values={sec}
              onChange={onChange}
              disabled={busy}
            />
          </Card>
          <Card title="Alertas de seguridad" icon="⚠️">
            <FieldList
              fields={[
                { key: "alert_failed", label: "Notificar intentos de acceso fallidos", kind: "toggle" },
                { key: "alert_device", label: "Notificar nuevos dispositivos", kind: "toggle" },
                { key: "alert_password", label: "Notificar cambios de contraseña", kind: "toggle" },
                { key: "alert_location", label: "Notificar accesos desde nuevas ubicaciones", kind: "toggle" },
              ]}
              values={sec}
              onChange={onChange}
              disabled={busy}
            />
          </Card>
        </div>
      </div>

      <div className="as-grid as-grid-2b">
        <Card title="Sesiones activas" icon="🖥️">
          <Empty text="El registro de sesiones activas aún no está disponible." />
        </Card>
        <Card title="Control de acceso por roles" icon="👤">
          {ROLES.map(([role, desc]) => (
            <div className="as-row" key={role}>
              <span><strong>{role}</strong><br /><small className="as-muted">{desc}</small></span>
            </div>
          ))}
        </Card>
      </div>

      <Card title="Actividad sospechosa" icon="🚨">
        <Empty text="No hay actividad sospechosa registrada." />
      </Card>

      <Footer busy={busy} save={save} reset={reset} />
    </>
  );
};
