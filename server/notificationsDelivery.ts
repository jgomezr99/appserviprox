import nodemailer from "nodemailer";

export interface DeliveryResult {
  sent: boolean;
  provider: "resend" | "smtp" | "twilio" | "preview";
  error?: string;
}

export function normalizePhoneDigits(raw: string): string {
  return String(raw || "").replace(/\D/g, "");
}

export function phoneMatches(storedPhone: string, inputPhone: string): boolean {
  const a = normalizePhoneDigits(storedPhone);
  const b = normalizePhoneDigits(inputPhone);
  if (!a || !b || b.length < 7) return false;
  if (a === b) return true;
  // Compare last 10 digits to match Colombia (+57 3XX...) with local 3XX...
  const a10 = a.length >= 10 ? a.slice(-10) : a;
  const b10 = b.length >= 10 ? b.slice(-10) : b;
  return a10.length >= 7 && a10 === b10;
}

export function formatE164Phone(raw: string): string {
  const trimmed = String(raw || "").trim();
  const digits = normalizePhoneDigits(trimmed);
  if (!digits) return "";
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 10 && digits.startsWith("3")) return `+57${digits}`;
  if (digits.length === 12 && digits.startsWith("57")) return `+${digits}`;
  return `+${digits}`;
}

export function maskEmail(email: string): string {
  const clean = String(email || "").trim();
  const at = clean.indexOf("@");
  if (at <= 0) return "";
  const local = clean.slice(0, at);
  const domain = clean.slice(at + 1);
  const visible = local.length <= 2 ? local[0] || "*" : local.slice(0, 2);
  return `${visible}***@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return "";
  if (digits.length <= 4) return `***${digits}`;
  return `***${digits.slice(-4)}`;
}

export async function sendRecoveryEmail(params: {
  to: string;
  code: string;
  userName: string;
  isAdmin?: boolean;
}): Promise<DeliveryResult> {
  const to = String(params.to || "").trim();
  if (!to || !to.includes("@")) {
    return { sent: false, provider: "preview", error: "Correo inválido." };
  }

  const subject = params.isAdmin
    ? `Serviprox Admin · Código de recuperación: ${params.code}`
    : `Serviprox · Código de recuperación de cuenta: ${params.code}`;

  const textBody = [
    `Hola ${params.userName || "usuario"},`,
    "",
    `Recibimos una solicitud para recuperar el acceso a tu cuenta ${params.isAdmin ? "administrativa " : ""}en Serviprox.`,
    `Tu código de verificación de 6 dígitos es: ${params.code}`,
    "",
    "Este código vence en 10 minutos y solo puede utilizarse una vez.",
    "Si no realizaste esta solicitud, puedes ignorar este mensaje.",
  ].join("\n");

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #0f172a;">
      <h2 style="margin: 0 0 12px; color: #1d4ed8;">Serviprox · Recuperación de cuenta</h2>
      <p style="margin: 0 0 16px; line-height: 1.5;">
        Hola <strong>${String(params.userName || "usuario").replace(/[<>&"']/g, "")}</strong>,
        usa el siguiente código para restablecer la contraseña de tu cuenta${params.isAdmin ? " administrativa" : ""}:
      </p>
      <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 12px; padding: 18px; text-align: center; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0f172a; margin-bottom: 16px;">
        ${params.code}
      </div>
      <p style="margin: 0; font-size: 13px; color: #475569;">
        Este código expira en 10 minutos y es de un solo uso. Si no solicitaste este cambio, ignora este correo.
      </p>
    </div>
  `;

  // 1. Resend API (HTTPS)
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    try {
      const from = process.env.DEFAULT_FROM_EMAIL?.trim() || "Serviprox <onboarding@resend.dev>";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          text: textBody,
          html: htmlBody,
        }),
      });
      if (res.ok) {
        return { sent: true, provider: "resend" };
      }
      const errText = await res.text().catch(() => "");
      console.warn(`[Serviprox Email/Resend] HTTP ${res.status}: ${errText.slice(0, 200)}`);
      return { sent: false, provider: "resend", error: `Error del proveedor de correo (${res.status}).` };
    } catch (err) {
      console.warn("[Serviprox Email/Resend] Error:", err);
      return { sent: false, provider: "resend", error: "No se pudo conectar al proveedor de correo." };
    }
  }

  // 2. Standard SMTP (EMAIL_HOST / EMAIL_PORT / EMAIL_HOST_USER / EMAIL_HOST_PASSWORD)
  const host = process.env.EMAIL_HOST?.trim();
  const user = process.env.EMAIL_HOST_USER?.trim();
  const pass = process.env.EMAIL_HOST_PASSWORD?.trim();
  if (host && user && pass) {
    try {
      const port = Number.parseInt(process.env.EMAIL_PORT || "587", 10) || 587;
      const secure = port === 465 || String(process.env.EMAIL_USE_SSL || "").toLowerCase() === "true";
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });
      const from = process.env.DEFAULT_FROM_EMAIL?.trim() || user;
      await transporter.sendMail({
        from,
        to,
        subject,
        text: textBody,
        html: htmlBody,
      });
      return { sent: true, provider: "smtp" };
    } catch (err) {
      console.warn("[Serviprox Email/SMTP] Error:", err);
      return { sent: false, provider: "smtp", error: "No se pudo enviar el correo por SMTP." };
    }
  }

  return { sent: false, provider: "preview" };
}

export async function sendRecoverySms(params: {
  to: string;
  code: string;
  isAdmin?: boolean;
}): Promise<DeliveryResult> {
  const formattedTo = formatE164Phone(params.to);
  if (!formattedTo) {
    return { sent: false, provider: "preview", error: "Teléfono inválido." };
  }

  const body = `Serviprox${params.isAdmin ? " Admin" : ""}: tu codigo de recuperacion es ${params.code}. Valido por 10 minutos. No lo compartas.`;

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();

  if (accountSid && authToken && fromNumber) {
    try {
      const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
      const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
      const form = new URLSearchParams({
        To: formattedTo,
        From: fromNumber,
        Body: body,
      });
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
      if (res.ok) {
        return { sent: true, provider: "twilio" };
      }
      const errText = await res.text().catch(() => "");
      console.warn(`[Serviprox SMS/Twilio] HTTP ${res.status}: ${errText.slice(0, 200)}`);
      return { sent: false, provider: "twilio", error: `Error del proveedor SMS (${res.status}).` };
    } catch (err) {
      console.warn("[Serviprox SMS/Twilio] Error:", err);
      return { sent: false, provider: "twilio", error: "No se pudo conectar al proveedor de SMS." };
    }
  }

  return { sent: false, provider: "preview" };
}
