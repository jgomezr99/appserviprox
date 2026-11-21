import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { db, loadPlatformSettings, nowIso } from "./db.ts";

export interface DbUser {
  id: number;
  email: string;
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  role: string;
  phone: string;
  city: string;
  document_id: string;
  address: string;
  avatar_url: string;
  is_identity_verified: number;
  onboarding_completed: number;
  is_active: number;
  is_staff: number;
  is_superuser: number;
  is_blocked: number;
  block_type: string;
  block_duration_days: number;
  block_reason: string;
  blocked_until: string | null;
  blocked_at: string | null;
  last_login: string | null;
  date_joined: string;
  created_at: string;
}

export interface AuthedRequest extends Request {
  user?: DbUser | null;
}

const JWT_SECRET = process.env.JWT_SECRET || process.env.DJANGO_SECRET_KEY || "serviprox-local-sqlite-secret-2026";
const ACCESS_TTL_SEC = 60 * 60 * 12; // 12h
const REFRESH_TTL_SEC = 60 * 60 * 24 * 14; // 14d

const failedLogins = new Map<string, { count: number; lockedUntil: number }>();

function b64urlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function b64urlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

export function hashPassword(password: string): string {
  const iterations = 120_000;
  const salt = crypto.randomBytes(12).toString("base64url");
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64");
  return `pbkdf2_sha256$${iterations}$${salt}$${hash}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  if (!encoded || !password) return false;
  const parts = encoded.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") {
    return false;
  }
  const iterations = Number.parseInt(parts[1], 10);
  const salt = parts[2];
  const expected = parts[3];
  if (!Number.isFinite(iterations) || iterations <= 0 || !salt || !expected) return false;
  try {
    const derived = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64");
    const bufA = Buffer.from(derived, "utf8");
    const bufB = Buffer.from(expected, "utf8");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function verifyPasswordAsync(password: string, encoded: string): Promise<boolean> {
  if (!encoded || !password) return false;
  const parts = encoded.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") {
    return false;
  }
  const iterations = Number.parseInt(parts[1], 10);
  const salt = parts[2];
  const expected = parts[3];
  if (!Number.isFinite(iterations) || iterations <= 0 || !salt || !expected) return false;
  try {
    const derived = await new Promise<string>((resolve, reject) => {
      crypto.pbkdf2(password, salt, iterations, 32, "sha256", (err, key) => {
        if (err) reject(err);
        else resolve(key.toString("base64"));
      });
    });
    const bufA = Buffer.from(derived, "utf8");
    const bufB = Buffer.from(expected, "utf8");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function signJwt(payload: Record<string, unknown>, ttlSec: number): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64urlEncode(JSON.stringify({ ...payload, iat: now, exp: now + ttlSec }));
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function signAccessToken(user: DbUser): string {
  return signJwt({ user_id: user.id, email: user.email, role: user.role, token_type: "access" }, ACCESS_TTL_SEC);
}

export function signRefreshToken(user: DbUser): string {
  return signJwt({ user_id: user.id, email: user.email, token_type: "refresh" }, REFRESH_TTL_SEC);
}

export function verifyJwt(token: string): { user_id: number; token_type: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    const decoded = JSON.parse(b64urlDecode(body)) as { user_id?: number; exp?: number; token_type?: string };
    if (!decoded.user_id || !decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return { user_id: decoded.user_id, token_type: decoded.token_type || "access" };
  } catch {
    return null;
  }
}

export function getInitials(firstName: string, lastName: string, username: string, email: string): string {
  const full = `${firstName || ""} ${lastName || ""}`.trim();
  if (full) {
    const tokens = full.split(/\s+/);
    if (tokens.length >= 2) return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
    return full.slice(0, 2).toUpperCase();
  }
  return (username || email || "US").slice(0, 2).toUpperCase();
}

export function isCurrentlyBlocked(user: DbUser): boolean {
  if (!user.is_blocked) return false;
  if (user.block_type === "temporal" && user.blocked_until) {
    const until = Date.parse(user.blocked_until);
    if (!Number.isNaN(until) && Date.now() >= until) {
      db.prepare("UPDATE users SET is_blocked = 0, is_active = 1 WHERE id = ?").run(user.id);
      return false;
    }
  }
  return true;
}

export function isStaffUser(user?: DbUser | null): boolean {
  return Boolean(user && user.is_active && (user.is_staff || user.is_superuser || user.role === "staff"));
}

export function findUserById(userId: number): DbUser | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as DbUser | undefined;
}

export function serializeUser(user: DbUser) {
  const cp = db.prepare("SELECT * FROM client_profiles WHERE user_id = ?").get(user.id) as
    | {
        emergency_contact_name: string;
        emergency_contact_phone: string;
        preferred_payment_method: string;
        service_notes: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;
  const prof = db.prepare("SELECT id, certificate_file FROM professional_profiles WHERE user_id = ?").get(user.id) as
    | { id: number; certificate_file: string }
    | undefined;
  const blocked = isCurrentlyBlocked(user);
  const adminRole = user.is_superuser
    ? "superadmin"
    : user.is_staff
      ? "admin"
      : user.role === "staff"
        ? "admin"
        : null;

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role,
    phone: user.phone,
    city: user.city,
    document_id: user.document_id,
    address: user.address,
    avatar_url: user.avatar_url,
    initials: getInitials(user.first_name, user.last_name, user.username, user.email),
    is_identity_verified: Boolean(user.is_identity_verified),
    onboarding_completed: Boolean(user.onboarding_completed),
    is_active: Boolean(user.is_active),
    is_blocked: Boolean(user.is_blocked),
    block_type: user.block_type,
    block_duration_days: user.block_duration_days,
    block_reason: user.block_reason,
    blocked_until: user.blocked_until,
    blocked_at: user.blocked_at,
    is_currently_blocked: blocked,
    is_staff: Boolean(user.is_staff),
    is_superuser: Boolean(user.is_superuser),
    admin_role: adminRole,
    client_profile: cp
      ? {
          emergency_contact_name: cp.emergency_contact_name,
          emergency_contact_phone: cp.emergency_contact_phone,
          preferred_payment_method: cp.preferred_payment_method,
          service_notes: cp.service_notes,
          created_at: cp.created_at,
          updated_at: cp.updated_at,
        }
      : null,
    has_professional_certificate: Boolean(prof && prof.certificate_file),
    created_at: user.created_at,
  };
}

export function attachUser(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const payload = verifyJwt(token);
    if (payload && payload.token_type === "access") {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(payload.user_id) as DbUser | undefined;
      if (user && user.is_active) {
        req.user = user;
        next();
        return;
      }
    }
  }
  req.user = null;
  next();
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ detail: "Se requieren credenciales de autenticación válidas." });
    return;
  }
  next();
}

export function requireStaff(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ detail: "Se requieren credenciales de autenticación válidas." });
    return;
  }
  if (!isStaffUser(req.user)) {
    res.status(403).json({ detail: "Esta acción requiere permisos de administrador." });
    return;
  }
  next();
}

export function lockoutPolicy(): { maxAttempts: number; minutes: number } {
  const sec = loadPlatformSettings().sections?.security || {};
  const maxAttempts = Math.max(1, Number(sec.max_attempts ?? 5) || 5);
  const minutes = Math.max(1, Number(sec.lockout_minutes ?? 2) || 2);
  return { maxAttempts, minutes };
}

export function isLoginLocked(identity: string): number | null {
  const key = identity.trim().toLowerCase();
  const entry = failedLogins.get(key);
  if (!entry) return null;
  if (entry.lockedUntil > Date.now()) {
    return lockoutPolicy().minutes;
  }
  if (entry.lockedUntil > 0 && entry.lockedUntil <= Date.now()) {
    failedLogins.delete(key);
  }
  return null;
}

export function registerFailedLogin(identity: string): void {
  const key = identity.trim().toLowerCase();
  if (!key) return;
  const { maxAttempts, minutes } = lockoutPolicy();
  const current = failedLogins.get(key) || { count: 0, lockedUntil: 0 };
  const nextCount = current.count + 1;
  failedLogins.set(key, {
    count: nextCount,
    lockedUntil: nextCount >= maxAttempts ? Date.now() + minutes * 60_000 : 0,
  });
}

export function clearFailedLogin(identity: string): void {
  failedLogins.delete(identity.trim().toLowerCase());
}

export function requireFeatureEnabled(featureKey: string, message: string): string | null {
  const settings = loadPlatformSettings();
  const features = (settings.features || {}) as Record<string, boolean>;
  if (features[featureKey] === false) {
    return message;
  }
  return null;
}

export function checkMaintenanceForLogin(user: DbUser): string | null {
  if (isStaffUser(user)) return null;
  const settings = loadPlatformSettings();
  if (settings.features?.maintenance) {
    return settings.maintenance_message || "Serviprox se encuentra en mantenimiento.";
  }
  return null;
}

export function touchLastLogin(userId: number): void {
  db.prepare("UPDATE users SET last_login = ? WHERE id = ?").run(nowIso(), userId);
}
