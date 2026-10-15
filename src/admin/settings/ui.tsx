import React from "react";
import type { PlatformSettings, Section } from "../../services/platformSettings";

export type FieldDef = {
  key: string;
  label: string;
  kind?: "text" | "number" | "password" | "textarea" | "toggle" | "select" | "color";
  options?: string[];
  unit?: string;
  rows?: number;
  placeholder?: string;
};

export type ConfirmRequest = {
  action: string;
  title: string;
  text: string;
  extra?: Record<string, unknown>;
};

export interface TabProps {
  form: PlatformSettings;
  setForm: React.Dispatch<React.SetStateAction<PlatformSettings>>;
  sec: Section;
  setSec: (patch: Section) => void;
  busy: boolean;
  save: () => void;
  reset: () => void;
  notify: (type: "ok" | "error", text: string) => void;
  askConfirm: (c: ConfirmRequest) => void;
  runAction: (body: Record<string, unknown> & { action: string }) => void;
}

export const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }> = ({
  checked,
  onChange,
  label,
  disabled,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    className={`as-switch ${checked ? "on" : ""}`}
    onClick={() => onChange(!checked)}
  />
);

export const Card: React.FC<{
  title: string;
  icon?: string;
  badge?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ title, icon, badge, className = "", children }) => (
  <div className={`as-card ${className}`}>
    <h3>
      {icon && <span aria-hidden="true">{icon}</span>} {title}
      {badge && <span className="as-badge">{badge}</span>}
    </h3>
    {children}
  </div>
);

export const FieldList: React.FC<{
  fields: FieldDef[];
  values: Section;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
}> = ({ fields, values, onChange, disabled }) => (
  <>
    {fields.map((f) => {
      const value = values[f.key];
      if (f.kind === "toggle") {
        return (
          <div className="as-row" key={f.key}>
            <span>{f.label}</span>
            <Toggle checked={Boolean(value)} label={f.label} disabled={disabled} onChange={(v) => onChange(f.key, v)} />
          </div>
        );
      }
      return (
        <label key={f.key}>
          {f.label}
          {f.kind === "select" ? (
            <select value={String(value ?? "")} onChange={(e) => onChange(f.key, e.target.value)}>
              {[...new Set([String(value ?? ""), ...(f.options ?? [])])].filter(Boolean).map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : f.kind === "textarea" ? (
            <textarea rows={f.rows ?? 3} value={String(value ?? "")} onChange={(e) => onChange(f.key, e.target.value)} />
          ) : f.kind === "color" ? (
            <input type="color" value={String(value ?? "#000000")} onChange={(e) => onChange(f.key, e.target.value)} />
          ) : (
            <span className="as-unit">
              <input
                type={f.kind === "password" ? "password" : f.kind === "number" ? "number" : "text"}
                autoComplete={f.kind === "password" ? "new-password" : undefined}
                value={String(value ?? "")}
                placeholder={f.placeholder}
                onChange={(e) => onChange(f.key, f.kind === "number" ? Number(e.target.value) : e.target.value)}
              />
              {f.unit && <em>{f.unit}</em>}
            </span>
          )}
        </label>
      );
    })}
  </>
);

export const Footer: React.FC<{ busy: boolean; save: () => void; reset: () => void; note?: string }> = ({
  busy,
  save,
  reset,
  note,
}) => (
  <div className="as-footer">
    {note && <span className="as-muted">{note}</span>}
    <button type="button" className="as-btn as-btn-outline" disabled={busy} onClick={reset}>
      ↻ Restablecer valores
    </button>
    <button type="button" className="as-btn as-btn-primary" disabled={busy} onClick={save}>
      💾 Guardar cambios
    </button>
  </div>
);

export const Empty: React.FC<{ text: string }> = ({ text }) => <p className="as-muted as-empty">{text}</p>;
