import React from "react";
import { applyAppearance, platformSettingsService } from "../../services/platformSettings";
import { Card, FieldList, TabProps } from "./ui";

const PALETTE = ["#2563EB", "#38BDF8", "#8B5CF6", "#EC4899", "#EF4444", "#F97316", "#22C55E", "#14B8A6", "#94A3B8"];
const FONTS = ["Inter", "Poppins", "Roboto", "Montserrat", "Open Sans"];
const MAX_IMG = 2 * 1024 * 1024;

const readImage = (file: File | undefined, types: RegExp, notify: TabProps["notify"], done: (data: string) => void) => {
  if (!file) return;
  if (!types.test(file.type) || file.size > MAX_IMG) {
    notify("error", "Imagen inválida o mayor a 2 MB.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => done(String(reader.result));
  reader.readAsDataURL(file);
};

const Choice: React.FC<{ options: string[]; value: string; onChange: (v: string) => void }> = ({
  options,
  value,
  onChange,
}) => (
  <div className="as-choices">
    {options.map((o) => (
      <button
        key={o}
        type="button"
        aria-pressed={value === o}
        className={`as-choice ${value === o ? "on" : ""}`}
        onClick={() => onChange(o)}
      >
        {o}
      </button>
    ))}
  </div>
);

export const AppearanceTab: React.FC<TabProps> = ({ form, setForm, sec, setSec, busy, save, reset, notify }) => {
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <>
      <div className="as-grid as-grid-3">
        <Card title="Colores de la plataforma" icon="🎨">
          <p className="as-muted">Define la paleta de colores principal de Serviprox.</p>
          <label>Color principal
            <span className="as-color">
              <input type="color" value={sec.primary} onChange={(e) => setSec({ primary: e.target.value })} />
              <input value={sec.primary} onChange={(e) => setSec({ primary: e.target.value })} />
            </span>
          </label>
          <label>Color secundario
            <span className="as-color">
              <input type="color" value={sec.secondary} onChange={(e) => setSec({ secondary: e.target.value })} />
              <input value={sec.secondary} onChange={(e) => setSec({ secondary: e.target.value })} />
            </span>
          </label>
          <span className="as-label">Paleta de colores</span>
          <div className="as-palette">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                className={sec.primary === c ? "on" : ""}
                style={{ background: c }}
                onClick={() => setSec({ primary: c })}
              />
            ))}
          </div>
        </Card>

        <Card title="Logo y favicon" icon="🖼️">
          <div className="as-two">
            <div>
              <span className="as-label">Logo principal (PNG o SVG)</span>
              <div className="as-logo-box">
                {form.logo ? <img src={form.logo} alt="Logo" /> : <strong>{form.platform_name}</strong>}
              </div>
              <label className="as-btn as-btn-outline as-btn-block">
                ⬆ Cambiar logo
                <input
                  type="file"
                  hidden
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={(e) => readImage(e.target.files?.[0], /^image\/(png|jpeg)$/, notify, (d) => set("logo", d))}
                />
              </label>
              <button type="button" className="as-btn as-btn-danger as-btn-block" onClick={() => set("logo", "")}>
                🗑 Eliminar
              </button>
            </div>
            <div>
              <span className="as-label">Favicon (32x32 px)</span>
              <div className="as-logo-box">{sec.favicon ? <img src={sec.favicon} alt="Favicon" /> : <span>🏠</span>}</div>
              <label className="as-btn as-btn-outline as-btn-block">
                ⬆ Cambiar
                <input
                  type="file"
                  hidden
                  accept="image/png,image/jpeg"
                  onChange={(e) => readImage(e.target.files?.[0], /^image\/(png|jpeg)$/, notify, (d) => setSec({ favicon: d }))}
                />
              </label>
              <button type="button" className="as-btn as-btn-danger as-btn-block" onClick={() => setSec({ favicon: "" })}>
                🗑 Eliminar
              </button>
            </div>
          </div>
          <small>Formatos aceptados: PNG, JPG. Tamaño máximo: 2 MB</small>
        </Card>

        <Card title="Tipografía" icon="Tт">
          <label>Fuente
            <select value={sec.font} onChange={(e) => setSec({ font: e.target.value })}>
              {FONTS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </label>
          <span className="as-label">Vista previa</span>
          <div className="as-font-preview" style={{ fontFamily: `"${sec.font}", sans-serif` }}>
            <strong>{form.platform_name}</strong>
            <span>Gestión y contratación de servicios para el hogar.</span>
          </div>
        </Card>
      </div>

      <div className="as-grid as-grid-3">
        <Card title="Tema de la interfaz" icon="🌙">
          <p className="as-muted">Elige el modo de visualización por defecto.</p>
          <Choice options={["Modo claro", "Modo oscuro"]} value={sec.theme === "dark" ? "Modo oscuro" : "Modo claro"} onChange={(v) => setSec({ theme: v === "Modo oscuro" ? "dark" : "light" })} />
        </Card>

        <Card title="Estilo de componentes" icon="▣">
          <span className="as-label">Estilo de botones</span>
          <Choice options={["Redondeado", "Cuadrado", "Sutil"]} value={sec.buttons} onChange={(v) => setSec({ buttons: v })} />
          <span className="as-label">Estilo de tarjetas</span>
          <Choice options={["Suave", "Elevado", "Con borde"]} value={sec.cards} onChange={(v) => setSec({ cards: v })} />
        </Card>

        <Card title="Densidad del diseño" icon="☰">
          <p className="as-muted">Ajusta el espaciado y tamaño de los elementos.</p>
          <Choice options={["Compacto", "Estándar", "Amplio"]} value={sec.density} onChange={(v) => setSec({ density: v })} />
        </Card>
      </div>

      <div className="as-grid as-grid-3">
        <Card title="Vista previa del dashboard" icon="👁">
          <p className="as-muted">Así se verá la plataforma con la configuración actual.</p>
          <div className="as-preview" style={{ fontFamily: `"${sec.font}", sans-serif` }}>
            <div className="as-preview-bar" style={{ background: sec.primary }}>{form.platform_name}</div>
            <div className="as-preview-body">
              <strong>¡Bienvenido, Administrador!</strong>
              <div className="as-preview-kpis">
                <span style={{ borderColor: sec.primary }}>1,243<br /><small>Clientes</small></span>
                <span style={{ borderColor: sec.primary }}>856<br /><small>Contrataciones</small></span>
                <span style={{ borderColor: sec.secondary }}>48<br /><small>PQR</small></span>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Preferencias de visualización" icon="🖥️">
          <FieldList
            fields={[
              { key: "language", label: "Idioma de la interfaz", kind: "select", options: ["Español", "English"] },
              { key: "date_format", label: "Formato de fecha", kind: "select", options: ["dd/mm/aaaa", "mm/dd/aaaa", "aaaa-mm-dd"] },
              { key: "time_format", label: "Formato de hora", kind: "select", options: ["24 horas (HH:mm)", "12 horas (hh:mm AM/PM)"] },
              { key: "currency", label: "Moneda por defecto", kind: "select", options: ["Peso colombiano (COP)", "Dólar (USD)", "Euro (EUR)"] },
            ]}
            values={form as unknown as Record<string, unknown>}
            onChange={(k, v) => setForm((prev) => ({ ...prev, [k]: v }))}
          />
        </Card>

        <Card title="Fondo y elementos decorativos" icon="🖼️">
          <span className="as-label">Imagen de fondo (opcional)</span>
          <div className="as-logo-box as-bg">{sec.bg_image ? <img src={sec.bg_image} alt="Fondo" /> : <span>Sin imagen</span>}</div>
          <label className="as-btn as-btn-outline as-btn-block">
            ⬆ Cambiar imagen
            <input
              type="file"
              hidden
              accept="image/png,image/jpeg"
              onChange={(e) => readImage(e.target.files?.[0], /^image\/(png|jpeg)$/, notify, (d) => setSec({ bg_image: d }))}
            />
          </label>
          <button type="button" className="as-btn as-btn-danger as-btn-block" onClick={() => setSec({ bg_image: "" })}>
            🗑 Eliminar
          </button>
          <small>Recomendado: 1920x1080 px. Máx. 2 MB</small>
          <FieldList fields={[{ key: "decorative", label: "Mostrar formas decorativas", kind: "toggle" }]} values={sec} onChange={(k, v) => setSec({ [k]: v })} />
        </Card>
      </div>

      <div className="as-footer">
        <button type="button" className="as-btn as-btn-outline" onClick={() => applyAppearance(sec)}>👁 Vista previa</button>
        <button type="button" className="as-btn as-btn-outline" disabled={busy} onClick={reset}>↻ Restablecer valores</button>
        <button type="button" className="as-btn as-btn-primary" disabled={busy} onClick={save}>💾 Guardar cambios</button>
      </div>
    </>
  );
};
