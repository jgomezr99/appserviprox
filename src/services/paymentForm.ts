import type React from "react";

export type PaymentFormMethodId = "credit" | "debit" | "transfer";

export interface PaymentFormMethod {
  id: PaymentFormMethodId;
  label: string;
  enabled: boolean;
}

export type ButtonSize = "small" | "medium" | "large";
export type ButtonAlign = "full" | "left" | "center" | "right";
export type ButtonShape = "rounded" | "square" | "pill";

export type ResultSize = "small" | "medium" | "large";
export type ResultStyle = "soft" | "solid" | "outline";
export type ResultPosition = "top" | "form";
export type ResultAlign = "left" | "center" | "right";

export interface PaymentResultStyle {
  title: string;
  message: string;
  color: string;
  size: ResultSize;
  style: ResultStyle;
  position: ResultPosition;
  align: ResultAlign;
  shape: ButtonShape;
}

/** Formulario de pago que el administrador edita y el cliente ve. {monto} se reemplaza por el valor a pagar. */
export interface PaymentFormConfig {
  title: string;
  note: string;
  submit_label: string;
  transfer_submit_label: string;
  show_installments: boolean;
  show_transfer_reference: boolean;
  methods: PaymentFormMethod[];
  button_color: string;
  button_text_color: string;
  button_size: ButtonSize;
  button_align: ButtonAlign;
  button_shape: ButtonShape;
  approved: PaymentResultStyle;
  declined: PaymentResultStyle;
}

const RESULT_LOOK = {
  size: "medium",
  style: "soft",
  position: "top",
  align: "left",
  shape: "rounded",
} as const;

export const DEFAULT_PAYMENT_FORM: PaymentFormConfig = {
  title: "Pago de prueba · {monto}",
  note: "Modo de pruebas: no se realiza ningún cobro real ni se guardan los datos ingresados.",
  submit_label: "Pagar {monto}",
  transfer_submit_label: "Confirmar transferencia de {monto}",
  show_installments: true,
  show_transfer_reference: true,
  methods: [
    { id: "credit", label: "Tarjeta de crédito", enabled: true },
    { id: "debit", label: "Tarjeta débito", enabled: true },
    { id: "transfer", label: "Transferencia", enabled: true },
  ],
  button_color: "#dc2626",
  button_text_color: "#ffffff",
  button_size: "medium",
  button_align: "full",
  button_shape: "rounded",
  approved: {
    title: "Pago aprobado",
    message: "Tu pago fue aprobado. Aquí está tu comprobante.",
    color: "#15803d",
    ...RESULT_LOOK,
  },
  declined: {
    title: "Pago rechazado",
    message: "No pudimos procesar tu pago. Verifica los datos o intenta con otro medio de pago.",
    color: "#b91c1c",
    ...RESULT_LOOK,
  },
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;
const color = (value: unknown, fallback: string) => (typeof value === "string" && HEX.test(value) ? value : fallback);
const result = (value: unknown, fallback: PaymentResultStyle): PaymentResultStyle => {
  const data = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const text = (key: "title" | "message") =>
    typeof data[key] === "string" && (data[key] as string).trim() ? (data[key] as string) : fallback[key];
  return {
    title: text("title"),
    message: text("message"),
    color: color(data.color, fallback.color),
    size: pick(data.size, ["small", "medium", "large"], fallback.size),
    style: pick(data.style, ["soft", "solid", "outline"], fallback.style),
    position: pick(data.position, ["top", "form"], fallback.position),
    align: pick(data.align, ["left", "center", "right"], fallback.align),
    shape: pick(data.shape, ["rounded", "square", "pill"], fallback.shape),
  };
};

const IDS: PaymentFormMethodId[] = ["credit", "debit", "transfer"];

/** Combina la configuración guardada con los valores por defecto; tolera datos incompletos. */
export const resolvePaymentForm = (raw: unknown): PaymentFormConfig => {
  const base = DEFAULT_PAYMENT_FORM;
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Partial<Record<keyof PaymentFormConfig, unknown>>;
  const text = (key: "title" | "note" | "submit_label" | "transfer_submit_label") =>
    typeof data[key] === "string" && (data[key] as string).trim() ? (data[key] as string) : base[key];

  const saved = Array.isArray(data.methods) ? (data.methods as Array<Partial<PaymentFormMethod>>) : [];
  const methods: PaymentFormMethod[] = [];
  for (const item of saved) {
    if (item && IDS.includes(item.id as PaymentFormMethodId) && !methods.some((m) => m.id === item.id)) {
      const fallback = base.methods.find((m) => m.id === item.id)!;
      methods.push({
        id: fallback.id,
        label: typeof item.label === "string" && item.label.trim() ? item.label : fallback.label,
        enabled: item.enabled !== false,
      });
    }
  }
  base.methods.forEach((m) => {
    if (!methods.some((x) => x.id === m.id)) methods.push({ ...m });
  });
  if (!methods.some((m) => m.enabled)) methods.forEach((m) => (m.enabled = true));

  return {
    title: text("title"),
    note: text("note"),
    submit_label: text("submit_label"),
    transfer_submit_label: text("transfer_submit_label"),
    show_installments: data.show_installments !== false,
    show_transfer_reference: data.show_transfer_reference !== false,
    methods,
    button_color: color((data as Record<string, unknown>).button_color, base.button_color),
    button_text_color: color((data as Record<string, unknown>).button_text_color, base.button_text_color),
    button_size: pick((data as Record<string, unknown>).button_size, ["small", "medium", "large"], base.button_size),
    button_align: pick((data as Record<string, unknown>).button_align, ["full", "left", "center", "right"], base.button_align),
    button_shape: pick((data as Record<string, unknown>).button_shape, ["rounded", "square", "pill"], base.button_shape),
    approved: result((data as Record<string, unknown>).approved, base.approved),
    declined: result((data as Record<string, unknown>).declined, base.declined),
  };
};

/** Estilo del botón de pago según la configuración del administrador. */
export const buttonStyle = (config: PaymentFormConfig) => ({
  size: config.button_size === "medium" ? undefined : config.button_size === "small" ? ("small" as const) : ("large" as const),
  expand: config.button_align === "full" ? ("block" as const) : undefined,
  justify: { left: "flex-start", center: "center", right: "flex-end", full: "stretch" }[config.button_align],
  css: {
    "--background": config.button_color,
    "--background-hover": config.button_color,
    "--background-activated": config.button_color,
    "--color": config.button_text_color,
    "--border-radius": { rounded: "12px", square: "0px", pill: "999px" }[config.button_shape],
  } as React.CSSProperties,
});

/** Estilo visual de un mensaje de pago aprobado o rechazado. */
export const resultBoxStyle = (result: PaymentResultStyle): React.CSSProperties => {
  const solid = result.style === "solid";
  return {
    border: `2px solid ${result.color}`,
    background: solid ? result.color : result.style === "outline" ? "#ffffff" : `${result.color}1a`,
    color: solid ? "#ffffff" : "#1f2937",
    borderRadius: { rounded: 14, square: 0, pill: 28 }[result.shape],
    padding: { small: "8px 12px", medium: "14px 16px", large: "22px 24px" }[result.size],
    fontSize: { small: "0.85rem", medium: "1rem", large: "1.2rem" }[result.size],
    textAlign: result.align,
  };
};

export const fillAmount = (template: string, amount: string) => template.split("{monto}").join(amount);
