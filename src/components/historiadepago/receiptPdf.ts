import logo from "../../Assets/logo.png";
import { savePdf } from "../../utils/savePdf";
import type { ClientPaymentRow, PaymentStatus } from "../../services/finance";

const NAVY: [number, number, number] = [26, 61, 110];
const RED: [number, number, number] = [217, 30, 40];
const LINE: [number, number, number] = [120, 140, 165];
const GRAY: [number, number, number] = [110, 110, 110];

const money = (value: number) =>
  Number(value || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });

const dateParts = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
};

// Pagado / Pendiente / Anulado son las tres opciones del formato de comprobante.
const receiptState = (status: PaymentStatus): "paid" | "pending" | "void" =>
  status === "approved" ? "paid" : status === "pending" ? "pending" : "void";

const loadLogo = () =>
  new Promise<{ data: string; width: number; height: number } | null>((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) return resolve(null);
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      resolve({ data: canvas.toDataURL("image/jpeg", 0.92), width: canvas.width, height: canvas.height });
    };
    image.onerror = () => resolve(null);
    image.src = logo;
  });

export const receiptNumber = (row: ClientPaymentRow) => `CP-${String(row.id).padStart(6, "0")}`;

export async function downloadReceiptPdf(row: ClientPaymentRow): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const left = 15;
  const width = 180;
  const right = left + width;
  const midX = left + 100;

  const text = (value: string, x: number, y: number, opts: { size?: number; bold?: boolean; color?: [number, number, number]; align?: "left" | "center" | "right"; max?: number } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 10);
    doc.setTextColor(...(opts.color ?? [0, 0, 0]));
    const lines = opts.max ? doc.splitTextToSize(value, opts.max) : value;
    doc.text(lines, x, y, { align: opts.align ?? "left" });
  };
  const box = (x: number, y: number, w: number, h: number) => {
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, h);
  };
  const hline = (x1: number, x2: number, y: number) => {
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(x1, y, x2, y);
  };
  const checkbox = (x: number, y: number, label: string, checked: boolean) => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(x, y - 3, 3.2, 3.2, checked ? "F" : "S");
    doc.setFillColor(0, 0, 0);
    text(label, x + 5, y, { size: 9.5 });
    return x + 5 + doc.getTextWidth(label) + 4;
  };
  const label = (name: string, value: string, x: number, y: number, max: number) => {
    text(name, x, y, { bold: true, size: 9.5 });
    const offset = doc.getTextWidth(name) + 2;
    text(value || "—", x + offset, y, { size: 9.5, max: max - offset });
  };

  const brand = await loadLogo();
  let y = 12;
  if (brand) {
    const logoWidth = 70;
    const logoHeight = (logoWidth * brand.height) / brand.width;
    doc.addImage(brand.data, "JPEG", left + (width - logoWidth) / 2, y, logoWidth, logoHeight);
    y += logoHeight + 4;
  } else {
    text("Serviprox", left + width / 2, y + 10, { size: 26, bold: true, color: RED, align: "center" });
    y += 18;
  }

  text("COMPROBANTE DE PAGO", left + width / 2, y + 4, { size: 20, bold: true, color: NAVY, align: "center" });
  text("Serviprox · Soporte de pago", left + width / 2, y + 10, { size: 9, color: GRAY, align: "center" });
  y += 16;

  // Cabecera
  box(left, y, width, 20);
  hline(left, right, y + 10);
  doc.line(midX, y, midX, y + 20);
  label("N.º comprobante:", receiptNumber(row), left + 3, y + 6.5, 95);
  label("Fecha:", dateParts(row.paid_at || row.date), midX + 3, y + 6.5, 75);
  const state = receiptState(row.status);
  let x = left + 3;
  text("Estado:", x, y + 16.5, { bold: true, size: 9.5 });
  x += doc.getTextWidth("Estado:") + 3;
  x = checkbox(x, y + 16.5, "Pagado", state === "paid");
  x = checkbox(x, y + 16.5, "Pendiente", state === "pending");
  checkbox(x, y + 16.5, "Anulado", state === "void");

  const methodText = (row.method || "").toLowerCase();
  const medium = methodText.includes("transfer") || methodText.includes("pse") ? "transfer" : "other";
  x = midX + 3;
  text("Medio:", x, y + 16.5, { bold: true, size: 9.5 });
  x += doc.getTextWidth("Medio:") + 3;
  x = checkbox(x, y + 16.5, "Efectivo", false);
  x = checkbox(x, y + 16.5, "Transferencia", medium === "transfer");
  checkbox(x, y + 16.5, "Otro", medium === "other");
  y += 26;

  // Cliente
  text("INFORMACIÓN DEL CLIENTE", left, y, { bold: true, size: 9.5, color: NAVY });
  y += 2;
  box(left, y, width, 30);
  hline(left, right, y + 10);
  hline(left, right, y + 20);
  label("Nombre / Razón social:", row.client_name, left + 3, y + 6.5, width - 6);
  label("Documento / NIT:", row.client_document, left + 3, y + 16.5, 95);
  label("Teléfono:", row.client_phone, midX + 3, y + 16.5, 75);
  label("Correo:", row.client_email, left + 3, y + 26.5, width - 6);
  y += 38;

  // Detalle
  text("DETALLE DEL PAGO", left, y, { bold: true, size: 9.5, color: NAVY });
  y += 2;
  const colRef = left + 100;
  const colVal = left + 135;
  box(left, y, width, 40);
  hline(left, right, y + 10);
  doc.line(colRef, y, colRef, y + 40);
  doc.line(colVal, y, colVal, y + 40);
  text("Concepto / Servicio", left + 4, y + 6.5, { bold: true, size: 9.5, color: RED });
  text("Referencia", colRef + 4, y + 6.5, { bold: true, size: 9.5, color: NAVY });
  text("Valor (COP)", colVal + 4, y + 6.5, { bold: true, size: 9.5, color: RED });
  text(row.service, left + 4, y + 15, { bold: true, size: 9.5, max: 92 });
  const detail = [
    row.service_category && row.service_category !== row.service ? `Categoría: ${row.service_category}` : "",
    `Profesional: ${row.professional} · Orden #${row.order_id}`,
    row.service_address ? `Dirección: ${row.service_address}` : "",
    row.scheduled_for ? `Servicio agendado: ${dateParts(row.scheduled_for)}` : "",
  ].filter(Boolean);
  text(detail.join("\n"), left + 4, y + 20, { size: 8.5, color: GRAY, max: 92 });
  text(row.reference, colRef + 4, y + 16, { size: 9, max: 30 });
  text(`$ ${money(row.subtotal ?? row.amount)}`, colVal + 4, y + 16, { size: 9.5 });
  y += 48;

  // Totales
  box(left, y, width, 30);
  hline(left, right, y + 10);
  hline(left, right, y + 20);
  doc.line(colVal, y, colVal, y + 30);
  text("Subtotal:", left + 3, y + 6.5, { bold: true, size: 9.5 });
  text(`$ ${money(row.subtotal ?? row.amount)}`, colVal + 4, y + 6.5, { size: 9.5 });
  text("Descuento:", left + 3, y + 16.5, { bold: true, size: 9.5 });
  text(row.discount ? `- $ ${money(row.discount)}` : "$ 0", colVal + 4, y + 16.5, { size: 9.5 });
  text("TOTAL PAGADO:", left + 3, y + 26.5, { bold: true, size: 9.5 });
  const total = state === "paid" ? row.amount : 0;
  text(`$ ${money(total)}`, colVal + 4, y + 26.5, { bold: true, size: 9.5 });
  text("COP", right - 3, y + 26.5, { bold: true, size: 9.5, align: "right" });
  y += 38;

  // Observaciones
  text("OBSERVACIONES", left, y, { bold: true, size: 9.5, color: NAVY });
  y += 2;
  box(left, y, width, 22);
  hline(left, right, y + 11);
  const transaction = row.transaction_id ? ` · Transacción: ${row.transaction_id}` : "";
  text(`Método de pago: ${row.method} · Estado: ${row.status_label}${transaction}`, left + 3, y + 7, { size: 9, max: width - 6 });
  text(
    state === "paid"
      ? "Pago registrado en la plataforma Serviprox."
      : state === "pending"
        ? "El pago aún no ha sido confirmado; el valor total pagado se mostrará cuando sea aprobado."
        : "Esta transacción no fue cobrada o fue anulada/reembolsada.",
    left + 3,
    y + 17,
    { size: 9, max: width - 6 }
  );
  y += 30;

  text("Comprobante de pago · Serviprox", left + width / 2, y, { size: 9, color: GRAY, align: "center" });

  await savePdf(doc.output("blob"), `comprobante_pago_serviprox_${receiptNumber(row)}.pdf`);
}
