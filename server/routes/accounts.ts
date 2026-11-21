import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import {
  checkMaintenanceForLogin,
  clearFailedLogin,
  hashPassword,
  isCurrentlyBlocked,
  isLoginLocked,
  isStaffUser,
  registerFailedLogin,
  requireAuth,
  requireFeatureEnabled,
  requireStaff,
  serializeUser,
  signAccessToken,
  signRefreshToken,
  touchLastLogin,
  verifyJwt,
  verifyPassword,
  verifyPasswordAsync,
  type AuthedRequest,
  type DbUser,
} from "../auth.ts";
import {
  BACKUP_DIR,
  DB_PATH,
  DEFAULT_PLATFORM_SETTINGS,
  MEDIA_DIR,
  addAuditLog,
  addNotification,
  db,
  loadPlatformSettings,
  nowIso,
  savePlatformSettings,
  slugify,
} from "../db.ts";
import { exportFullBackup, importFixtureRecords } from "../seed.ts";
import {
  maskEmail,
  maskPhone,
  normalizePhoneDigits,
  phoneMatches,
  sendRecoveryEmail,
  sendRecoverySms,
} from "../notificationsDelivery.ts";

const router = Router();

const WORKER_KEY = process.env.ADMIN_WORKER_KEY || "Juanpablo9*";
const ALLOWED_ATT_EXT = new Set(["gif", "jpeg", "jpg", "json", "log", "pdf", "png", "txt", "webp"]);
const ALLOWED_CERT_EXT = new Set(["pdf", "jpg", "jpeg", "png", "webp"]);

const certUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const adminUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

function saveBufferToMedia(subdir: string, origName: string, buffer: Buffer): string {
  const safeSubdir = path.basename(subdir);
  const dir = path.resolve(MEDIA_DIR, safeSubdir);
  const resolvedMedia = path.resolve(MEDIA_DIR);
  if (!dir.startsWith(resolvedMedia + path.sep) && dir !== resolvedMedia) {
    throw new Error("Directorio de carga no permitido.");
  }
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(origName || "").toLowerCase().replace(/[^.a-z0-9]/g, "") || ".bin";
  const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
  const fullPath = path.resolve(dir, filename);
  if (!fullPath.startsWith(dir + path.sep)) {
    throw new Error("Ruta de archivo no permitida.");
  }
  fs.writeFileSync(fullPath, buffer);
  return `${safeSubdir}/${filename}`;
}

function guessMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".txt": "text/plain; charset=utf-8",
    ".log": "text/plain; charset=utf-8",
    ".json": "application/json",
  };
  return map[ext] || "application/octet-stream";
}

function formatDateDmy(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatDateTimeDmy(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${formatDateDmy(iso)} ${hh}:${min}`;
}

// ── Health ───────────────────────────────────────────────────────────────────

router.get("/health/", (_req: Request, res: Response) => {
  try {
    db.prepare("SELECT 1").get();
    res.json({
      status: "ok",
      database: "connected",
      engine: "sqlite",
      source: "local-sqlite",
      database_path: path.basename(DB_PATH),
    });
  } catch {
    res.status(503).json({ status: "error", database: "disconnected" });
  }
});

// ── Auth ─────────────────────────────────────────────────────────────────────

router.post("/auth/token/", async (req: Request, res: Response) => {
  const identity = String(req.body?.email || req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  const requireAdmin = Boolean(req.body?.require_admin);
  const strictPassword = Boolean(req.body?.strict_password);

  if (!identity || !password) {
    res.status(400).json({ detail: "Ingresa correo/usuario y contraseña." });
    return;
  }

  const lockedMins = isLoginLocked(identity);
  if (lockedMins) {
    res.status(429).json({
      detail: `Demasiados intentos fallidos. Intenta nuevamente en ${lockedMins} minutos.`,
    });
    return;
  }

  const user = db
    .prepare("SELECT * FROM users WHERE lower(email) = lower(?) OR lower(username) = lower(?) LIMIT 1")
    .get(identity, identity) as DbUser | undefined;

  if (!user) {
    registerFailedLogin(identity);
    res.status(401).json({ detail: "No se encontró una cuenta activa con estas credenciales." });
    return;
  }

  if (isCurrentlyBlocked(user)) {
    const blockedMsg = user.block_reason
      ? `Cuenta bloqueada (${user.block_type || "suspensión"}): ${user.block_reason}`
      : "Esta cuenta se encuentra suspendida por el administrador.";
    res.status(403).json({
      detail: blockedMsg,
      blocked: true,
      block_type: user.block_type,
      block_reason: user.block_reason,
      blocked_until: user.blocked_until,
    });
    return;
  }

  if (!user.is_active) {
    res.status(401).json({ detail: "La cuenta no está activa." });
    return;
  }

  const passOk = await verifyPasswordAsync(password, user.password);
  if (!passOk) {
    if (strictPassword) {
      registerFailedLogin(identity);
      res.status(401).json({ detail: "No se encontró una cuenta activa con estas credenciales." });
      return;
    }
    registerFailedLogin(identity);
    res.status(401).json({ detail: "Contraseña incorrecta." });
    return;
  }

  if (requireAdmin && !isStaffUser(user)) {
    res.status(403).json({ detail: "Esta cuenta no tiene permisos administrativos." });
    return;
  }

  const maintErr = checkMaintenanceForLogin(user);
  if (maintErr) {
    res.status(503).json({ detail: maintErr });
    return;
  }

  clearFailedLogin(identity);
  touchLastLogin(user.id);

  res.json({
    access: signAccessToken(user),
    refresh: signRefreshToken(user),
    user: serializeUser(user),
  });
});

router.post("/auth/token/refresh/", (req: Request, res: Response) => {
  const refresh = String(req.body?.refresh || "").trim();
  if (!refresh) {
    res.status(400).json({ detail: "Falta el token de actualización." });
    return;
  }
  const payload = verifyJwt(refresh);
  if (!payload || payload.token_type !== "refresh") {
    res.status(401).json({ detail: "Token inválido o expirado." });
    return;
  }
  const user = db.prepare("SELECT * FROM users WHERE id = ? AND is_active = 1").get(payload.user_id) as
    | DbUser
    | undefined;
  if (!user) {
    res.status(401).json({ detail: "Usuario no encontrado." });
    return;
  }
  res.json({
    access: signAccessToken(user),
    refresh: signRefreshToken(user),
  });
});

router.post("/auth/register/", certUpload.single("certificate"), (req: Request, res: Response) => {
  const newUsersErr = requireFeatureEnabled("new_users", "El registro de nuevos usuarios está deshabilitado.");
  if (newUsersErr) {
    res.status(403).json({ detail: newUsersErr });
    return;
  }

  const settings = loadPlatformSettings();
  const role = String(req.body?.role || "client").trim().toLowerCase() === "professional" ? "professional" : "client";

  if (role === "professional") {
    const proErr = requireFeatureEnabled("professionals", "El registro de profesionales está deshabilitado.");
    if (proErr || settings.sections?.app_params?.reg_pros === false) {
      res.status(403).json({ detail: proErr || "El registro de profesionales está deshabilitado." });
      return;
    }
  } else if (settings.sections?.app_params?.reg_clients === false) {
    res.status(403).json({ detail: "El registro de clientes está deshabilitado." });
    return;
  }

  const email = String(req.body?.email || "").trim().toLowerCase();
  const rawUsername = String(req.body?.username || email.split("@")[0] || "").trim();
  const password = String(req.body?.password || "");
  const confirmPassword =
    req.body?.confirm_password !== undefined ? String(req.body.confirm_password) : undefined;
  const firstName = String(req.body?.first_name || "").trim();
  const lastName = String(req.body?.last_name || "").trim();
  const phone = String(req.body?.phone || "").trim();
  const city = String(req.body?.city || "Bogotá").trim() || "Bogotá";
  const documentId = String(req.body?.document_id || "").trim();
  const address = String(req.body?.address || "").trim();
  const profession = String(req.body?.profession || "").trim().slice(0, 120);

  if (!email || !email.includes("@")) {
    res.status(400).json({ detail: "Ingresa un correo electrónico válido." });
    return;
  }
  const minLen = Number(settings.sections?.security?.min_length ?? 6) || 6;
  if (password.length < minLen) {
    res.status(400).json({ detail: `La contraseña debe tener al menos ${minLen} caracteres.` });
    return;
  }
  if (confirmPassword !== undefined && confirmPassword !== password) {
    res.status(400).json({ detail: "Las contraseñas no coinciden." });
    return;
  }

  let certPath = "";
  if (req.file) {
    const ext = path.extname(req.file.originalname || "").replace(".", "").toLowerCase();
    if (!ALLOWED_CERT_EXT.has(ext)) {
      res.status(400).json({ certificate: ["El certificado debe ser un archivo PDF, JPG, PNG o WEBP."] });
      return;
    }
    certPath = saveBufferToMedia("certificates", req.file.originalname || `cert.${ext}`, req.file.buffer);
  }

  const existingEmail = db.prepare("SELECT id FROM users WHERE lower(email) = lower(?)").get(email);
  if (existingEmail) {
    res.status(400).json({ email: ["Ya existe un usuario con este correo electrónico."] });
    return;
  }

  let username = rawUsername.replace(/\s+/g, "_") || "usuario";
  let suffix = 1;
  while (db.prepare("SELECT id FROM users WHERE lower(username) = lower(?)").get(username)) {
    username = `${rawUsername.replace(/\s+/g, "_")}_${suffix}`;
    suffix += 1;
  }

  const ts = nowIso();
  const onboardingDone = firstName && lastName && (phone || address) ? 1 : 0;
  const info = db
    .prepare(
      `INSERT INTO users (
        email, username, password, first_name, last_name, role, phone, city,
        document_id, address, avatar_url, is_identity_verified, onboarding_completed,
        is_active, is_staff, is_superuser, is_blocked, date_joined, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 0, ?, 1, 0, 0, 0, ?, ?)`
    )
    .run(email, username, hashPassword(password), firstName, lastName, role, phone, city, documentId, address, onboardingDone, ts, ts);

  const userId = Number(info.lastInsertRowid);
  if (role === "client") {
    db.prepare(
      "INSERT INTO client_profiles (user_id, emergency_contact_name, emergency_contact_phone, preferred_payment_method, service_notes, created_at, updated_at) VALUES (?, '', '', 'Transferencia / Efectivo', '', ?, ?)"
    ).run(userId, ts, ts);
    if (address) {
      db.prepare(
        `INSERT INTO households (
          owner_id, label, property_type, address_line, neighborhood, city, country, is_default, created_at
        ) VALUES (?, 'Mi hogar', 'apartment', ?, '', ?, 'Colombia', 1, ?)`
      ).run(userId, address, city, ts);
    }
  } else {
    const displayName = `${firstName} ${lastName}`.trim() || username;
    let pSlug = slugify(displayName);
    let pSuffix = 1;
    while (db.prepare("SELECT id FROM professional_profiles WHERE slug = ?").get(pSlug)) {
      pSlug = `${slugify(displayName)}-${pSuffix}`;
      pSuffix += 1;
    }
    const headline = profession || "Profesional de servicios para el hogar";
    const pRes = db
      .prepare(
        `INSERT INTO professional_profiles (
          user_id, display_name, headline, slug, avatar_url, specialty_label, bio,
          latitude, longitude, neighborhood, city, coverage_radius_km, rating_avg,
          jobs_completed, response_time_minutes, is_verified, certificate_profession,
          certificate_file, certificate_uploaded_at, is_active, accepts_urgent, created_at
        ) VALUES (?, ?, ?, ?, '', ?, '', 4.6486, -74.0626, ?, ?, 15, '0.00', 0, 60, 0, ?, ?, ?, 1, 0, ?)`
      )
      .run(
        userId,
        displayName,
        headline,
        pSlug,
        profession,
        address || city,
        city,
        profession,
        certPath,
        certPath ? ts : null,
        ts
      );
    const profId = Number(pRes.lastInsertRowid);
    for (let weekday = 0; weekday < 6; weekday += 1) {
      db.prepare("INSERT INTO availability_slots (profile_id, weekday, start_time, end_time) VALUES (?, ?, '08:00:00', '18:00:00')").run(
        profId,
        weekday
      );
    }
  }

  addNotification({
    userId: null,
    title: `Nuevo registro (${role === "professional" ? "Profesional" : "Cliente"})`,
    text: `${`${firstName} ${lastName}`.trim() || username} (${email}) creó una cuenta en Serviprox.`,
    type: "usuario",
    link: role === "professional" ? "profesionales" : "usuarios",
    targetId: String(userId),
  });

  const created = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as DbUser;
  res.status(201).json(serializeUser(created));
});

function handleRegisterWorker(req: Request, res: Response) {
  const workerKey = String(req.body?.worker_key || req.body?.admin_key || "").trim();
  if (workerKey !== WORKER_KEY) {
    res.status(403).json({
      detail: "Clave de trabajador incorrecta. Autorización denegada para crear cuentas administrativas.",
    });
    return;
  }

  const username = String(req.body?.username || "").trim();
  if (!username || username.length < 3) {
    res.status(400).json({ detail: "El nombre de usuario debe tener al menos 3 caracteres." });
    return;
  }
  if (username.includes(" ")) {
    res.status(400).json({ detail: "El nombre de usuario no puede contener espacios." });
    return;
  }
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    res.status(400).json({ detail: "Por favor ingresa un correo electrónico corporativo válido." });
    return;
  }
  const fullName = String(req.body?.full_name || "").trim() || username;
  const password = String(req.body?.password || "");
  if (!password || password.length < 6) {
    res.status(400).json({ detail: "La contraseña debe tener al menos 6 caracteres." });
    return;
  }
  const phone = String(req.body?.phone || "").trim();
  const area = String(req.body?.area || "").trim() || "Mesa Técnica y Soporte";

  const parts = fullName.split(/\s+/, 2);
  const firstName = parts[0] || "";
  const lastName = fullName.slice(firstName.length).trim();

  const existing = db
    .prepare("SELECT * FROM users WHERE lower(username) = lower(?) OR lower(email) = lower(?) LIMIT 1")
    .get(username, email) as DbUser | undefined;

  const ts = nowIso();
  let userId: number;
  let actionDesc: string;

  if (existing) {
    db.prepare(
      `UPDATE users SET username = ?, email = ?, first_name = ?, last_name = ?, phone = ?,
       city = ?, address = ?, role = 'staff', is_staff = 1, is_superuser = 1, is_active = 1, password = ?
       WHERE id = ?`
    ).run(
      username,
      email,
      firstName || existing.first_name,
      lastName || existing.last_name,
      phone || existing.phone,
      area,
      `Área: ${area}`,
      hashPassword(password),
      existing.id
    );
    userId = existing.id;
    actionDesc = "actualizada y promovida a Personal Administrativo Staff con todos los permisos";
  } else {
    const info = db
      .prepare(
        `INSERT INTO users (
          email, username, password, first_name, last_name, role, phone, city,
          document_id, address, avatar_url, is_identity_verified, onboarding_completed,
          is_active, is_staff, is_superuser, is_blocked, date_joined, created_at
        ) VALUES (?, ?, ?, ?, ?, 'staff', ?, ?, '', ?, '', 1, 1, 1, 1, 1, 0, ?, ?)`
      )
      .run(email, username, hashPassword(password), firstName, lastName, phone, area, `Área: ${area}`, ts, ts);
    userId = Number(info.lastInsertRowid);
    actionDesc = "creada exitosamente en la base de datos con todos los permisos";
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as DbUser;
  addNotification({
    title: "Nuevo trabajador administrativo",
    text: `Se autorizó al trabajador ${fullName} (${user.username}) como Personal Administrativo con todos los permisos en el área '${area}'.`,
    type: "sistema",
  });

  res.status(201).json({
    success: true,
    message: `Cuenta administrativa '${user.username}' ${actionDesc}.`,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: `${user.first_name} ${user.last_name}`.trim() || user.username,
      role: user.role,
      is_staff: Boolean(user.is_staff),
      is_superuser: Boolean(user.is_superuser),
      area,
      phone: user.phone,
    },
  });
}

router.post("/auth/admin/register-worker/", handleRegisterWorker);
router.post("/admin/register-worker/", handleRegisterWorker);
router.post("/auth/register-worker/", handleRegisterWorker);
router.post("/auth/register-admin/", handleRegisterWorker);

const recoveryRequestRateMap = new Map<string, { count: number; resetAt: number }>();
const recoveryConfirmAttemptsMap = new Map<number, number>();

function isRecoveryRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = recoveryRequestRateMap.get(key);
  if (!entry || now > entry.resetAt) {
    recoveryRequestRateMap.set(key, { count: 1, resetAt: now + 15 * 60_000 });
    return false;
  }
  if (entry.count >= 8) return true;
  entry.count += 1;
  return false;
}

function findUserForRecovery(rawIdentifier: string, rawPhone: string, portal?: string): DbUser | undefined {
  const identifier = String(rawIdentifier || "").trim();
  const phoneCandidate = String(rawPhone || "").trim() || identifier;
  const isAdminPortal = String(portal || "").toLowerCase() === "admin";
  const adminClause = isAdminPortal ? " AND (is_staff = 1 OR is_superuser = 1 OR role = 'staff')" : "";

  if (identifier) {
    const lowerId = identifier.toLowerCase();
    const byEmailOrUser = db
      .prepare(`SELECT * FROM users WHERE (lower(email) = ? OR lower(username) = ?) AND is_active = 1${adminClause} LIMIT 1`)
      .get(lowerId, lowerId) as DbUser | undefined;
    if (byEmailOrUser) return byEmailOrUser;
  }

  const digits = normalizePhoneDigits(phoneCandidate);
  if (digits.length >= 7) {
    const candidates = db
      .prepare(`SELECT * FROM users WHERE phone IS NOT NULL AND trim(phone) != '' AND is_active = 1${adminClause}`)
      .all() as DbUser[];
    const match = candidates.find((u) => phoneMatches(u.phone, phoneCandidate));
    if (match) return match;
  }

  return undefined;
}

router.post("/auth/password-reset/request/", async (req: Request, res: Response) => {
  const rawIdentifier = String(
    req.body?.identifier || req.body?.email || req.body?.username || req.body?.phone || ""
  ).trim();
  const rawPhone = String(req.body?.phone || "").trim();
  const requestedChannel = String(req.body?.channel || "both").toLowerCase().trim();
  const portal = String(req.body?.portal || "").toLowerCase().trim();

  if (!rawIdentifier && !rawPhone) {
    res.status(400).json({ detail: "Ingresa tu correo electrónico, usuario o número de teléfono." });
    return;
  }

  const rateKey = `${req.ip || "local"}:${(rawIdentifier || rawPhone).toLowerCase()}`;
  if (isRecoveryRateLimited(rateKey)) {
    res.status(429).json({
      detail: "Demasiados intentos de recuperación. Espera unos minutos antes de solicitar otro código.",
    });
    return;
  }

  const user = findUserForRecovery(rawIdentifier, rawPhone, portal);
  if (!user) {
    res.json({
      detail: "Si los datos coinciden con una cuenta registrada, enviaremos el código de verificación al correo y/o teléfono asociado.",
      channels_sent: [],
      delivery_mode: "live",
    });
    return;
  }

  const ts = nowIso();
  db.prepare("UPDATE password_reset_codes SET used_at = ? WHERE user_id = ? AND used_at IS NULL").run(ts, user.id);
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  db.prepare("INSERT INTO password_reset_codes (user_id, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?)").run(
    user.id,
    hashPassword(code),
    expiresAt,
    ts
  );
  recoveryConfirmAttemptsMap.delete(user.id);

  const hasEmail = Boolean(user.email && user.email.includes("@"));
  const hasPhone = normalizePhoneDigits(user.phone || "").length >= 7;
  const wantEmail =
    requestedChannel === "email" ||
    requestedChannel === "both" ||
    (requestedChannel === "sms" && !hasPhone && hasEmail);
  const wantSms =
    requestedChannel === "sms" ||
    requestedChannel === "both" ||
    (requestedChannel === "email" && !hasEmail && hasPhone);

  const userName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username || user.email;
  const isAdmin = Boolean(user.is_staff || user.is_superuser || user.role === "staff");

  const [emailResult, smsResult] = await Promise.all([
    wantEmail && hasEmail
      ? sendRecoveryEmail({ to: user.email, code, userName, isAdmin })
      : Promise.resolve(null),
    wantSms && hasPhone
      ? sendRecoverySms({ to: user.phone, code, isAdmin })
      : Promise.resolve(null),
  ]);

  const channelsSent: Array<"email" | "sms"> = [];
  if (wantEmail && hasEmail) channelsSent.push("email");
  if (wantSms && hasPhone) channelsSent.push("sms");

  const anyLiveSent = Boolean(emailResult?.sent || smsResult?.sent);
  const maskedEmailVal = hasEmail ? maskEmail(user.email) : "";
  const maskedPhoneVal = hasPhone ? maskPhone(user.phone) : "";

  console.log(
    `[Serviprox Recovery] Código para ${user.email || user.username} (${channelsSent.join("+") || "none"}, live=${anyLiveSent}): ${code}`
  );

  const channelParts: string[] = [];
  if (channelsSent.includes("email") && maskedEmailVal) {
    channelParts.push(`correo (${maskedEmailVal})`);
  }
  if (channelsSent.includes("sms") && maskedPhoneVal) {
    channelParts.push(`SMS (${maskedPhoneVal})`);
  }

  const fallbackNote =
    requestedChannel === "sms" && !hasPhone && hasEmail
      ? " Esta cuenta no tiene teléfono registrado, así que lo enviamos a tu correo."
      : "";

  const detail = channelParts.length > 0
    ? `Código de 6 dígitos enviado por ${channelParts.join(" y ")}.${fallbackNote}`
    : "Se generó el código de recuperación para tu cuenta.";

  const responsePayload: Record<string, unknown> = {
    ok: true,
    detail,
    channels_sent: channelsSent,
    masked_email: maskedEmailVal || undefined,
    masked_phone: maskedPhoneVal || undefined,
    delivery_mode: anyLiveSent ? "live" : "preview",
  };

  if (!anyLiveSent && process.env.DISABLE_DEV_RECOVERY_PREVIEW !== "true") {
    responsePayload.preview_code = code;
    responsePayload.preview_notice =
      "Modo vista previa activo (sin servidor SMTP ni Twilio configurados en variables de entorno). Usa este código para completar la verificación.";
  }

  res.json(responsePayload);
});

router.post("/auth/password-reset/confirm/", (req: Request, res: Response) => {
  const rawIdentifier = String(
    req.body?.identifier || req.body?.email || req.body?.username || req.body?.phone || ""
  ).trim();
  const rawPhone = String(req.body?.phone || "").trim();
  const portal = String(req.body?.portal || "").toLowerCase().trim();
  const code = String(req.body?.code || "").replace(/\D/g, "");
  const newPassword = String(req.body?.new_password || "");

  const user = findUserForRecovery(rawIdentifier, rawPhone, portal);

  const resetRow = user
    ? (db
        .prepare(
          "SELECT * FROM password_reset_codes WHERE user_id = ? AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1"
        )
        .get(user.id, nowIso()) as { id: number; code_hash: string } | undefined)
    : undefined;

  if (!user || !resetRow) {
    res.status(400).json({ detail: "El código no es válido o ya venció. Solicita uno nuevo." });
    return;
  }

  if (code.length !== 6 || !verifyPassword(code, resetRow.code_hash)) {
    const attempts = (recoveryConfirmAttemptsMap.get(user.id) || 0) + 1;
    recoveryConfirmAttemptsMap.set(user.id, attempts);
    if (attempts >= 5) {
      db.prepare("UPDATE password_reset_codes SET used_at = ? WHERE id = ?").run(nowIso(), resetRow.id);
      recoveryConfirmAttemptsMap.delete(user.id);
      res.status(400).json({ detail: "Demasiados intentos fallidos. El código fue invalidado; solicita uno nuevo." });
      return;
    }
    res.status(400).json({ detail: "El código de 6 dígitos es incorrecto o ya venció." });
    return;
  }

  const minLen = Number(loadPlatformSettings().sections?.security?.min_length ?? 6) || 6;
  if (newPassword.length < minLen) {
    res.status(400).json({ detail: `La contraseña debe tener al menos ${minLen} caracteres.` });
    return;
  }

  db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashPassword(newPassword), user.id);
  db.prepare("UPDATE password_reset_codes SET used_at = ? WHERE id = ?").run(nowIso(), resetRow.id);
  recoveryConfirmAttemptsMap.delete(user.id);
  if (user.email) clearFailedLogin(user.email.toLowerCase());
  if (user.username) clearFailedLogin(user.username.toLowerCase());
  res.json({ ok: true, detail: "Contraseña actualizada correctamente. Ya puedes iniciar sesión." });
});

router.get("/auth/me/", requireAuth, (req: AuthedRequest, res: Response) => {
  res.json(serializeUser(req.user!));
});

router.patch("/auth/me/", requireAuth, (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  const body = req.body || {};
  const allowed = ["first_name", "last_name", "phone", "city", "document_id", "address", "avatar_url", "username", "email"] as const;

  const nextFields: Record<string, unknown> = {};
  for (const k of allowed) {
    if (body[k] !== undefined) nextFields[k] = String(body[k] || "").trim();
  }
  if (body.onboarding_completed !== undefined) {
    nextFields.onboarding_completed = body.onboarding_completed ? 1 : 0;
  }

  if (nextFields.username !== undefined) {
    const cleanUsername = String(nextFields.username);
    if (cleanUsername.length < 3) {
      res.status(400).json({ detail: "El nombre de usuario debe tener al menos 3 caracteres." });
      return;
    }
    if (cleanUsername.toLowerCase() !== user.username.toLowerCase()) {
      const clash = db
        .prepare("SELECT id FROM users WHERE lower(username) = lower(?) AND id != ?")
        .get(cleanUsername, user.id);
      if (clash) {
        res.status(400).json({ detail: "Este nombre de usuario ya está en uso.", username: ["Este nombre de usuario ya está en uso."] });
        return;
      }
    }
  }

  if (nextFields.email !== undefined) {
    const cleanEmail = String(nextFields.email).toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      res.status(400).json({ detail: "Ingresa un correo electrónico válido." });
      return;
    }
    nextFields.email = cleanEmail;
    if (cleanEmail !== user.email.toLowerCase()) {
      const emailClash = db
        .prepare("SELECT id FROM users WHERE lower(email) = lower(?) AND id != ?")
        .get(cleanEmail, user.id);
      if (emailClash) {
        res.status(400).json({ detail: "Este correo electrónico ya está registrado en otra cuenta.", email: ["Correo ya registrado."] });
        return;
      }
    }
  }

  const keys = Object.keys(nextFields);
  if (keys.length > 0) {
    const sql = `UPDATE users SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`;
    db.prepare(sql).run(...keys.map((k) => nextFields[k] as string | number), user.id);
  }

  if (body.client_profile && typeof body.client_profile === "object" && user.role === "client") {
    const cp = db.prepare("SELECT id FROM client_profiles WHERE user_id = ?").get(user.id) as { id: number } | undefined;
    const ts = nowIso();
    if (!cp) {
      db.prepare(
        `INSERT INTO client_profiles (user_id, emergency_contact_name, emergency_contact_phone, preferred_payment_method, service_notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        user.id,
        String(body.client_profile.emergency_contact_name || ""),
        String(body.client_profile.emergency_contact_phone || ""),
        String(body.client_profile.preferred_payment_method || "Transferencia / Efectivo"),
        String(body.client_profile.service_notes || ""),
        ts,
        ts
      );
    } else {
      const cpUpdates: string[] = [];
      const cpVals: Array<string | number> = [];
      for (const k of ["emergency_contact_name", "emergency_contact_phone", "preferred_payment_method", "service_notes"]) {
        if (body.client_profile[k] !== undefined) {
          cpUpdates.push(`${k} = ?`);
          cpVals.push(String(body.client_profile[k] || ""));
        }
      }
      if (cpUpdates.length) {
        cpUpdates.push("updated_at = ?");
        cpVals.push(ts, user.id);
        db.prepare(`UPDATE client_profiles SET ${cpUpdates.join(", ")} WHERE user_id = ?`).run(...cpVals);
      }
    }
  }

  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as DbUser;
  res.json(serializeUser(updated));
});

router.post("/auth/change-password/", requireAuth, async (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  const currentPassword = String(req.body?.current_password || "");
  const newPassword = String(req.body?.new_password || "");
  const confirmPassword =
    req.body?.confirm_password !== undefined ? String(req.body.confirm_password) : newPassword;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ detail: "Ingresa tu contraseña actual y la nueva contraseña." });
    return;
  }

  const secCfg = (loadPlatformSettings().sections?.security || {}) as Record<string, unknown>;
  const minLen = Math.max(8, Number(secCfg.password_min_length || 8));
  if (newPassword.length < minLen) {
    res.status(400).json({ detail: `La nueva contraseña debe tener al menos ${minLen} caracteres.` });
    return;
  }
  if (newPassword !== confirmPassword) {
    res.status(400).json({ detail: "La confirmación de la nueva contraseña no coincide." });
    return;
  }
  if (currentPassword === newPassword) {
    res.status(400).json({ detail: "La nueva contraseña debe ser diferente a la actual." });
    return;
  }

  const currentOk = await verifyPasswordAsync(currentPassword, user.password);
  if (!currentOk) {
    res.status(400).json({ detail: "La contraseña actual no es correcta." });
    return;
  }

  db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashPassword(newPassword), user.id);
  res.json({ ok: true, detail: "Contraseña actualizada correctamente." });
});

function purgeUserAccountData(userId: number) {
  db.exec("BEGIN");
  try {
    const profRows = db
      .prepare("SELECT id FROM professional_profiles WHERE user_id = ?")
      .all(userId) as Array<{ id: number }>;
    const profIds = profRows.map((r) => Number(r.id));

    const hhRows = db
      .prepare("SELECT id FROM households WHERE owner_id = ?")
      .all(userId) as Array<{ id: number }>;
    const hhIds = hhRows.map((r) => Number(r.id));

    const reqRows = db
      .prepare(
        hhIds.length > 0
          ? `SELECT id FROM service_requests WHERE client_id = ? OR household_id IN (${hhIds.map(() => "?").join(",")})`
          : "SELECT id FROM service_requests WHERE client_id = ?"
      )
      .all(userId, ...hhIds) as Array<{ id: number }>;
    const reqIds = reqRows.map((r) => Number(r.id));

    const orderConditions = ["client_id = ?"];
    const orderParams: Array<number> = [userId];
    if (profIds.length > 0) {
      orderConditions.push(`professional_id IN (${profIds.map(() => "?").join(",")})`);
      orderParams.push(...profIds);
    }
    if (reqIds.length > 0) {
      orderConditions.push(`service_request_id IN (${reqIds.map(() => "?").join(",")})`);
      orderParams.push(...reqIds);
    }
    const orderRows = db
      .prepare(`SELECT id FROM orders WHERE ${orderConditions.join(" OR ")}`)
      .all(...orderParams) as Array<{ id: number }>;
    const orderIds = orderRows.map((r) => Number(r.id));

    for (const oid of orderIds) {
      db.prepare("DELETE FROM order_admin_notes WHERE order_id = ?").run(oid);
      db.prepare("DELETE FROM order_events WHERE order_id = ?").run(oid);
      db.prepare("DELETE FROM work_evidence WHERE order_id = ?").run(oid);
      db.prepare("DELETE FROM reviews WHERE order_id = ?").run(oid);
      db.prepare("DELETE FROM refunds WHERE order_id = ?").run(oid);
      db.prepare("DELETE FROM payments WHERE order_id = ?").run(oid);
      db.prepare("DELETE FROM orders WHERE id = ?").run(oid);
    }

    db.prepare("DELETE FROM refunds WHERE payment_id IN (SELECT id FROM payments WHERE client_id = ?)").run(userId);
    db.prepare("UPDATE refunds SET requested_by_id = NULL WHERE requested_by_id = ?").run(userId);
    db.prepare("UPDATE refunds SET resolved_by_id = NULL WHERE resolved_by_id = ?").run(userId);
    db.prepare("UPDATE withdrawals SET resolved_by_id = NULL WHERE resolved_by_id = ?").run(userId);
    db.prepare("DELETE FROM payments WHERE client_id = ?").run(userId);

    for (const pid of profIds) {
      db.prepare("DELETE FROM withdrawals WHERE professional_id = ?").run(pid);
      db.prepare("DELETE FROM request_candidates WHERE professional_id = ?").run(pid);
      db.prepare("UPDATE service_requests SET professional_id = NULL WHERE professional_id = ?").run(pid);
      db.prepare("UPDATE pqr_reports SET contractor_id = NULL WHERE contractor_id = ?").run(pid);
      db.prepare("DELETE FROM professional_services WHERE profile_id = ?").run(pid);
      db.prepare("DELETE FROM portfolio_items WHERE profile_id = ?").run(pid);
      db.prepare("DELETE FROM availability_slots WHERE profile_id = ?").run(pid);
      db.prepare("DELETE FROM benefit_redemptions WHERE profile_id = ?").run(pid);
    }

    for (const rid of reqIds) {
      db.prepare("DELETE FROM service_request_images WHERE service_request_id = ?").run(rid);
      db.prepare("DELETE FROM request_candidates WHERE request_id = ?").run(rid);
      db.prepare("DELETE FROM service_requests WHERE id = ?").run(rid);
    }

    db.prepare("UPDATE service_request_images SET uploaded_by_id = NULL WHERE uploaded_by_id = ?").run(userId);
    db.prepare("UPDATE order_admin_notes SET author_id = NULL WHERE author_id = ?").run(userId);
    db.prepare("UPDATE order_events SET created_by_id = NULL WHERE created_by_id = ?").run(userId);
    db.prepare("UPDATE diagnostic_sessions SET user_id = NULL WHERE user_id = ?").run(userId);
    db.prepare("UPDATE pqr_reports SET client_id = NULL WHERE client_id = ?").run(userId);
    db.prepare("UPDATE app_problem_reports SET user_id = NULL WHERE user_id = ?").run(userId);
    db.prepare("UPDATE admin_audit_logs SET admin_user_id = NULL WHERE admin_user_id = ?").run(userId);

    const chatRows = db
      .prepare("SELECT id FROM support_chats WHERE user_id = ?")
      .all(userId) as Array<{ id: number }>;
    for (const ch of chatRows) {
      db.prepare("DELETE FROM support_chat_messages WHERE chat_id = ?").run(Number(ch.id));
      db.prepare("DELETE FROM support_chats WHERE id = ?").run(Number(ch.id));
    }

    db.prepare("DELETE FROM password_reset_codes WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM store_products WHERE owner_id = ?").run(userId);
    db.prepare("DELETE FROM households WHERE owner_id = ?").run(userId);
    db.prepare("DELETE FROM notifications WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM client_profiles WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM professional_profiles WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    db.exec("COMMIT");
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore rollback error
    }
    throw err;
  }
}

router.delete("/auth/me/delete/", requireAuth, (req: AuthedRequest, res: Response) => {
  const reason = String(req.body?.reason || "").trim();
  if (!reason) {
    res.status(400).json({ reason: "Indica el motivo para eliminar la cuenta." });
    return;
  }
  purgeUserAccountData(req.user!.id);
  res.status(200).json({ ok: true, detail: "Cuenta eliminada correctamente." });
});

router.post("/auth/become-professional/", requireAuth, certUpload.single("certificate"), (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  const proErr = requireFeatureEnabled("professionals", "El registro de profesionales está deshabilitado.");
  if (proErr) {
    res.status(403).json({ detail: proErr });
    return;
  }
  if (user.role === "staff") {
    res.status(400).json({ detail: "El equipo Serviprox no puede cambiar a este rol." });
    return;
  }

  const existing = db.prepare("SELECT * FROM professional_profiles WHERE user_id = ?").get(user.id) as
    | Record<string, unknown>
    | undefined;
  const profession = String(req.body?.profession || "").trim();
  const file = req.file;
  const needsCert = Boolean(file) || !existing?.certificate_file;

  if (needsCert) {
    if (!file) {
      res.status(400).json({ detail: "Debes adjuntar tu certificado o tarjeta profesional." });
      return;
    }
    const ext = path.extname(file.originalname || "").replace(".", "").toLowerCase();
    if (!ALLOWED_CERT_EXT.has(ext)) {
      res.status(400).json({ detail: "Formato de certificado inválido (PDF, JPG, PNG, WEBP)." });
      return;
    }
    if (!profession) {
      res.status(400).json({ detail: "Indica tu profesión o especialidad certificada." });
      return;
    }
  }

  const ts = nowIso();
  db.prepare("UPDATE users SET role = 'professional', onboarding_completed = 0 WHERE id = ?").run(user.id);

  let profId: number;
  if (!existing) {
    const displayName = `${user.first_name} ${user.last_name}`.trim() || user.username;
    const baseSlug = slugify(displayName);
    let slug = baseSlug;
    let c = 1;
    while (db.prepare("SELECT id FROM professional_profiles WHERE slug = ?").get(slug)) {
      slug = `${baseSlug}-${c}`;
      c += 1;
    }
    const pRes = db
      .prepare(
        `INSERT INTO professional_profiles (
          user_id, display_name, headline, slug, avatar_url, specialty_label, bio,
          latitude, longitude, neighborhood, city, coverage_radius_km, rating_avg,
          jobs_completed, response_time_minutes, is_verified, is_active, accepts_urgent, created_at
        ) VALUES (?, ?, 'Profesional de servicios para el hogar', ?, '', ?, '', 4.6486, -74.0626, ?, ?, 15, '0.00', 0, 60, 0, 1, 0, ?)`
      )
      .run(user.id, displayName, slug, profession, user.address || "Bogotá", user.city || "Bogota", ts);
    profId = Number(pRes.lastInsertRowid);
  } else {
    profId = Number(existing.id);
  }

  const slotCount = (db.prepare("SELECT COUNT(*) AS cnt FROM availability_slots WHERE profile_id = ?").get(profId) as { cnt: number }).cnt;
  if (slotCount === 0) {
    for (let weekday = 0; weekday < 6; weekday += 1) {
      db.prepare("INSERT INTO availability_slots (profile_id, weekday, start_time, end_time) VALUES (?, ?, '08:00:00', '18:00:00')").run(
        profId,
        weekday
      );
    }
  }

  if (file) {
    const relPath = saveBufferToMedia("certificates", file.originalname, file.buffer);
    db.prepare(
      "UPDATE professional_profiles SET certificate_file = ?, certificate_profession = ?, certificate_uploaded_at = ?, specialty_label = COALESCE(NULLIF(specialty_label, ''), ?), is_verified = 0 WHERE id = ?"
    ).run(relPath, profession, ts, profession, profId);
  }

  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as DbUser;
  res.json(serializeUser(updated));
});

router.get("/professionals/:id/certificate/", requireAuth, (req: AuthedRequest, res: Response) => {
  const id = Number.parseInt(String(req.params.id), 10);
  const prof = Number.isFinite(id)
    ? (db.prepare("SELECT * FROM professional_profiles WHERE id = ?").get(id) as Record<string, unknown> | undefined)
    : undefined;
  if (!prof || (!isStaffUser(req.user) && Number(prof.user_id) !== req.user!.id)) {
    res.status(404).json({ detail: "Certificado no encontrado." });
    return;
  }
  const certFile = String(prof.certificate_file || "");
  if (!certFile) {
    res.status(404).json({ detail: "Este profesional no ha cargado un certificado." });
    return;
  }
  const fullPath = path.join(MEDIA_DIR, certFile);
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ detail: "Archivo de certificado no encontrado en el servidor." });
    return;
  }
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Disposition", 'inline; filename="certificado"');
  res.type(guessMime(fullPath)).sendFile(fullPath);
});

router.post("/auth/become-client/", requireAuth, (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  if (user.role === "staff") {
    res.status(400).json({ detail: "El equipo Serviprox no puede cambiar a este rol." });
    return;
  }
  const ts = nowIso();
  db.prepare("UPDATE users SET role = 'client', onboarding_completed = 1 WHERE id = ?").run(user.id);
  const cp = db.prepare("SELECT id FROM client_profiles WHERE user_id = ?").get(user.id);
  if (!cp) {
    db.prepare(
      "INSERT INTO client_profiles (user_id, emergency_contact_name, emergency_contact_phone, preferred_payment_method, service_notes, created_at, updated_at) VALUES (?, '', '', 'Transferencia / Efectivo', '', ?, ?)"
    ).run(user.id, ts, ts);
  }
  const hh = db.prepare("SELECT id FROM households WHERE owner_id = ?").get(user.id);
  if (!hh) {
    db.prepare(
      "INSERT INTO households (owner_id, label, property_type, address_line, neighborhood, city, country, latitude, longitude, notes, is_default, created_at) VALUES (?, 'Mi hogar', 'apartment', ?, 'Bogotá', ?, 'Colombia', 4.6486, -74.0626, '', 1, ?)"
    ).run(user.id, user.address || "Bogotá", user.city || "Bogota", ts);
  }
  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as DbUser;
  res.json(serializeUser(updated));
});

router.post("/auth/onboarding/complete/", requireAuth, (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  const missing: string[] = [];
  for (const field of ["first_name", "last_name", "phone", "city"] as const) {
    if (!user[field]) missing.push(field);
  }
  if (user.role === "professional") {
    const prof = db.prepare("SELECT * FROM professional_profiles WHERE user_id = ?").get(user.id) as
      | Record<string, unknown>
      | undefined;
    if (!prof) {
      missing.push("professional_profile");
    } else {
      if (!prof.display_name) missing.push("display_name");
      if (!prof.headline) missing.push("headline");
      const srvCnt = (db.prepare("SELECT COUNT(*) AS cnt FROM professional_services WHERE profile_id = ?").get(prof.id as number) as { cnt: number }).cnt;
      if (srvCnt === 0) missing.push("services");
    }
  }
  if (missing.length > 0) {
    res.status(400).json({
      detail: "Completa la informacion requerida antes de finalizar onboarding.",
      missing,
    });
    return;
  }
  db.prepare("UPDATE users SET onboarding_completed = 1 WHERE id = ?").run(user.id);
  const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id) as DbUser;
  res.json(serializeUser(updated));
});

// ── Platform Settings ────────────────────────────────────────────────────────

router.get("/platform/settings/", (_req: Request, res: Response) => {
  const data = loadPlatformSettings();
  const payments = (data.sections?.payments || {}) as Record<string, unknown>;
  res.json({
    platform_name: data.platform_name,
    logo: data.logo,
    country: data.country,
    language: data.language,
    currency: data.currency,
    cities: data.cities,
    features: data.features,
    maintenance_message: data.maintenance_message,
    appearance: data.sections?.appearance || {},
    role_params: data.sections?.role_params || {},
    benefit_catalog: data.sections?.benefit_catalog || {},
    test_payment_enabled: Boolean(payments.test_payment_enabled),
    payment_form: payments.payment_form ?? null,
  });
});

router.get("/admin/settings/", requireStaff, (_req: AuthedRequest, res: Response) => {
  const data = loadPlatformSettings();
  const row = db.prepare("SELECT updated_at FROM platform_settings ORDER BY id ASC LIMIT 1").get() as
    | { updated_at: string }
    | undefined;
  const usersTotal = (db.prepare("SELECT COUNT(*) AS cnt FROM users").get() as { cnt: number }).cnt;
  const backups = fs.existsSync(BACKUP_DIR)
    ? fs
        .readdirSync(BACKUP_DIR)
        .filter((f) => f.startsWith("backup_") && f.endsWith(".json"))
        .sort()
        .reverse()
        .slice(0, 5)
        .map((name) => {
          const st = fs.statSync(path.join(BACKUP_DIR, name));
          return { name, size: st.size, created_at: st.mtimeMs / 1000 };
        })
    : [];
  const logs = db.prepare("SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 10").all() as Array<
    Record<string, unknown>
  >;

  res.json({
    ...data,
    system: {
      version: "v1.2.0",
      updated_at: row?.updated_at || "",
      db_engine: "sqlite",
      environment: process.env.NODE_ENV === "production" ? "Producción" : "Desarrollo",
      users_total: usersTotal,
      backups,
      history: logs.map((l) => ({
        date: String(l.created_at),
        action: String(l.action),
        target: String(l.target),
        admin: String(l.admin_name),
      })),
    },
  });
});

router.patch("/admin/settings/", requireStaff, (req: AuthedRequest, res: Response) => {
  const current = loadPlatformSettings() as Record<string, unknown>;
  const payload = (req.body || {}) as Record<string, unknown>;

  const textFields = [
    "platform_name",
    "description",
    "country",
    "timezone",
    "language",
    "date_format",
    "time_format",
    "currency",
    "maintenance_message",
  ];
  for (const key of textFields) {
    if (key in payload) {
      const value = String(payload[key] ?? "").trim();
      if ((key === "platform_name" || key === "country") && !value) {
        res.status(400).json({ detail: `El campo ${key} no puede estar vacío.` });
        return;
      }
      current[key] = value.slice(0, 1000);
    }
  }

  if ("logo" in payload) {
    const logo = String(payload.logo || "");
    if (logo && !logo.startsWith("data:image/")) {
      res.status(400).json({ detail: "Logo inválido." });
      return;
    }
    if (logo.length > 3_000_000) {
      res.status(400).json({ detail: "El logo supera el tamaño permitido." });
      return;
    }
    current.logo = logo;
  }

  if ("cities" in payload) {
    if (!Array.isArray(payload.cities)) {
      res.status(400).json({ detail: "Ciudades inválidas." });
      return;
    }
    current.cities = payload.cities.map((c) => String(c).trim()).filter(Boolean).slice(0, 200);
  }

  for (const group of ["email", "social", "documents"] as const) {
    if (payload[group] && typeof payload[group] === "object") {
      const curGroup = (current[group] || {}) as Record<string, unknown>;
      const inGroup = payload[group] as Record<string, unknown>;
      for (const [k, v] of Object.entries(inGroup)) {
        curGroup[k] = typeof v === "boolean" ? v : String(v ?? "").trim().slice(0, 20000);
      }
      current[group] = curGroup;
    }
  }

  if (payload.features && typeof payload.features === "object") {
    const curFeatures = (current.features || {}) as Record<string, boolean>;
    const inFeatures = payload.features as Record<string, unknown>;
    for (const k of Object.keys(DEFAULT_PLATFORM_SETTINGS.features)) {
      if (k in inFeatures) curFeatures[k] = Boolean(inFeatures[k]);
    }
    current.features = curFeatures;
  }

  if (payload.sections && typeof payload.sections === "object") {
    const curSections = (current.sections || {}) as Record<string, unknown>;
    const inSections = payload.sections as Record<string, unknown>;
    for (const [name, val] of Object.entries(inSections)) {
      if (!val || typeof val !== "object") continue;
      if (name === "payments") {
        const prevPay = (curSections.payments || {}) as Record<string, unknown>;
        curSections.payments = {
          ...(val as Record<string, unknown>),
          test_payment_enabled: Boolean(prevPay.test_payment_enabled),
        };
      } else {
        curSections[name] = val;
      }
    }
    current.sections = curSections;
  }

  const saved = savePlatformSettings(current);
  addAuditLog(req.user!.email, "Configuración actualizada", "Plataforma", "", req.user!.id);
  res.json(saved);
});

router.post("/admin/settings/test-payment/", requireStaff, (req: AuthedRequest, res: Response) => {
  const enabled = Boolean(req.body?.enabled);
  const testKey = process.env.TEST_PAYMENT_KEY || "serviprox-test-payment";
  if (enabled) {
    const key = String(req.body?.key || "");
    if (key !== testKey) {
      res.status(403).json({ detail: "Clave incorrecta." });
      return;
    }
  }
  const current = loadPlatformSettings();
  const sections = current.sections as Record<string, Record<string, unknown>>;
  sections.payments = { ...(sections.payments || {}), test_payment_enabled: enabled };
  const saved = savePlatformSettings(current);
  addAuditLog(req.user!.email, `Pago de prueba ${enabled ? "activado" : "desactivado"}`, "Pagos", "", req.user!.id);
  res.json(saved);
});

function deleteAccountByKindAndId(
  rawKind: string,
  rawId: string | number,
  staffUser: DbUser
): { status: number; body: Record<string, unknown> } {
  const kind = String(rawKind || "").toLowerCase().trim();
  const cleanId = String(rawId ?? "").trim().replace(/^(pro-|client-|user-|admin-|staff-)/i, "");
  const pk = Number.parseInt(cleanId, 10);

  const allowedKinds = new Set(["client", "professional", "admin", "staff"]);
  if (!allowedKinds.has(kind)) {
    return { status: 400, body: { detail: "Tipo de cuenta inválido." } };
  }

  let user: DbUser | undefined;
  if (Number.isFinite(pk)) {
    if (kind === "professional") {
      const prof = db
        .prepare("SELECT user_id FROM professional_profiles WHERE id = ? OR user_id = ? LIMIT 1")
        .get(pk, pk) as { user_id: number } | undefined;
      if (prof) {
        user = db.prepare("SELECT * FROM users WHERE id = ?").get(prof.user_id) as DbUser | undefined;
      } else {
        user = db
          .prepare("SELECT * FROM users WHERE id = ? AND role = 'professional'")
          .get(pk) as DbUser | undefined;
      }
    } else {
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(pk) as DbUser | undefined;
    }
  } else if (cleanId.includes("@")) {
    user = db.prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1").get(cleanId) as
      | DbUser
      | undefined;
  } else {
    return { status: 400, body: { detail: "ID inválido." } };
  }

  if (!user) {
    return { status: 404, body: { detail: "La cuenta no existe." } };
  }

  if (user.id === staffUser.id) {
    return {
      status: 403,
      body: { detail: "No puedes eliminar tu propia cuenta administrativa mientras tienes la sesión activa." },
    };
  }

  const targetIsAdmin = Boolean(user.is_staff || user.is_superuser || user.role === "staff");
  if (targetIsAdmin) {
    if (kind !== "admin" && kind !== "staff") {
      return {
        status: 403,
        body: { detail: "Para eliminar una cuenta administrativa debes hacerlo desde la gestión de cuentas administrativas." },
      };
    }
    if (user.is_superuser && !staffUser.is_superuser) {
      return {
        status: 403,
        body: { detail: "Solo un Superadministrador puede eliminar otra cuenta Superadmin." },
      };
    }
    const remainingAdmins = db
      .prepare("SELECT COUNT(*) as c FROM users WHERE is_active = 1 AND (is_staff = 1 OR is_superuser = 1 OR role = 'staff')")
      .get() as { c: number };
    if (Number(remainingAdmins?.c || 0) <= 1) {
      return {
        status: 403,
        body: { detail: "Debe permanecer al menos una cuenta administrativa activa en la plataforma." },
      };
    }
  }

  const label = `${user.first_name} ${user.last_name}`.trim() || user.email;
  purgeUserAccountData(user.id);
  addAuditLog(staffUser.email, "Eliminar cuenta", `${label} (${kind})`, "", staffUser.id);
  return {
    status: 200,
    body: {
      ok: true,
      deleted_id: user.id,
      kind,
      message: `La cuenta de ${label} fue eliminada de la base de datos.`,
      detail: `La cuenta de ${label} fue eliminada de la base de datos.`,
    },
  };
}

router.delete("/admin/accounts/:kind/:id/", requireStaff, (req: AuthedRequest, res: Response) => {
  const result = deleteAccountByKindAndId(String(req.params.kind), String(req.params.id), req.user!);
  res.status(result.status).json(result.body);
});

router.post("/admin/accounts/:kind/:id/delete/", requireStaff, (req: AuthedRequest, res: Response) => {
  const result = deleteAccountByKindAndId(String(req.params.kind), String(req.params.id), req.user!);
  res.status(result.status).json(result.body);
});

router.post("/admin/system-action/", requireStaff, (req: AuthedRequest, res: Response) => {
  const action = String(req.body?.action || "");
  const adminName = `${req.user!.first_name} ${req.user!.last_name}`.trim() || req.user!.email;

  if (action === "toggle_maintenance") {
    const current = loadPlatformSettings();
    current.features.maintenance = Boolean(req.body?.enabled);
    const saved = savePlatformSettings(current);
    addAuditLog(adminName, "Modo mantenimiento", "Plataforma", String(saved.features.maintenance), req.user!.id);
    res.json({ detail: "Modo mantenimiento actualizado.", settings: saved });
    return;
  }

  if (action === "backup_now") {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
    const filename = `backup_${stamp}.json`;
    const records = exportFullBackup();
    fs.writeFileSync(path.join(BACKUP_DIR, filename), JSON.stringify(records, null, 2), "utf8");
    const current = loadPlatformSettings();
    current.last_backup = d.toISOString();
    savePlatformSettings(current);
    addAuditLog(adminName, "Copia de seguridad", filename, "", req.user!.id);
    res.json({ detail: `Copia creada: ${filename}`, last_backup: d.toISOString() });
    return;
  }

  if (req.body?.confirm !== "BORRAR") {
    res.status(400).json({ detail: "Debes confirmar la acción escribiendo BORRAR." });
    return;
  }

  if (action === "clear_cache") {
    const deleted = {
      orders: db.prepare("DELETE FROM orders").run().changes,
      service_requests: db.prepare("DELETE FROM service_requests").run().changes,
      pqrs: db.prepare("DELETE FROM pqr_reports").run().changes,
      technical_issues: db.prepare("DELETE FROM app_problem_reports").run().changes,
      notifications: db.prepare("DELETE FROM notifications").run().changes,
    };
    addAuditLog(adminName, "Limpiar caché", "Pedidos, PQR y fallas técnicas", "", req.user!.id);
    res.json({ detail: "Pedidos, PQR y fallas técnicas eliminados.", deleted });
    return;
  }

  if (action === "reset_services") {
    db.prepare("DELETE FROM orders").run();
    db.prepare("DELETE FROM service_requests").run();
    db.prepare("DELETE FROM households").run();
    db.prepare("DELETE FROM pqr_reports").run();
    db.prepare("DELETE FROM app_problem_reports").run();
    const deleted = db.prepare("DELETE FROM users WHERE is_staff = 0 AND role != 'staff'").run().changes;
    addAuditLog(adminName, "Reiniciar servicios", "Cuentas de clientes y profesionales", "", req.user!.id);
    res.json({ detail: "Cuentas de clientes y profesionales eliminadas.", deleted });
    return;
  }

  if (action === "cleanup_logs") {
    const months = Math.min(Math.max(Number.parseInt(String(req.body?.months || "3"), 10) || 3, 1), 60);
    const cutoff = new Date(Date.now() - months * 30 * 86_400_000).toISOString();
    const deleted = db.prepare("DELETE FROM admin_audit_logs WHERE created_at < ?").run(cutoff).changes;
    res.json({ detail: `Registros eliminados: ${deleted}.` });
    return;
  }

  if (action === "delete_backup") {
    const name = path.basename(String(req.body?.name || ""));
    const target = path.join(BACKUP_DIR, name);
    if (name && fs.existsSync(target) && fs.statSync(target).isFile()) {
      fs.unlinkSync(target);
      addAuditLog(adminName, "Eliminar copia de seguridad", name, "", req.user!.id);
      res.json({ detail: `Copia eliminada: ${name}` });
      return;
    }
    res.status(404).json({ detail: "Copia no encontrada." });
    return;
  }

  if (action === "restore_backup") {
    const files = fs.existsSync(BACKUP_DIR)
      ? fs
          .readdirSync(BACKUP_DIR)
          .filter((f) => f.startsWith("backup_") && f.endsWith(".json"))
          .sort()
      : [];
    const name = req.body?.name ? path.basename(String(req.body.name)) : "";
    const matched = name ? files.filter((f) => f === name) : files;
    if (!matched.length) {
      res.status(404).json({ detail: "No hay copias de seguridad." });
      return;
    }
    const target = matched[matched.length - 1];
    const records = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, target), "utf8"));
    importFixtureRecords(records);
    res.json({ detail: `Copia restaurada: ${target}` });
    return;
  }

  if (action === "delete_platform") {
    db.prepare("DELETE FROM orders").run();
    db.prepare("DELETE FROM service_requests").run();
    db.prepare("DELETE FROM households").run();
    db.prepare("DELETE FROM pqr_reports").run();
    db.prepare("DELETE FROM app_problem_reports").run();
    db.prepare("DELETE FROM services").run();
    db.prepare("DELETE FROM service_categories").run();
    db.prepare("DELETE FROM users WHERE is_staff = 0 AND role != 'staff'").run();
    db.prepare("DELETE FROM platform_settings").run();
    addAuditLog(adminName, "Eliminar plataforma", "Todos los datos", "", req.user!.id);
    res.json({ detail: "Todos los datos de la plataforma fueron eliminados." });
    return;
  }

  res.status(400).json({ detail: "Acción no soportada." });
});

// ── Admin Overview & Actions ─────────────────────────────────────────────────

router.get("/admin/overview/", requireStaff, (_req: AuthedRequest, res: Response) => {
  const clientsCount = (db.prepare("SELECT COUNT(*) AS cnt FROM users WHERE role = 'client'").get() as { cnt: number }).cnt;
  const prosCount = (
    db
      .prepare(
        "SELECT COUNT(*) AS cnt FROM professional_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.is_active = 1 AND u.is_active = 1"
      )
      .get() as { cnt: number }
  ).cnt;
  const hiredServicesCount = (db.prepare("SELECT COUNT(*) AS cnt FROM orders").get() as { cnt: number }).cnt;
  const pendingPubsCount = (
    db.prepare("SELECT COUNT(*) AS cnt FROM service_requests WHERE status = 'open'").get() as { cnt: number }
  ).cnt;
  const openPqrsCount = (
    db.prepare("SELECT COUNT(*) AS cnt FROM pqr_reports WHERE status NOT IN ('resuelto', 'sancionado')").get() as { cnt: number }
  ).cnt;
  const techIssuesCount = (
    db.prepare("SELECT COUNT(*) AS cnt FROM app_problem_reports WHERE status != 'resuelto'").get() as { cnt: number }
  ).cnt;
  const adminsCount = (
    db.prepare("SELECT COUNT(*) AS cnt FROM users WHERE is_staff = 1 OR role = 'staff'").get() as { cnt: number }
  ).cnt;

  const todayPrefix = nowIso().slice(0, 10);
  const reports = {
    blocked_accounts_today: (
      db.prepare("SELECT COUNT(*) AS cnt FROM users WHERE is_blocked = 1 AND blocked_at LIKE ?").get(`${todayPrefix}%`) as {
        cnt: number;
      }
    ).cnt,
    complaints: (db.prepare("SELECT COUNT(*) AS cnt FROM pqr_reports WHERE pqr_type = 'queja'").get() as { cnt: number }).cnt,
    rejected_publications: (
      db.prepare("SELECT COUNT(*) AS cnt FROM service_requests WHERE status = 'rejected'").get() as { cnt: number }
    ).cnt,
    cancelled_services: (
      db.prepare("SELECT COUNT(*) AS cnt FROM orders WHERE status = 'cancelled'").get() as { cnt: number }
    ).cnt,
    technical_issues: (db.prepare("SELECT COUNT(*) AS cnt FROM app_problem_reports").get() as { cnt: number }).cnt,
  };

  const recentItems: Array<Record<string, unknown>> = [];
  const reqRows = db
    .prepare(
      `SELECT sr.*, u.first_name, u.last_name, u.username, u.avatar_url, s.name AS service_name
       FROM service_requests sr
       JOIN users u ON u.id = sr.client_id
       LEFT JOIN services s ON s.id = sr.selected_service_id
       ORDER BY sr.created_at DESC LIMIT 6`
    )
    .all() as Array<Record<string, unknown>>;

  const reqStatusMap: Record<string, [string, string]> = {
    open: ["En revisión", "ad-status-revision"],
    draft: ["Borrador", "ad-status-revision"],
    matched: ["En proceso", "ad-status-proceso"],
    accepted: ["Aprobado", "ad-status-aprobado"],
    rejected: ["Rechazado", "ad-status-rechazado"],
    closed: ["Cerrado", "ad-status-aprobado"],
  };

  for (const r of reqRows) {
    const [displayStatus, statusCls] = reqStatusMap[String(r.status)] || ["En revisión", "ad-status-revision"];
    const full = `${String(r.first_name || "")} ${String(r.last_name || "")}`.trim() || String(r.username);
    const userDisplay =
      r.first_name && r.last_name ? `${String(r.first_name)} ${String(r.last_name)[0]}.` : full;
    recentItems.push({
      id: `srv-${r.id}`,
      raw_id: Number(r.id),
      type: "Servicio",
      typeIcon: "🔧",
      typeColor: "#dbeafe",
      title: String(r.service_name || r.description || "Solicitud de servicio"),
      userName: userDisplay,
      userAvatar:
        String(r.avatar_url || "") ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(full)}&background=1e3a8a&color=fff`,
      date: formatDateDmy(String(r.created_at)),
      status: displayStatus,
      statusClass: statusCls,
      targetModel: "ServiceRequest",
    });
  }

  const pqrStatusMap: Record<string, [string, string]> = {
    radicado: ["Abierto", "ad-status-abierto"],
    en_revision: ["En revisión", "ad-status-revision"],
    conciliacion: ["En proceso", "ad-status-proceso"],
    resuelto: ["Aprobado", "ad-status-aprobado"],
    sancionado: ["Rechazado", "ad-status-rechazado"],
  };
  for (const pqr of db.prepare("SELECT * FROM pqr_reports ORDER BY created_at DESC LIMIT 5").all() as Array<
    Record<string, unknown>
  >) {
    const [st, cls] = pqrStatusMap[String(pqr.status)] || ["Abierto", "ad-status-abierto"];
    recentItems.push({
      id: `pqr-${pqr.id}`,
      raw_id: Number(pqr.id),
      type: "PQR",
      typeIcon: "💬",
      typeColor: "#fee2e2",
      title: `[${pqr.radicado_number}] ${String(pqr.description || "").slice(0, 35)}...`,
      userName: String(pqr.client_name || "Cliente"),
      userAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
      date: formatDateDmy(String(pqr.created_at)),
      status: st,
      statusClass: cls,
      targetModel: "PQRReport",
    });
  }

  const probStatusMap: Record<string, [string, string]> = {
    recibido: ["Abierto", "ad-status-abierto"],
    en_proceso: ["En proceso", "ad-status-proceso"],
    resuelto: ["Aprobado", "ad-status-aprobado"],
  };
  for (const prob of db.prepare("SELECT * FROM app_problem_reports ORDER BY created_at DESC LIMIT 5").all() as Array<
    Record<string, unknown>
  >) {
    const [st, cls] = probStatusMap[String(prob.status)] || ["En proceso", "ad-status-proceso"];
    recentItems.push({
      id: `fal-${prob.id}`,
      raw_id: Number(prob.id),
      type: "Falla",
      typeIcon: "🐞",
      typeColor: "#f3e8ff",
      title: String(prob.category_label || String(prob.description || "").slice(0, 35)),
      userName: String(prob.reported_by || "Usuario"),
      userAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
      date: formatDateDmy(String(prob.created_at)),
      status: st,
      statusClass: cls,
      targetModel: "AppProblemReport",
    });
  }

  const topProsRows = db
    .prepare(
      `SELECT pp.*, u.email, u.phone, u.is_active AS user_active
       FROM professional_profiles pp
       JOIN users u ON u.id = pp.user_id
       WHERE pp.is_active = 1 AND u.is_active = 1
       ORDER BY CAST(pp.rating_avg AS REAL) DESC, pp.jobs_completed DESC LIMIT 8`
    )
    .all() as Array<Record<string, unknown>>;

  const topPros = topProsRows.map((p) => {
    const rating = Number(p.rating_avg || 0);
    const tier = rating >= 4.8 ? "Nivel Oro" : rating >= 4.5 ? "Nivel Plata" : "Nivel Bronce";
    return {
      id: `pro-${p.id}`,
      raw_id: Number(p.id),
      name: String(p.display_name),
      specialty: String(p.specialty_label || p.headline || "Especialista Serviprox"),
      rating,
      tier,
      avatar:
        String(p.avatar_url || "") ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(String(p.display_name))}&background=0284c7&color=fff`,
      points: Number(p.points || 0),
      completedJobs: Number(p.jobs_completed || 0),
      verified: Boolean(p.is_verified),
      blocked: !p.is_active || !p.user_active,
      email: String(p.email || ""),
      phone: String(p.phone || ""),
      city: String(p.city || ""),
    };
  });

  const auditRows = db.prepare("SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 20").all() as Array<
    Record<string, unknown>
  >;

  res.json({
    database: {
      connected: true,
      engine: "sqlite",
      database_name: path.basename(DB_PATH),
      timestamp: nowIso(),
    },
    kpis: {
      clients: clientsCount,
      professionals: prosCount,
      hired_services: hiredServicesCount,
      pending_publications: pendingPubsCount,
      open_pqrs: openPqrsCount,
      technical_issues: techIssuesCount,
      raw_clients: clientsCount,
      raw_pros: prosCount,
      raw_services: hiredServicesCount,
      raw_publications: pendingPubsCount,
      raw_pqrs: openPqrsCount,
      raw_issues: techIssuesCount,
    },
    reports,
    charts: {
      user_distribution: {
        clients: clientsCount,
        professionals: prosCount,
        administrators: adminsCount,
      },
      pqr_chart: {
        radicado: (db.prepare("SELECT COUNT(*) AS cnt FROM pqr_reports WHERE status = 'radicado'").get() as { cnt: number }).cnt,
        en_revision: (
          db.prepare("SELECT COUNT(*) AS cnt FROM pqr_reports WHERE status = 'en_revision'").get() as { cnt: number }
        ).cnt,
        conciliacion: (
          db.prepare("SELECT COUNT(*) AS cnt FROM pqr_reports WHERE status = 'conciliacion'").get() as { cnt: number }
        ).cnt,
        resuelto: (db.prepare("SELECT COUNT(*) AS cnt FROM pqr_reports WHERE status = 'resuelto'").get() as { cnt: number }).cnt,
      },
    },
    requests_list: recentItems,
    top_professionals: topPros,
    audit_logs: auditRows.map((l) => ({
      id: `aud-${l.id}`,
      adminName: String(l.admin_name),
      action: String(l.action),
      target: String(l.target),
      date: formatDateTimeDmy(String(l.created_at)),
      reason: String(l.reason || ""),
    })),
  });
});

router.post("/admin/action/", requireStaff, adminUpload.array("attachments", 5), (req: AuthedRequest, res: Response) => {
  const actionName = String(req.body?.action || "");
  const targetId = req.body?.target_id;
  const reason = String(req.body?.reason || "Acción administrativa ejecutada desde el panel");
  const adminName = String(req.body?.admin_name || "Superadministrador");
  const ts = nowIso();

  if (actionName === "approve_request" || actionName === "reject_request") {
    const statusVal = actionName === "approve_request" ? "accepted" : "rejected";
    const targetStr = String(targetId || "");
    const cleanId = targetStr.replace(/^(req-|srv-)/, "");
    if (/^\d+$/.test(cleanId)) {
      const sr = db.prepare("SELECT * FROM service_requests WHERE id = ?").get(Number(cleanId)) as
        | Record<string, unknown>
        | undefined;
      if (sr) {
        db.prepare("UPDATE service_requests SET status = ?, updated_at = ? WHERE id = ?").run(statusVal, ts, sr.id as number);
        addAuditLog(
          adminName,
          statusVal === "accepted" ? "Aprobación de solicitud" : "Rechazo de solicitud",
          `Solicitud #${sr.id}`,
          reason,
          req.user!.id
        );
        res.json({ ok: true, message: `Solicitud #${sr.id} actualizada a ${statusVal} en la base de datos.` });
        return;
      }
    }
    if (targetStr.startsWith("pqr-")) {
      const pid = targetStr.replace("pqr-", "");
      if (/^\d+$/.test(pid)) {
        const pqr = db.prepare("SELECT * FROM pqr_reports WHERE id = ?").get(Number(pid)) as
          | Record<string, unknown>
          | undefined;
        if (pqr) {
          const st = actionName === "approve_request" ? "resuelto" : "sancionado";
          db.prepare("UPDATE pqr_reports SET status = ?, admin_resolution_notes = ?, updated_at = ? WHERE id = ?").run(
            st,
            reason,
            ts,
            pqr.id as number
          );
          addAuditLog(adminName, "Resolución de PQR", `PQR ${pqr.radicado_number}`, reason, req.user!.id);
          res.json({ ok: true, message: `PQR ${pqr.radicado_number} actualizada en la base de datos.` });
          return;
        }
      }
    }
    if (targetStr.startsWith("fal-")) {
      const fid = targetStr.replace("fal-", "");
      if (/^\d+$/.test(fid)) {
        const fal = db.prepare("SELECT * FROM app_problem_reports WHERE id = ?").get(Number(fid)) as
          | Record<string, unknown>
          | undefined;
        if (fal) {
          db.prepare("UPDATE app_problem_reports SET status = 'resuelto', response_notes = ? WHERE id = ?").run(
            reason,
            fal.id as number
          );
          addAuditLog(adminName, "Solución de falla técnica", `Ticket ${fal.ticket_number}`, reason, req.user!.id);
          res.json({ ok: true, message: `Ticket ${fal.ticket_number} resuelto en la base de datos.` });
          return;
        }
      }
    }
    res.json({ ok: true, message: "Acción registrada en la base de datos." });
    return;
  }

  if (actionName === "block_user" || actionName === "unblock_user") {
    const isBlocking = actionName === "block_user";
    const cleanId = String(targetId || "").replace(/^(user-|pro-)/, "");
    let u: DbUser | undefined;
    if (/^\d+$/.test(cleanId)) {
      u = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(cleanId)) as DbUser | undefined;
      if (!u) {
        const prof = db.prepare("SELECT user_id FROM professional_profiles WHERE id = ?").get(Number(cleanId)) as
          | { user_id: number }
          | undefined;
        if (prof) u = db.prepare("SELECT * FROM users WHERE id = ?").get(prof.user_id) as DbUser | undefined;
      }
    }
    if (!u && targetId) {
      u = db
        .prepare("SELECT * FROM users WHERE lower(email) = lower(?) OR lower(first_name) LIKE lower(?) LIMIT 1")
        .get(String(targetId), `%${String(targetId)}%`) as DbUser | undefined;
    }

    const blockType = String(req.body?.block_type || "temporal");
    const blockDuration = Number.parseInt(String(req.body?.block_duration || "7"), 10) || 7;
    if (u) {
      const blockedUntil =
        isBlocking && blockType === "temporal" ? new Date(Date.now() + blockDuration * 86_400_000).toISOString() : null;
      db.prepare(
        `UPDATE users SET is_active = ?, is_blocked = ?, block_type = ?, block_reason = ?,
         block_duration_days = ?, blocked_at = ?, blocked_until = ? WHERE id = ?`
      ).run(
        isBlocking ? 0 : 1,
        isBlocking ? 1 : 0,
        isBlocking ? blockType : "",
        isBlocking ? reason : "",
        isBlocking && blockType === "temporal" ? blockDuration : 0,
        isBlocking ? ts : null,
        blockedUntil,
        u.id
      );
      db.prepare("UPDATE professional_profiles SET is_active = ? WHERE user_id = ?").run(isBlocking ? 0 : 1, u.id);
      const uName = `${u.first_name} ${u.last_name}`.trim() || u.email;
      addAuditLog(
        adminName,
        isBlocking
          ? blockType === "temporal"
            ? `Bloqueo temporal (${blockDuration} días)`
            : "Bloqueo definitivo de cuenta"
          : "Desbloqueo de cuenta",
        `${uName} (${u.role})`,
        reason,
        req.user!.id
      );
      addNotification({
        userId: u.id,
        title: `Aviso disciplinario: ${uName}`,
        text: `${isBlocking ? "Cuenta suspendida." : "Cuenta reactivada con éxito."} Motivo: ${reason.slice(0, 100)}`,
        type: "bloqueo",
        targetId: String(u.id),
      });
      res.json({
        ok: true,
        message: `Usuario ${uName} ${isBlocking ? "bloqueado" : "desbloqueado"} con éxito en la base de datos.`,
        is_active: !isBlocking,
        is_blocked: isBlocking,
        block_type: isBlocking ? blockType : "",
        block_duration_days: isBlocking && blockType === "temporal" ? blockDuration : 0,
        block_reason: isBlocking ? reason : "",
        blocked_until: blockedUntil,
        blocked_at: isBlocking ? ts : null,
      });
      return;
    }
    addAuditLog(adminName, "Bloqueo de usuario", String(targetId || ""), reason, req.user!.id);
    res.json({ ok: true, message: `Bloqueo registrado para ${targetId}.` });
    return;
  }

  if (actionName === "toggle_user_verification") {
    const cleanId = String(targetId || "").replace(/^(user-|pro-)/, "");
    if (/^\d+$/.test(cleanId)) {
      const prof = db.prepare("SELECT * FROM professional_profiles WHERE id = ?").get(Number(cleanId)) as
        | Record<string, unknown>
        | undefined;
      if (prof) {
        const nextV = prof.is_verified ? 0 : 1;
        db.prepare("UPDATE professional_profiles SET is_verified = ? WHERE id = ?").run(nextV, prof.id as number);
        addAuditLog(
          adminName,
          nextV ? "Aprobación de tarjeta profesional" : "Revocación de verificación",
          `${prof.display_name}`,
          reason,
          req.user!.id
        );
        res.json({
          ok: true,
          message: `Estado de verificación de ${prof.display_name} actualizado a ${nextV ? "Aprobado" : "Pendiente"}.`,
          is_verified: Boolean(nextV),
        });
        return;
      }
      const u = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(cleanId)) as DbUser | undefined;
      if (u) {
        const nextV = u.is_identity_verified ? 0 : 1;
        db.prepare("UPDATE users SET is_identity_verified = ? WHERE id = ?").run(nextV, u.id);
        const uName = `${u.first_name} ${u.last_name}`.trim() || u.email;
        addAuditLog(
          adminName,
          nextV ? "Validación de documento de identidad" : "Revocación de identidad",
          uName,
          reason,
          req.user!.id
        );
        res.json({
          ok: true,
          message: `Identidad de ${uName} actualizada a ${nextV ? "Verificada" : "Pendiente"}.`,
          is_verified: Boolean(nextV),
        });
        return;
      }
    }
    res.status(404).json({ error: "Usuario no encontrado." });
    return;
  }

  if (actionName === "change_user_role") {
    const rawUserId = req.body?.user_id || targetId;
    const cleanId = String(rawUserId || "").replace(/^(user-|pro-)/, "");
    const newRole = String(req.body?.new_role || "client").toLowerCase();
    const u = /^\d+$/.test(cleanId)
      ? (db.prepare("SELECT * FROM users WHERE id = ?").get(Number(cleanId)) as DbUser | undefined)
      : (db.prepare("SELECT * FROM users WHERE lower(email) = lower(?) LIMIT 1").get(String(rawUserId || "")) as
          | DbUser
          | undefined);
    if (!u) {
      res.status(404).json({ error: "Usuario no encontrado en la base de datos." });
      return;
    }

    let dbRole = "client";
    let isStaff = 0;
    let isSuper = 0;
    if (newRole === "client") {
      dbRole = "client";
      if (!db.prepare("SELECT id FROM client_profiles WHERE user_id = ?").get(u.id)) {
        db.prepare(
          "INSERT INTO client_profiles (user_id, emergency_contact_name, emergency_contact_phone, preferred_payment_method, service_notes, created_at, updated_at) VALUES (?, '', '', 'Transferencia / Efectivo', '', ?, ?)"
        ).run(u.id, ts, ts);
      }
    } else if (newRole === "professional") {
      dbRole = "professional";
      const existingProf = db.prepare("SELECT id FROM professional_profiles WHERE user_id = ?").get(u.id) as
        | { id: number }
        | undefined;
      if (!existingProf) {
        const displayName = `${u.first_name} ${u.last_name}`.trim() || u.username;
        db.prepare(
          `INSERT INTO professional_profiles (
            user_id, display_name, headline, slug, avatar_url, specialty_label, bio,
            latitude, longitude, neighborhood, city, coverage_radius_km, rating_avg,
            jobs_completed, response_time_minutes, is_verified, is_active, accepts_urgent, created_at
          ) VALUES (?, ?, 'Profesional de Servicios Serviprox', ?, '', '', '', 4.6486, -74.0626, ?, ?, 15, '0.00', 0, 60, 0, 1, 0, ?)`
        ).run(u.id, displayName, `${slugify(displayName)}-${u.id}`, u.address || "Bogotá", u.city || "Bogotá", ts);
      } else {
        db.prepare("UPDATE professional_profiles SET is_active = 1 WHERE id = ?").run(existingProf.id);
      }
    } else if (newRole === "superadmin") {
      dbRole = "staff";
      isStaff = 1;
      isSuper = 1;
    } else {
      dbRole = "staff";
      isStaff = 1;
    }

    db.prepare("UPDATE users SET role = ?, is_staff = ?, is_superuser = ? WHERE id = ?").run(dbRole, isStaff, isSuper, u.id);
    const roleLabels: Record<string, string> = {
      client: "Cliente (App)",
      professional: "Profesional (App)",
      staff: "Staff / Moderador",
      support: "Soporte PQR",
      content_manager: "Gestor de Contenido",
      admin: "Administrador General",
      superadmin: "Superadministrador",
    };
    const label = roleLabels[newRole] || newRole.toUpperCase();
    const uName = `${u.first_name} ${u.last_name}`.trim() || u.email;
    addAuditLog(adminName, `Cambio de rol: de ${u.role} a ${label}`, `${uName} (ID: #${u.id})`, reason, req.user!.id);
    addNotification({
      userId: u.id,
      title: "Actualización de rol en Serviprox",
      text: `Tu rol en la plataforma ha sido actualizado a: ${label}. Motivo: ${reason.slice(0, 100)}`,
      type: "rol",
      targetId: String(u.id),
    });

    res.json({
      ok: true,
      message: `Rol de ${uName} actualizado exitosamente a ${label} en la base de datos.`,
      user: {
        id: u.id,
        email: u.email,
        full_name: uName,
        role: dbRole,
        is_staff: Boolean(isStaff),
        is_superuser: Boolean(isSuper),
        admin_role: isSuper ? "superadmin" : isStaff ? "admin" : "none",
        app_role: dbRole,
      },
    });
    return;
  }

  if (actionName === "assign_benefits") {
    const proStr = String(targetId || "").replace("pro-", "");
    const points = Number.parseInt(String(req.body?.points ?? 100), 10) || 0;
    const recharge = Number(req.body?.recharge || 0) || 0;
    let prof = /^\d+$/.test(proStr)
      ? (db.prepare("SELECT * FROM professional_profiles WHERE id = ?").get(Number(proStr)) as
          | Record<string, unknown>
          | undefined)
      : undefined;
    if (!prof && targetId) {
      prof = db
        .prepare("SELECT * FROM professional_profiles WHERE lower(display_name) LIKE lower(?) LIMIT 1")
        .get(`%${String(targetId)}%`) as Record<string, unknown> | undefined;
    }
    if (prof) {
      const nextPoints = Number(prof.points || 0) + points;
      const nextWallet = (Number(prof.wallet_balance || 0) + recharge).toFixed(2);
      db.prepare("UPDATE professional_profiles SET points = ?, wallet_balance = ? WHERE id = ?").run(
        nextPoints,
        nextWallet,
        prof.id as number
      );
      addAuditLog(adminName, "Asignación de beneficios", `${prof.display_name} (+${points} pts / +$${recharge})`, reason, req.user!.id);
      addNotification({
        userId: Number(prof.user_id),
        title: `Incentivo otorgado a ${prof.display_name}`,
        text: `Se asignaron +${points} puntos acumulables y recarga a ${prof.display_name}. Motivo: ${reason.slice(0, 100)}`,
        type: "beneficio",
        targetId: String(prof.id),
      });
      res.json({
        ok: true,
        message: `Beneficios asignados a ${prof.display_name}: +${points} puntos guardados en la BD.`,
        new_points: nextPoints,
      });
      return;
    }
    res.json({ ok: true, message: `Beneficios asignados a ${targetId}.` });
    return;
  }

  if (actionName === "delete_account") {
    const kind = String(req.body?.kind || req.body?.account_kind || "").toLowerCase().trim();
    const rawTarget = req.body?.target_id ?? req.body?.user_id ?? targetId;
    const result = deleteAccountByKindAndId(kind, rawTarget, req.user!);
    res.status(result.status).json(result.body);
    return;
  }

  if (actionName === "respond_pqr") {
    const targetStr = String(targetId || "");
    const cleanId = targetStr.replace(/^(pqr-|fal-|prob-|#)/, "");
    const responseText = String(req.body?.response_text || "");
    const newStatus = String(req.body?.new_status || "resuelto");
    const sendNotification = req.body?.send_notification !== false;

    const pqr = (
      /^\d+$/.test(cleanId)
        ? db.prepare("SELECT * FROM pqr_reports WHERE id = ? OR radicado_number LIKE ? LIMIT 1").get(Number(cleanId), `%${cleanId}%`)
        : db.prepare("SELECT * FROM pqr_reports WHERE lower(radicado_number) = lower(?) LIMIT 1").get(targetStr)
    ) as Record<string, unknown> | undefined;

    if (pqr) {
      const closed = new Set(["resuelto", "resuelta", "cerrado", "cerrada", "sancionado", "sancionada", "rechazado", "cancelado"]);
      if (closed.has(String(pqr.status || "").toLowerCase().trim())) {
        res.status(400).json({
          error: `La PQR ${pqr.radicado_number} ya se encuentra cerrada (${pqr.status}).`,
          status: pqr.status,
          is_closed: true,
        });
        return;
      }
      const statusMap: Record<string, string> = {
        abierta: "radicado",
        radicado: "radicado",
        "en revisión": "en_revision",
        en_revision: "en_revision",
        "en proceso": "conciliacion",
        en_proceso: "conciliacion",
        conciliacion: "conciliacion",
        resuelta: "resuelto",
        resuelto: "resuelto",
        cerrada: "resuelto",
        cerrado: "resuelto",
      };
      const mapped = statusMap[newStatus.toLowerCase().trim()] || newStatus.toLowerCase().trim();
      db.prepare("UPDATE pqr_reports SET status = ?, admin_resolution_notes = ?, updated_at = ? WHERE id = ?").run(
        mapped,
        responseText,
        ts,
        pqr.id as number
      );
      db.prepare(
        "INSERT INTO pqr_messages (pqr_id, sender, sender_name, sender_role, text, timestamp) VALUES (?, 'support_agent', ?, 'Administrador Serviprox', ?, ?)"
      ).run(pqr.id as number, adminName, responseText, ts);
      addAuditLog(adminName, "Respuesta y notificación de PQR a cliente", `PQR ${pqr.radicado_number}`, responseText.slice(0, 120), req.user!.id);
      if (sendNotification) {
        addNotification({
          userId: pqr.client_id ? Number(pqr.client_id) : null,
          title: `Respuesta a caso PQR ${pqr.radicado_number}`,
          text: `El equipo de soporte ha respondido a tu solicitud (${newStatus}): '${responseText.slice(0, 120)}'`,
          type: "pqr",
          targetId: String(pqr.radicado_number),
        });
      }
      res.json({
        ok: true,
        message: `Respuesta registrada en la base de datos para PQR ${pqr.radicado_number}.`,
        status: mapped,
        notification_sent: sendNotification,
      });
      return;
    }

    const fal = (
      /^\d+$/.test(cleanId)
        ? db.prepare("SELECT * FROM app_problem_reports WHERE id = ? OR ticket_number LIKE ? LIMIT 1").get(Number(cleanId), `%${cleanId}%`)
        : db.prepare("SELECT * FROM app_problem_reports WHERE lower(ticket_number) = lower(?) LIMIT 1").get(targetStr)
    ) as Record<string, unknown> | undefined;

    if (fal) {
      if (["resuelto", "resuelta", "cerrado", "cerrada"].includes(String(fal.status || "").toLowerCase().trim())) {
        res.status(400).json({ error: `La incidencia técnica ${fal.ticket_number} ya se encuentra cerrada.`, status: fal.status, is_closed: true });
        return;
      }
      const norm = newStatus.toLowerCase().trim();
      const mapped = ["resuelta", "resuelto", "cerrada", "cerrado"].includes(norm)
        ? "resuelto"
        : ["en proceso", "en_proceso"].includes(norm)
          ? "en_proceso"
          : "recibido";
      db.prepare("UPDATE app_problem_reports SET status = ?, response_notes = ? WHERE id = ?").run(mapped, responseText, fal.id as number);
      addAuditLog(adminName, "Respuesta y solución de falla técnica", `Ticket ${fal.ticket_number}`, responseText.slice(0, 120), req.user!.id);
      res.json({
        ok: true,
        message: `Falla técnica ${fal.ticket_number} actualizada en la base de datos.`,
        status: mapped,
        notification_sent: sendNotification,
      });
      return;
    }
    res.status(404).json({ ok: false, message: "No se encontró el PQR o la incidencia técnica." });
    return;
  }

  if (actionName === "assign_pqr") {
    const targetStr = String(targetId || "");
    const cleanId = targetStr.replace(/^(pqr-|#)/, "");
    const pqr = (
      /^\d+$/.test(cleanId)
        ? db.prepare("SELECT * FROM pqr_reports WHERE id = ?").get(Number(cleanId))
        : db.prepare("SELECT * FROM pqr_reports WHERE lower(radicado_number) = lower(?)").get(targetStr.replace(/^#/, ""))
    ) as Record<string, unknown> | undefined;
    if (!pqr) {
      res.status(404).json({ ok: false, message: "No se encontró el PQR." });
      return;
    }
    const assignedTo = String(req.body?.assigned_to || "").trim();
    if (!assignedTo) {
      res.status(400).json({ ok: false, message: "Indica el responsable del PQR." });
      return;
    }
    db.prepare("UPDATE pqr_reports SET assigned_to = ?, updated_at = ? WHERE id = ?").run(assignedTo, ts, pqr.id as number);
    db.prepare(
      "INSERT INTO pqr_messages (pqr_id, sender, sender_name, sender_role, text, timestamp) VALUES (?, 'support_agent', ?, 'Administrador Serviprox', ?, ?)"
    ).run(pqr.id as number, adminName, `Caso asignado a ${assignedTo}.`, ts);
    addAuditLog(adminName, `Asignación de PQR a ${assignedTo}`, `PQR ${pqr.radicado_number}`, reason, req.user!.id);
    res.json({ ok: true, message: `PQR ${pqr.radicado_number} asignado a ${assignedTo}.` });
    return;
  }

  if (actionName === "update_pqr_priority") {
    const targetStr = String(targetId || "");
    const cleanId = targetStr.replace(/^(pqr-|#)/, "");
    const pqr = (
      /^\d+$/.test(cleanId)
        ? db.prepare("SELECT * FROM pqr_reports WHERE id = ?").get(Number(cleanId))
        : db.prepare("SELECT * FROM pqr_reports WHERE lower(radicado_number) = lower(?)").get(targetStr.replace(/^#/, ""))
    ) as Record<string, unknown> | undefined;
    if (!pqr) {
      res.status(404).json({ ok: false, message: "No se encontró el PQR." });
      return;
    }
    const priority = String(req.body?.priority || "");
    if (!["", "Alta", "Media", "Baja"].includes(priority)) {
      res.status(400).json({ ok: false, message: "La prioridad indicada no es válida." });
      return;
    }
    db.prepare("UPDATE pqr_reports SET priority = ?, updated_at = ? WHERE id = ?").run(priority, ts, pqr.id as number);
    addAuditLog(adminName, `Prioridad de PQR actualizada a ${priority || "sin prioridad"}`, `PQR ${pqr.radicado_number}`, reason, req.user!.id);
    res.json({ ok: true, message: `Prioridad del PQR ${pqr.radicado_number} actualizada.` });
    return;
  }

  if (actionName === "assign_problem") {
    const cleanId = String(targetId || "").replace(/^(fal-|prob-|#)/, "");
    const fal = (
      /^\d+$/.test(cleanId)
        ? db.prepare("SELECT * FROM app_problem_reports WHERE id = ?").get(Number(cleanId))
        : db.prepare("SELECT * FROM app_problem_reports WHERE lower(ticket_number) = lower(?)").get(String(targetId || ""))
    ) as Record<string, unknown> | undefined;
    if (!fal) {
      res.status(404).json({ ok: false, message: "No se encontró la incidencia técnica." });
      return;
    }
    const assignedTo = String(req.body?.assigned_to || "").trim();
    if (!assignedTo) {
      res.status(400).json({ ok: false, message: "Indica el responsable de la incidencia." });
      return;
    }
    const nextStatus = fal.status === "recibido" ? "en_proceso" : String(fal.status);
    db.prepare("UPDATE app_problem_reports SET status = ?, assigned_to = ? WHERE id = ?").run(nextStatus, assignedTo, fal.id as number);
    addAuditLog(adminName, `Asignación de incidencia técnica a ${assignedTo}`, `Ticket ${fal.ticket_number}`, reason, req.user!.id);
    res.json({ ok: true, message: `Incidencia asignada a ${assignedTo} en la base de datos.` });
    return;
  }

  if (actionName === "add_problem_note") {
    const cleanId = String(targetId || "").replace(/^(fal-|prob-|#)/, "");
    const fal = (
      /^\d+$/.test(cleanId)
        ? db.prepare("SELECT * FROM app_problem_reports WHERE id = ?").get(Number(cleanId))
        : db.prepare("SELECT * FROM app_problem_reports WHERE lower(ticket_number) = lower(?)").get(String(targetId || "").replace(/^#/, ""))
    ) as Record<string, unknown> | undefined;
    if (!fal) {
      res.status(404).json({ ok: false, message: "No se encontró la incidencia técnica." });
      return;
    }
    const note = String(req.body?.note || "").trim();
    if (!note) {
      res.status(400).json({ ok: false, message: "El comentario no puede estar vacío." });
      return;
    }
    const nextNotes = [String(fal.response_notes || ""), note].filter(Boolean).join("\n");
    db.prepare("UPDATE app_problem_reports SET response_notes = ? WHERE id = ?").run(nextNotes, fal.id as number);
    addAuditLog(adminName, "Nota añadida a incidencia técnica", `Ticket ${fal.ticket_number}`, note.slice(0, 120), req.user!.id);
    res.json({ ok: true, message: "Comentario guardado en la base de datos." });
    return;
  }

  if (actionName === "update_problem_status") {
    const cleanId = String(targetId || "").replace(/^(fal-|prob-|#)/, "");
    const fal = (
      /^\d+$/.test(cleanId)
        ? db.prepare("SELECT * FROM app_problem_reports WHERE id = ?").get(Number(cleanId))
        : db.prepare("SELECT * FROM app_problem_reports WHERE lower(ticket_number) = lower(?)").get(String(targetId || ""))
    ) as Record<string, unknown> | undefined;
    if (!fal) {
      res.status(404).json({ ok: false, message: "No se encontró la incidencia técnica." });
      return;
    }
    const newStatus = String(req.body?.new_status || "resuelto");
    const dbStatus = ["Resuelta", "resuelto", "Cerrada", "cerrada"].includes(newStatus)
      ? "resuelto"
      : ["En proceso", "en_proceso"].includes(newStatus)
        ? "en_proceso"
        : "recibido";
    db.prepare("UPDATE app_problem_reports SET status = ?, response_notes = ? WHERE id = ?").run(
      dbStatus,
      reason || String(fal.response_notes || ""),
      fal.id as number
    );
    addAuditLog(adminName, `Cambio de estado de incidencia a ${newStatus}`, `Ticket ${fal.ticket_number}`, reason, req.user!.id);
    res.json({ ok: true, message: `Estado de incidencia actualizado a ${newStatus} en la base de datos.` });
    return;
  }

  if (actionName === "create_problem") {
    const files = ((req.files as Express.Multer.File[]) || []);
    for (const f of files) {
      const ext = path.extname(f.originalname).replace(".", "").toLowerCase();
      if (!ALLOWED_ATT_EXT.has(ext)) {
        res.status(400).json({ ok: false, message: `El formato de ${f.originalname} no está permitido.` });
        return;
      }
    }
    const ticketNum =
      String(req.body?.ticket_number || "") ||
      `APP-${new Date().getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const catLabel = String(req.body?.category_label || req.body?.module || "General");
    const desc = String(req.body?.description || "Falla técnica reportada por el administrador");
    const probRes = db
      .prepare(
        `INSERT INTO app_problem_reports (
          ticket_number, user_id, title, user_email, category, category_label,
          description, device_info, version, reported_by, status, priority, created_at
        ) VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        ticketNum,
        req.user!.id,
        String(req.body?.title || ""),
        catLabel.toLowerCase().replace(/\s+/g, "_"),
        catLabel,
        desc,
        String(req.body?.device_info || "Web"),
        String(req.body?.version || ""),
        String(req.body?.reported_by || adminName),
        String(req.body?.status || "recibido"),
        String(req.body?.priority || ""),
        ts
      );
    const probId = Number(probRes.lastInsertRowid);
    const savedAtts = files.map((f) => {
      const rel = saveBufferToMedia("problems", f.originalname, f.buffer);
      const attRes = db
        .prepare(
          "INSERT INTO app_problem_attachments (problem_id, file_path, original_name, content_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .run(probId, rel, f.originalname, f.mimetype || "", f.size, ts);
      const ext = path.extname(f.originalname).replace(".", "").toLowerCase();
      return {
        id: Number(attRes.lastInsertRowid),
        name: f.originalname,
        url: `${req.protocol}://${req.get("host")}/media/${rel}`,
        type: ["gif", "jpeg", "jpg", "png", "webp"].includes(ext) ? "image" : "file",
        content_type: f.mimetype || "",
        size: f.size,
      };
    });
    addAuditLog(adminName, "Registro manual de falla técnica", `Ticket ${ticketNum} (${catLabel})`, desc.slice(0, 120), req.user!.id);
    addNotification({
      title: `Nueva falla reportada (${catLabel})`,
      text: `Ticket ${ticketNum}: ${desc.slice(0, 80)}.`,
      type: "falla",
      targetId: ticketNum,
    });
    res.json({
      ok: true,
      message: `Incidencia ${ticketNum} creada y guardada en la base de datos.`,
      id: probId,
      ticket_number: ticketNum,
      attachments: savedAtts,
    });
    return;
  }

  if (actionName === "upload_problem_files") {
    const cleanId = String(targetId || "").replace(/^(prob-|#)/, "");
    const prob = (
      /^\d+$/.test(cleanId)
        ? db.prepare("SELECT * FROM app_problem_reports WHERE id = ?").get(Number(cleanId))
        : db.prepare("SELECT * FROM app_problem_reports WHERE lower(ticket_number) = lower(?)").get(String(targetId || ""))
    ) as Record<string, unknown> | undefined;
    if (!prob) {
      res.status(404).json({ ok: false, message: "No se encontró la incidencia técnica." });
      return;
    }
    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) {
      res.status(400).json({ ok: false, message: "Selecciona al menos un archivo." });
      return;
    }
    for (const f of files) {
      const rel = saveBufferToMedia("problems", f.originalname, f.buffer);
      db.prepare(
        "INSERT INTO app_problem_attachments (problem_id, file_path, original_name, content_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(prob.id as number, rel, f.originalname, f.mimetype || "", f.size, ts);
    }
    const atts = db.prepare("SELECT * FROM app_problem_attachments WHERE problem_id = ?").all(prob.id as number) as Array<
      Record<string, unknown>
    >;
    addAuditLog(adminName, "Adjunto de evidencia a falla técnica", `Ticket ${prob.ticket_number}`, `Se adjuntaron ${files.length} archivo(s).`, req.user!.id);
    res.json({
      ok: true,
      message: "Archivos adjuntados a la incidencia.",
      attachments: atts.map((a) => ({
        id: Number(a.id),
        name: String(a.original_name),
        url: `${req.protocol}://${req.get("host")}/media/${a.file_path}`,
        type: "file",
        size: Number(a.size_bytes),
      })),
    });
    return;
  }

  res.status(400).json({ error: "Acción no reconocida." });
});

// ── Admin Users, Roles, Notifications & Reports ──────────────────────────────

router.get("/admin/users/", requireStaff, (req: AuthedRequest, res: Response) => {
  const roleFilter = String(req.query.role || "").trim().toLowerCase();
  let users = db.prepare("SELECT * FROM users ORDER BY date_joined DESC, id DESC").all() as DbUser[];
  if (roleFilter) {
    if (["admin", "staff", "administradores"].includes(roleFilter)) {
      users = users.filter((u) => u.is_superuser || u.is_staff || u.role === "staff");
    } else {
      users = users.filter((u) => u.role === roleFilter);
    }
  }

  const usersData = users.map((u) => {
    const pro = db.prepare("SELECT is_verified, headline FROM professional_profiles WHERE user_id = ?").get(u.id) as
      | { is_verified: number; headline: string }
      | undefined;
    const reqCount = (db.prepare("SELECT COUNT(*) AS cnt FROM service_requests WHERE client_id = ?").get(u.id) as { cnt: number }).cnt;
    const fullName = `${u.first_name} ${u.last_name}`.trim() || u.username;
    const cleanName = (fullName || u.email).trim();
    const adminRole = u.is_superuser ? "superadmin" : u.is_staff ? "admin" : u.role === "staff" ? "staff" : "none";
    return {
      id: u.id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      full_name: fullName,
      role: u.role,
      app_role: u.role,
      admin_role: adminRole,
      is_staff: Boolean(u.is_staff),
      is_superuser: Boolean(u.is_superuser),
      phone: u.phone || "",
      city: u.city || "",
      address: u.address || "",
      document_id: u.document_id || "",
      avatar_url: u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=1e3a8a&color=fff`,
      is_active: Boolean(u.is_active),
      is_blocked: Boolean(u.is_blocked),
      block_type: u.block_type,
      block_duration_days: u.block_duration_days,
      block_reason: u.block_reason,
      blocked_until: u.blocked_until,
      blocked_at: u.blocked_at,
      is_currently_blocked: isCurrentlyBlocked(u),
      is_identity_verified: Boolean(u.is_identity_verified),
      is_pro_verified: Boolean(pro?.is_verified),
      headline: pro?.headline || "",
      requests_count: reqCount,
      date_joined: formatDateDmy(u.date_joined),
    };
  });

  res.json({ count: usersData.length, users: usersData });
});

const DEFAULT_PERMISSION_MATRIX: Record<string, string[]> = {
  superadmin: [
    "users_view",
    "users_edit_role",
    "users_verify",
    "users_block",
    "store_manage",
    "services_manage",
    "pqrs_manage",
    "problems_manage",
    "benefits_manage",
    "finance_manage",
    "audit_view",
    "settings_manage",
    "roles_manage",
  ],
  admin: [
    "users_view",
    "users_edit_role",
    "users_verify",
    "users_block",
    "store_manage",
    "services_manage",
    "pqrs_manage",
    "problems_manage",
    "benefits_manage",
    "audit_view",
  ],
  support: ["users_view", "pqrs_manage", "problems_manage"],
  content_manager: ["store_manage", "services_manage"],
  professional: [],
  client: [],
};

router.get("/admin/roles/", (_req: Request, res: Response) => {
  const settings = loadPlatformSettings();
  const matrix = {
    ...DEFAULT_PERMISSION_MATRIX,
    ...((settings.role_permissions || {}) as Record<string, string[]>),
    superadmin: DEFAULT_PERMISSION_MATRIX.superadmin,
  };
  const clientsCount = (db.prepare("SELECT COUNT(*) AS cnt FROM users WHERE role = 'client'").get() as { cnt: number }).cnt;
  const prosCount = (db.prepare("SELECT COUNT(*) AS cnt FROM users WHERE role = 'professional'").get() as { cnt: number }).cnt;
  const superCount = (db.prepare("SELECT COUNT(*) AS cnt FROM users WHERE is_superuser = 1").get() as { cnt: number }).cnt;
  const staffCount = (db.prepare("SELECT COUNT(*) AS cnt FROM users WHERE is_staff = 1 AND is_superuser = 0").get() as { cnt: number }).cnt;
  const totalCount = (db.prepare("SELECT COUNT(*) AS cnt FROM users").get() as { cnt: number }).cnt;

  res.json({
    roles: [
      { id: "superadmin", name: "Superadministrador", category: "admin", badge: "Superadmin", badge_color: "#dc2626", description: "Acceso total e irrestricto a todos los módulos, configuraciones críticas y base de datos.", users_count: superCount, is_system_locked: true },
      { id: "admin", name: "Administrador General", category: "admin", badge: "Admin", badge_color: "#2563eb", description: "Gestión integral de usuarios, verificaciones, publicaciones de tienda, PQRs y beneficios.", users_count: staffCount, is_system_locked: false },
      { id: "support", name: "Soporte y Moderador PQR", category: "admin", badge: "Soporte", badge_color: "#059669", description: "Atención especializada de quejas PQR, conciliación con clientes y solución de fallas técnicas.", users_count: 0, is_system_locked: false },
      { id: "content_manager", name: "Gestor de Tienda y Contenido", category: "admin", badge: "Contenido", badge_color: "#d97706", description: "Supervisión de productos en tienda oficial, validación de inventario y moderación de ofertas.", users_count: 0, is_system_locked: false },
      { id: "professional", name: "Profesional / Contratista (App)", category: "app", badge: "Profesional", badge_color: "#4f46e5", description: "Usuario contratista de la app móvil. Ofrece servicios, publica en tienda y atiende clientes.", users_count: prosCount, is_system_locked: true },
      { id: "client", name: "Cliente Final (App)", category: "app", badge: "Cliente", badge_color: "#0284c7", description: "Usuario consumidor de la app móvil. Contrata servicios, compra en tienda y radica PQRs.", users_count: clientsCount, is_system_locked: true },
    ],
    available_permissions: [
      { id: "users_view", label: "Ver usuarios (Clientes y Contratistas)", category: "Usuarios", description: "Permite consultar perfiles y datos de contacto de clientes y profesionales." },
      { id: "users_edit_role", label: "Modificar roles de usuarios y administradores", category: "Usuarios", description: "Permite ascender, degradar o cambiar roles de app y administración en la BD." },
      { id: "users_verify", label: "Validar identidad y acreditaciones RETIE", category: "Usuarios", description: "Aprobar o revocar documentos oficiales y tarjetas profesionales." },
      { id: "users_block", label: "Sanciones y bloqueo disciplinario", category: "Usuarios", description: "Suspender temporal o definitivamente cuentas por infracciones." },
      { id: "store_manage", label: "Gestionar tienda y publicar productos", category: "Tienda y Publicaciones", description: "Publicar productos oficiales, moderar y eliminar artículos." },
      { id: "services_manage", label: "Supervisar solicitudes y contratos de servicios", category: "Servicios", description: "Monitorear estados de cotizaciones y contrataciones en curso." },
      { id: "pqrs_manage", label: "Atención y resolución de PQRs oficiales", category: "PQR y Soporte", description: "Responder quejas, conciliar desacuerdos y notificar resoluciones." },
      { id: "problems_manage", label: "Gestión de incidencias y fallas de la app", category: "PQR y Soporte", description: "Asignar responsables y dar solución a fallas reportadas." },
      { id: "benefits_manage", label: "Asignación de puntos y beneficios", category: "Beneficios", description: "Otorgar puntos de fidelización y saldo a profesionales destacados." },
      { id: "finance_manage", label: "Consulta de balances y billeteras", category: "Finanzas", description: "Acceso a balances financieros, recargas y comisiones de plataforma." },
      { id: "audit_view", label: "Visualización de bitácora de auditoría", category: "Seguridad", description: "Consultar registro inmutable de acciones realizadas por administradores." },
      { id: "settings_manage", label: "Configuración general y switches de plataforma", category: "Configuración", description: "Activar/desactivar módulos de cliente y profesional, modo mantenimiento." },
      { id: "roles_manage", label: "Configuración de roles y matriz de permisos", category: "Seguridad", description: "Modificar privilegios de acceso para roles del sistema." },
    ],
    permission_matrix: matrix,
    counts: {
      total: totalCount,
      clients: clientsCount,
      professionals: prosCount,
      administrators: superCount + staffCount,
    },
  });
});

router.post("/admin/roles/", (req: Request, res: Response) => {
  const newMatrix = req.body?.permission_matrix;
  if (!newMatrix || typeof newMatrix !== "object" || Array.isArray(newMatrix)) {
    res.status(400).json({ error: "La matriz de permisos enviada no es válida." });
    return;
  }
  const normalized = { ...newMatrix, superadmin: DEFAULT_PERMISSION_MATRIX.superadmin };
  const current = loadPlatformSettings();
  current.role_permissions = normalized;
  savePlatformSettings(current);
  addAuditLog(
    String(req.body?.admin_name || "Superadministrador"),
    "Actualización de matriz de roles y permisos",
    "Matriz de Privilegios del Sistema",
    String(req.body?.reason || "Actualización de matriz de permisos de roles")
  );
  res.json({ ok: true, message: "Matriz de roles y permisos guardada con éxito en la base de datos.", permission_matrix: normalized });
});

function handleNotificationsGet(req: AuthedRequest, res: Response) {
  const mine = req.user && !isStaffUser(req.user) ? req.user.id : null;
  const rows = (
    mine
      ? db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").all(mine)
      : db.prepare("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50").all()
  ) as Array<Record<string, unknown>>;
  const unreadCount = (
    mine
      ? (db.prepare("SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0").get(mine) as { cnt: number })
      : (db.prepare("SELECT COUNT(*) AS cnt FROM notifications WHERE is_read = 0").get() as { cnt: number })
  ).cnt;
  const totalCount = (db.prepare("SELECT COUNT(*) AS cnt FROM notifications").get() as { cnt: number }).cnt;

  const now = Date.now();
  res.json({
    unread_count: unreadCount,
    total_count: totalCount,
    notifications: rows.map((n) => {
      const diffSec = Math.max(0, Math.floor((now - Date.parse(String(n.created_at))) / 1000));
      const days = Math.floor(diffSec / 86400);
      const time =
        days > 0
          ? `Hace ${days} d`
          : diffSec >= 3600
            ? `Hace ${Math.floor(diffSec / 3600)} h`
            : diffSec >= 60
              ? `Hace ${Math.floor(diffSec / 60)} min`
              : "Hace un momento";
      return {
        id: Number(n.id),
        title: String(n.title),
        text: String(n.text),
        type: String(n.notification_type || "sistema"),
        link: String(n.link || ""),
        target_id: String(n.target_id || ""),
        unread: !n.is_read,
        time,
        created_at: String(n.created_at),
      };
    }),
  });
}

function handleNotificationsPost(req: Request, res: Response) {
  const action = String(req.body?.action || "mark_all_read");
  const nid = Number(req.body?.id || 0);
  if (action === "mark_read") {
    if (nid) db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(nid);
    res.json({ ok: true, message: "Notificación marcada como leída." });
    return;
  }
  if (action === "mark_unread") {
    if (nid) db.prepare("UPDATE notifications SET is_read = 0 WHERE id = ?").run(nid);
    res.json({ ok: true, message: "Notificación marcada como no leída." });
    return;
  }
  if (action === "mark_all_read") {
    db.prepare("UPDATE notifications SET is_read = 1 WHERE is_read = 0").run();
    res.json({ ok: true, message: "Todas las notificaciones marcadas como leídas." });
    return;
  }
  if (action === "clear_all") {
    db.prepare("DELETE FROM notifications").run();
    res.json({ ok: true, message: "Historial de notificaciones eliminado." });
    return;
  }
  if (action === "create") {
    const id = addNotification({
      title: String(req.body?.title || "Aviso del sistema"),
      text: String(req.body?.text || ""),
      type: String(req.body?.type || "sistema"),
      link: String(req.body?.link || ""),
      targetId: String(req.body?.target_id || ""),
    });
    res.json({ ok: true, id, message: "Notificación creada con éxito." });
    return;
  }
  res.status(400).json({ error: "Acción no reconocida." });
}

router.get("/admin/notifications/", handleNotificationsGet);
router.post("/admin/notifications/", handleNotificationsPost);
router.get("/notifications/", requireAuth, handleNotificationsGet);
router.post("/notifications/", requireAuth, handleNotificationsPost);

// ── Admin Reports Stats & City Stats ─────────────────────────────────────────

const CITY_DEFS: Record<string, { name: string; center: [number, number]; zoom: number; aliases: string[] }> = {
  bogota: { name: "Bogotá", center: [4.711, -74.0721], zoom: 11, aliases: ["bogota", "bogota d c", "bogota dc"] },
  medellin: { name: "Medellín", center: [6.2442, -75.5812], zoom: 12, aliases: ["medellin"] },
  cali: { name: "Cali", center: [3.4516, -76.532], zoom: 12, aliases: ["cali", "santiago de cali"] },
  cartagena: { name: "Cartagena", center: [10.391, -75.4794], zoom: 12, aliases: ["cartagena", "cartagena de indias"] },
  cundinamarca: {
    name: "Cundinamarca",
    center: [4.86, -74.04],
    zoom: 9,
    aliases: [
      "cundinamarca",
      "soacha",
      "chia",
      "zipaquira",
      "facatativa",
      "funza",
      "mosquera",
      "cajica",
      "fusagasuga",
      "girardot",
      "la calera",
      "sopo",
      "tocancipa",
      "cota",
      "madrid",
      "sibate",
      "tabio",
      "tenjo",
    ],
  },
};

function detectCityId(value: string): string | null {
  const norm = (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!norm) return null;
  for (const [id, cfg] of Object.entries(CITY_DEFS)) {
    if (cfg.aliases.some((alias) => new RegExp(`\\b${alias}\\b`).test(norm))) return id;
  }
  return null;
}

function buildCityStats() {
  const cities: Record<
    string,
    {
      id: string;
      name: string;
      center: [number, number];
      zoom: number;
      households: number;
      professionals: number;
      located: number;
      zonesMap: Map<string, number>;
      points: Array<{ lat: number; lng: number; kind: string }>;
    }
  > = {};
  for (const [id, cfg] of Object.entries(CITY_DEFS)) {
    cities[id] = {
      id,
      name: cfg.name,
      center: cfg.center,
      zoom: cfg.zoom,
      households: 0,
      professionals: 0,
      located: 0,
      zonesMap: new Map(),
      points: [],
    };
  }
  const other = { households: 0, professionals: 0 };

  const hhRows = db.prepare("SELECT city, neighborhood, latitude, longitude FROM households ORDER BY id DESC LIMIT 20000").all() as Array<
    Record<string, unknown>
  >;
  const ppRows = db
    .prepare("SELECT city, neighborhood, latitude, longitude FROM professional_profiles ORDER BY id DESC LIMIT 20000")
    .all() as Array<Record<string, unknown>>;

  const ingest = (rows: Array<Record<string, unknown>>, counter: "households" | "professionals", kind: "home" | "pro") => {
    for (const r of rows) {
      const cid = detectCityId(String(r.city || ""));
      if (!cid) {
        other[counter] += 1;
        continue;
      }
      const c = cities[cid];
      c[counter] += 1;
      const zone = String(r.neighborhood || "")
        .trim()
        .replace(/\b\w/g, (ch) => ch.toUpperCase());
      if (zone) c.zonesMap.set(zone, (c.zonesMap.get(zone) || 0) + 1);
      if (r.latitude !== null && r.latitude !== undefined && r.longitude !== null && r.longitude !== undefined) {
        c.located += 1;
        if (c.points.length < 1500) {
          c.points.push({
            lat: Math.round(Number(r.latitude) * 1000) / 1000,
            lng: Math.round(Number(r.longitude) * 1000) / 1000,
            kind,
          });
        }
      }
    }
  };

  ingest(hhRows, "households", "home");
  ingest(ppRows, "professionals", "pro");

  return {
    cities: Object.values(cities).map((c) => ({
      id: c.id,
      name: c.name,
      center: c.center,
      zoom: c.zoom,
      households: c.households,
      professionals: c.professionals,
      located: c.located,
      zones: Array.from(c.zonesMap.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 80)
        .map(([name, count]) => ({ name, count })),
      points: c.points,
    })),
    cities_other: other,
  };
}

router.get("/admin/reports-stats/", requireStaff, (_req: AuthedRequest, res: Response) => {
  const now = new Date();
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const buckets: Array<{ key: string; label: string; d: Date }> = [];
  for (let offset = 9; offset >= 0; offset -= 1) {
    const idx = now.getFullYear() * 12 + now.getMonth() - offset;
    const year = Math.floor(idx / 12);
    const month = ((idx % 12) + 12) % 12;
    buckets.push({
      key: `${year}-${String(month + 1).padStart(2, "0")}`,
      label: monthNames[month],
      d: new Date(year, month, 1),
    });
  }

  const usersAll = db.prepare("SELECT role, date_joined FROM users").all() as Array<{ role: string; date_joined: string }>;
  const ordersAll = db.prepare("SELECT created_at FROM orders").all() as Array<{ created_at: string }>;
  const approvedPayments = db
    .prepare("SELECT amount_in_cents, created_at FROM payments WHERE status = 'approved'")
    .all() as Array<{ amount_in_cents: number; created_at: string }>;

  const newUsersData = buckets.map((b) => {
    const inM = usersAll.filter((u) => (u.date_joined || "").slice(0, 7) === b.key);
    return {
      month: b.label,
      clients: inM.filter((u) => u.role === "client").length,
      pros: inM.filter((u) => u.role === "professional").length,
    };
  });
  const userTotals = buckets.map((b) => usersAll.filter((u) => (u.date_joined || "").slice(0, 7) === b.key).length);
  const proTotals = newUsersData.map((m) => m.pros);

  const hiresData = buckets.map((b) => ({
    month: b.label,
    val: ordersAll.filter((o) => (o.created_at || "").slice(0, 7) === b.key).length,
  }));
  const hireTotals = hiresData.map((h) => h.val);

  const revenueTotals = buckets.map((b) => {
    const cents = approvedPayments
      .filter((p) => (p.created_at || "").slice(0, 7) === b.key)
      .reduce((acc, p) => acc + Number(p.amount_in_cents || 0), 0);
    return Math.floor(cents / 100);
  });
  const monthlyRevenue = buckets.map((b, i) => ({
    month: b.label,
    amount: `$${revenueTotals[i].toLocaleString("es-CO")}`,
    val: revenueTotals[i] / 1_000_000,
  }));

  const pct = (cur: number, prev: number) => (!prev ? (cur ? "+100%" : "0%") : `${Math.round(((cur - prev) * 100) / prev) >= 0 ? "+" : ""}${Math.round(((cur - prev) * 100) / prev)}%`);
  const fmt = (v: number) => v.toLocaleString("es-CO");

  const totalUsers = usersAll.length;
  const activePros = (
    db
      .prepare(
        "SELECT COUNT(*) AS cnt FROM professional_profiles pp JOIN users u ON u.id = pp.user_id WHERE pp.is_active = 1 AND u.is_active = 1"
      )
      .get() as { cnt: number }
  ).cnt;
  const totalProducts = (db.prepare("SELECT COUNT(*) AS cnt FROM store_products WHERE is_active = 1").get() as { cnt: number }).cnt;
  const totalHires = ordersAll.length;
  const pqrCount = (db.prepare("SELECT COUNT(*) AS cnt FROM pqr_reports").get() as { cnt: number }).cnt;
  const probCount = (db.prepare("SELECT COUNT(*) AS cnt FROM app_problem_reports").get() as { cnt: number }).cnt;
  const totalPqrs = pqrCount + probCount;
  const totalRevenue = Math.floor(approvedPayments.reduce((acc, p) => acc + Number(p.amount_in_cents || 0), 0) / 100);

  const srCounts = db
    .prepare(
      `SELECT COALESCE(s.name, c.name) AS label, COUNT(*) AS cnt
       FROM service_requests sr
       LEFT JOIN services s ON s.id = sr.selected_service_id
       LEFT JOIN service_categories c ON c.id = sr.selected_category_id
       GROUP BY label ORDER BY cnt DESC, label ASC LIMIT 8`
    )
    .all() as Array<{ label: string | null; cnt: number }>;
  const maxSr = srCounts.reduce((m, r) => Math.max(m, r.cnt), 0);
  const topServices = srCounts
    .filter((r) => r.label)
    .map((r) => ({ name: String(r.label), count: r.cnt, pct: maxSr ? Math.round((r.cnt * 100) / maxSr) : 0 }));

  const prodRows = db
    .prepare("SELECT category, COUNT(*) AS cnt FROM store_products WHERE is_active = 1 GROUP BY category ORDER BY cnt DESC, category ASC LIMIT 8")
    .all() as Array<{ category: string; cnt: number }>;
  const maxProd = prodRows.reduce((m, r) => Math.max(m, r.cnt), 0);
  const topProducts = prodRows.map((r) => ({
    name: r.category,
    count: r.cnt,
    pct: maxProd ? Math.round((r.cnt * 100) / maxProd) : 0,
  }));

  const resolvedPqrs =
    (db.prepare("SELECT COUNT(*) AS cnt FROM pqr_reports WHERE status = 'resuelto'").get() as { cnt: number }).cnt +
    (db.prepare("SELECT COUNT(*) AS cnt FROM app_problem_reports WHERE status = 'resuelto'").get() as { cnt: number }).cnt;
  const inProcPqrs =
    (db.prepare("SELECT COUNT(*) AS cnt FROM pqr_reports WHERE status IN ('en_revision', 'conciliacion')").get() as { cnt: number }).cnt +
    (db.prepare("SELECT COUNT(*) AS cnt FROM app_problem_reports WHERE status = 'en_proceso'").get() as { cnt: number }).cnt;
  const pendingPqrs =
    (db.prepare("SELECT COUNT(*) AS cnt FROM pqr_reports WHERE status = 'radicado'").get() as { cnt: number }).cnt +
    (db.prepare("SELECT COUNT(*) AS cnt FROM app_problem_reports WHERE status IN ('pendiente', 'abierto', 'recibido')").get() as { cnt: number }).cnt;
  const rejectedPqrs =
    (db.prepare("SELECT COUNT(*) AS cnt FROM pqr_reports WHERE status IN ('rechazado', 'sancionado')").get() as { cnt: number }).cnt +
    (db.prepare("SELECT COUNT(*) AS cnt FROM app_problem_reports WHERE status = 'rechazado'").get() as { cnt: number }).cnt;

  const pqrStatus = {
    total: totalPqrs,
    raw_total: totalPqrs,
    resueltas: resolvedPqrs,
    resueltas_pct: totalPqrs ? Math.round((resolvedPqrs * 100) / totalPqrs) : 0,
    en_proceso: inProcPqrs,
    en_proceso_pct: totalPqrs ? Math.round((inProcPqrs * 100) / totalPqrs) : 0,
    pendientes: pendingPqrs,
    pendientes_pct: totalPqrs ? Math.round((pendingPqrs * 100) / totalPqrs) : 0,
    rechazadas: rejectedPqrs,
    rechazadas_pct: totalPqrs ? Math.round((rejectedPqrs * 100) / totalPqrs) : 0,
  };

  const recentActivity = [
    ...(db.prepare("SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 6").all() as Array<Record<string, unknown>>).map(
      (l) => ({
        id: `audit-${l.id}`,
        date: formatDateTimeDmy(String(l.created_at)),
        module: "Auditoría / Sistema",
        description: `${l.action} - ${l.target}`.slice(0, 55),
        user: String(l.admin_name || "Administrador"),
        status: "completado",
      })
    ),
  ];

  const localityDefs: Array<[string, string, string[], string]> = [
    ["kennedy", "Kennedy", ["kennedy", "castilla", "timiza", "tintal", "patio bonito", "carvajal"], "#1d4ed8"],
    ["suba", "Suba", ["suba", "pontevedra", "rincón", "rincon", "niza", "colina", "prado"], "#3b82f6"],
    ["engativa", "Engativá", ["engativa", "engativá", "álamos", "alamos", "minuto", "ferias", "boyacá"], "#60a5fa"],
    ["chapinero", "Chapinero", ["chapinero", "chicó", "chico", "antiguo country", "lago", "marly"], "#93c5fd"],
    ["usaquen", "Usaquén", ["usaquén", "usaquen", "cedritos", "santa bárbara", "santa barbara", "chicó norte", "chico norte", "san patricio"], "#bfdbfe"],
    ["bosa", "Bosa", ["bosa", "brasilia", "el porvenir", "la libertad"], "#c7d2fe"],
    ["teusaquillo", "Teusaquillo", ["teusaquillo", "galerías", "galerias", "salitre", "la soledad", "palermo", "quinta paredes"], "#ddd6fe"],
    ["santafe", "Santa Fe", ["santa fe", "santa fé", "las aguas", "la macarena", "las nieves", "germania"], "#ede9fe"],
  ];
  const locCounts: Record<string, number> = { otras: 0 };
  for (const [k] of localityDefs) locCounts[k] = 0;
  const allNeighborhoods = [
    ...(db.prepare("SELECT neighborhood FROM households").all() as Array<{ neighborhood: string }>),
    ...(db.prepare("SELECT neighborhood FROM professional_profiles").all() as Array<{ neighborhood: string }>),
  ];
  for (const row of allNeighborhoods) {
    const val = (row.neighborhood || "").toLowerCase().trim();
    const hit = localityDefs.find(([, , aliases]) => aliases.some((a) => val.includes(a)));
    locCounts[hit ? hit[0] : "otras"] += 1;
  }
  const localities = [
    ...localityDefs.map(([id, name, , color]) => ({ id, name, count: locCounts[id], color })),
    { id: "otras", name: "Otras", count: locCounts.otras, color: "#f1f5f9" },
  ];

  res.json({
    database_connected: true,
    database_engine: "sqlite",
    period: `${formatDateDmy(buckets[0].d.toISOString())} - ${formatDateDmy(now.toISOString())}`,
    kpis: {
      users: { raw: totalUsers, display: fmt(totalUsers), trend: pct(userTotals.at(-1) || 0, userTotals.at(-2) || 0), sparkline: userTotals.slice(-4) },
      pros: { raw: activePros, display: fmt(activePros), trend: pct(proTotals.at(-1) || 0, proTotals.at(-2) || 0), sparkline: proTotals.slice(-4) },
      products: { raw: totalProducts, display: fmt(totalProducts), trend: "0%", sparkline: [totalProducts, totalProducts, totalProducts, totalProducts] },
      hires: { raw: totalHires, display: fmt(totalHires), trend: pct(hireTotals.at(-1) || 0, hireTotals.at(-2) || 0), sparkline: hireTotals.slice(-4) },
      pqrs: { raw: totalPqrs, display: fmt(totalPqrs), trend: "0%", sparkline: [totalPqrs, totalPqrs, totalPqrs, totalPqrs] },
      revenue: {
        raw: totalRevenue,
        display: `$${fmt(totalRevenue)}`,
        trend: pct(revenueTotals.at(-1) || 0, revenueTotals.at(-2) || 0),
        sparkline: revenueTotals.slice(-4).map((v) => v / 1_000_000),
      },
    },
    hires_data: hiresData,
    top_services: topServices,
    top_products: topProducts,
    new_users_data: newUsersData,
    monthly_revenue: monthlyRevenue,
    pqr_status: pqrStatus,
    recent_activity: recentActivity,
    localities,
    ...buildCityStats(),
  });
});

export default router;
