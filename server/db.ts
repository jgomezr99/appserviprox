import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DATA_DIR = path.resolve(process.cwd(), "data");
export const MEDIA_DIR = path.join(DATA_DIR, "media");
export const BACKUP_DIR = path.join(DATA_DIR, "backups");
export const DB_PATH = process.env.SERVIPROX_SQLITE_PATH
  ? path.resolve(process.cwd(), process.env.SERVIPROX_SQLITE_PATH)
  : path.join(DATA_DIR, "serviprox.sqlite");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.mkdirSync(MEDIA_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

export const DEFAULT_PLATFORM_SETTINGS = {
  platform_name: "Serviprox",
  description: "Plataforma de conexión entre clientes y profesionales para servicios del hogar.",
  logo: "",
  country: "Colombia",
  timezone: "America/Bogota",
  language: "Español",
  date_format: "DD/MM/YYYY",
  time_format: "24 horas",
  currency: "Peso colombiano (COP)",
  cities: ["Bogotá", "Medellín", "Cali", "Cartagena", "Cundinamarca"],
  email: {
    host: "",
    port: "587",
    cipher: "TLS",
    sender: "soporte@serviprox.com",
    sender_name: "Serviprox",
    requires_auth: true,
  },
  social: {
    facebook: "",
    instagram: "",
    x: "",
    youtube: "",
    linkedin: "",
  },
  documents: {
    terms: "",
    privacy: "",
    refunds: "",
    rules: "",
    contract: "",
  },
  features: {
    new_users: true,
    professionals: true,
    services: true,
    products: true,
    chat: true,
    hirings: true,
    pqr: true,
    benefits: true,
    email_notifications: true,
    push_notifications: true,
    maintenance: false,
  },
  maintenance_message: "Serviprox se encuentra en mantenimiento. Intenta de nuevo en unos minutos.",
  last_backup: "",
  sections: {
    appearance: {
      theme: "light",
      primary: "#0055cc",
      secondary: "#1e3a8a",
      font: "Plus Jakarta Sans",
      buttons: "Redondeado",
      cards: "Suave",
      density: "Estándar",
    },
    payments: {
      platform_commission: 10,
      discount_enabled: false,
      discount_type: "percent",
      discount_value: 0,
      pse_enabled: true,
      card_enabled: true,
      transfer_enabled: true,
      wallet_enabled: true,
      test_payment_enabled: false,
    },
    security: {
      min_length: 6,
      max_attempts: 5,
      lockout_minutes: 2,
    },
    app_params: {
      reg_clients: true,
      reg_pros: true,
      default_radius_km: 15,
    },
    role_params: {
      client: {},
      professional: {},
    },
    benefit_catalog: {
      items: [
        {
          id: "ben-recarga-20k",
          title: "Recarga de saldo $20.000",
          points: 200,
          recharge_amount: 20000,
          description: "Saldo acreditable para comisiones o destacados.",
        },
        {
          id: "ben-destacado",
          title: "Perfil destacado 7 días",
          points: 350,
          recharge_amount: 0,
          description: "Mayor visibilidad en búsquedas de tu zona.",
        },
      ],
    },
  },
  role_permissions: {} as Record<string, string[]>,
};

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password TEXT NOT NULL,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'client',
      phone TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT 'Bogota',
      document_id TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      is_identity_verified INTEGER NOT NULL DEFAULT 0,
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_staff INTEGER NOT NULL DEFAULT 0,
      is_superuser INTEGER NOT NULL DEFAULT 0,
      is_blocked INTEGER NOT NULL DEFAULT 0,
      block_type TEXT NOT NULL DEFAULT '',
      block_duration_days INTEGER NOT NULL DEFAULT 0,
      block_reason TEXT NOT NULL DEFAULT '',
      blocked_until TEXT,
      blocked_at TEXT,
      last_login TEXT,
      date_joined TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS client_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      emergency_contact_name TEXT NOT NULL DEFAULT '',
      emergency_contact_phone TEXT NOT NULL DEFAULT '',
      preferred_payment_method TEXT NOT NULL DEFAULT 'Transferencia / Efectivo',
      service_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      admin_name TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      text TEXT NOT NULL,
      notification_type TEXT NOT NULL DEFAULT 'sistema',
      link TEXT NOT NULL DEFAULT '',
      target_id TEXT NOT NULL DEFAULT '',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS platform_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS households (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label TEXT NOT NULL DEFAULT 'Mi hogar',
      property_type TEXT NOT NULL DEFAULT 'apartment',
      address_line TEXT NOT NULL,
      neighborhood TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT 'Bogota',
      country TEXT NOT NULL DEFAULT 'Colombia',
      latitude REAL,
      longitude REAL,
      area_m2 INTEGER,
      build_year INTEGER,
      notes TEXT NOT NULL DEFAULT '',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS service_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      icon_key TEXT NOT NULL DEFAULT 'construct',
      keywords TEXT NOT NULL DEFAULT '[]',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      keywords TEXT NOT NULL DEFAULT '[]',
      price_min TEXT,
      price_max TEXT,
      estimated_hours TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      UNIQUE(category_id, slug)
    );

    CREATE TABLE IF NOT EXISTS store_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Otros',
      price INTEGER NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 1,
      condition TEXT NOT NULL DEFAULT 'Nuevo',
      description TEXT NOT NULL DEFAULT '',
      seller_name TEXT NOT NULL DEFAULT '',
      seller_email TEXT NOT NULL DEFAULT '',
      seller_username TEXT NOT NULL DEFAULT '',
      seller_role TEXT NOT NULL DEFAULT 'Cliente',
      seller_blocked INTEGER NOT NULL DEFAULT 0,
      phone TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT 'Bogotá',
      image TEXT NOT NULL DEFAULT '',
      images TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      review_status TEXT NOT NULL DEFAULT 'aprobado',
      review_notes TEXT NOT NULL DEFAULT '',
      reviewed_by TEXT NOT NULL DEFAULT '',
      reviewed_at TEXT,
      reports_count INTEGER NOT NULL DEFAULT 0,
      last_report_reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS diagnostic_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      text TEXT NOT NULL,
      help_text TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_required INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS diagnostic_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL REFERENCES diagnostic_questions(id) ON DELETE CASCADE,
      value TEXT NOT NULL,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      weights TEXT NOT NULL DEFAULT '{}',
      UNIQUE(question_id, value)
    );

    CREATE TABLE IF NOT EXISTS diagnostic_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'suggested',
      suggested_category_id INTEGER REFERENCES service_categories(id) ON DELETE SET NULL,
      suggested_service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
      confidence REAL NOT NULL DEFAULT 0,
      rationale TEXT NOT NULL DEFAULT '',
      ranking TEXT NOT NULL DEFAULT '[]',
      service_ranking TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS diagnostic_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES diagnostic_sessions(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES diagnostic_questions(id) ON DELETE CASCADE,
      option_id INTEGER NOT NULL REFERENCES diagnostic_options(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS professional_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      headline TEXT NOT NULL DEFAULT '',
      slug TEXT NOT NULL UNIQUE,
      avatar_url TEXT NOT NULL DEFAULT '',
      specialty_label TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      latitude REAL,
      longitude REAL,
      neighborhood TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT 'Bogota',
      coverage_radius_km INTEGER NOT NULL DEFAULT 10,
      rating_avg TEXT NOT NULL DEFAULT '0.00',
      jobs_completed INTEGER NOT NULL DEFAULT 0,
      response_time_minutes INTEGER NOT NULL DEFAULT 60,
      is_verified INTEGER NOT NULL DEFAULT 0,
      certificate_profession TEXT NOT NULL DEFAULT '',
      certificate_file TEXT NOT NULL DEFAULT '',
      certificate_uploaded_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      accepts_urgent INTEGER NOT NULL DEFAULT 0,
      points INTEGER NOT NULL DEFAULT 0,
      wallet_balance TEXT NOT NULL DEFAULT '0.00',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS professional_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
      service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      price_min TEXT,
      price_max TEXT,
      observations TEXT NOT NULL DEFAULT '',
      years_experience INTEGER NOT NULL DEFAULT 0,
      UNIQUE(profile_id, service_id)
    );

    CREATE TABLE IF NOT EXISTS availability_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
      weekday INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS portfolio_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL DEFAULT '',
      caption TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS benefit_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
      benefit_id TEXT NOT NULL,
      title TEXT NOT NULL,
      points INTEGER NOT NULL,
      recharge_amount TEXT NOT NULL DEFAULT '0.00',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS service_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
      diagnostic_session_id INTEGER REFERENCES diagnostic_sessions(id) ON DELETE SET NULL,
      suggested_category_id INTEGER REFERENCES service_categories(id) ON DELETE SET NULL,
      selected_category_id INTEGER NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
      selected_service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
      professional_id INTEGER REFERENCES professional_profiles(id) ON DELETE SET NULL,
      description TEXT NOT NULL,
      urgency TEXT NOT NULL DEFAULT 'this_week',
      search_radius_km INTEGER NOT NULL DEFAULT 10,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS request_candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
      professional_id INTEGER NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
      distance_km REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      UNIQUE(request_id, professional_id)
    );

    CREATE TABLE IF NOT EXISTS service_request_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
      image_path TEXT NOT NULL,
      uploaded_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_request_id INTEGER NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
      professional_id INTEGER NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'requested',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      payment_confirmed_at TEXT,
      payment_reference TEXT NOT NULL DEFAULT '',
      commission_rate TEXT,
      commission_amount TEXT,
      professional_amount TEXT,
      payout_status TEXT NOT NULL DEFAULT 'pending',
      payout_settled_at TEXT,
      scheduled_for TEXT,
      estimate_min TEXT,
      estimate_max TEXT,
      final_price TEXT,
      client_notes TEXT NOT NULL DEFAULT '',
      arrival_code TEXT NOT NULL DEFAULT '0000',
      professional_latitude REAL,
      professional_longitude REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reference TEXT NOT NULL UNIQUE,
      amount_in_cents INTEGER NOT NULL,
      discount_amount TEXT NOT NULL DEFAULT '0.00',
      currency TEXT NOT NULL DEFAULT 'COP',
      status TEXT NOT NULL DEFAULT 'pending',
      wompi_transaction_id TEXT NOT NULL DEFAULT '',
      payment_method TEXT NOT NULL DEFAULT '',
      test_mode INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      professional_id INTEGER NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
      amount TEXT NOT NULL,
      destination TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      transfer_reference TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      resolved_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS refunds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
      amount TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'requested',
      note TEXT NOT NULL DEFAULT '',
      requested_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      resolved_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS work_evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      image_path TEXT NOT NULL,
      caption TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_admin_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      author_name TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pqr_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      radicado_number TEXT NOT NULL UNIQUE,
      client_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      client_name TEXT NOT NULL DEFAULT '',
      client_phone TEXT NOT NULL DEFAULT '',
      client_email TEXT NOT NULL DEFAULT '',
      client_document_id TEXT NOT NULL DEFAULT '',
      client_address TEXT NOT NULL DEFAULT '',
      contractor_id INTEGER REFERENCES professional_profiles(id) ON DELETE SET NULL,
      contractor_id_ref TEXT NOT NULL DEFAULT '',
      contractor_name TEXT NOT NULL DEFAULT '',
      contractor_company TEXT NOT NULL DEFAULT '',
      contractor_specialty TEXT NOT NULL DEFAULT '',
      contractor_avatar TEXT NOT NULL DEFAULT '',
      pqr_type TEXT NOT NULL DEFAULT 'queja',
      subject_type TEXT NOT NULL DEFAULT 'servicio',
      product_id INTEGER REFERENCES store_products(id) ON DELETE SET NULL,
      product_name TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'radicado',
      priority TEXT NOT NULL DEFAULT '',
      assigned_to TEXT NOT NULL DEFAULT '',
      related_to TEXT NOT NULL DEFAULT '',
      incident_date TEXT NOT NULL,
      amount_disputed TEXT,
      description TEXT NOT NULL DEFAULT '',
      desired_resolution TEXT NOT NULL DEFAULT '',
      evidence_files TEXT NOT NULL DEFAULT '[]',
      admin_resolution_notes TEXT NOT NULL DEFAULT '',
      estimated_response_days INTEGER NOT NULL DEFAULT 3,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pqr_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pqr_id INTEGER NOT NULL REFERENCES pqr_reports(id) ON DELETE CASCADE,
      sender TEXT NOT NULL DEFAULT 'system',
      sender_name TEXT NOT NULL,
      sender_role TEXT NOT NULL DEFAULT '',
      text TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_problem_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number TEXT NOT NULL UNIQUE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      title TEXT NOT NULL DEFAULT '',
      user_email TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'error_mapa',
      category_label TEXT NOT NULL DEFAULT 'Falla Técnica',
      description TEXT NOT NULL DEFAULT '',
      device_info TEXT NOT NULL DEFAULT 'Web / App',
      version TEXT NOT NULL DEFAULT '',
      reported_by TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'recibido',
      priority TEXT NOT NULL DEFAULT '',
      assigned_to TEXT NOT NULL DEFAULT '',
      response_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_problem_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      problem_id INTEGER NOT NULL REFERENCES app_problem_reports(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      original_name TEXT NOT NULL,
      content_type TEXT NOT NULL DEFAULT '',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS support_chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      user_name TEXT NOT NULL DEFAULT '',
      user_email TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT 'Chat de soporte',
      topic TEXT NOT NULL DEFAULT 'soporte',
      related_pqr_id INTEGER REFERENCES pqr_reports(id) ON DELETE SET NULL,
      related_radicado TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'abierto',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS support_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL REFERENCES support_chats(id) ON DELETE CASCADE,
      sender TEXT NOT NULL DEFAULT 'user',
      sender_name TEXT NOT NULL DEFAULT '',
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const pqrCols = (
    db.prepare("PRAGMA table_info(pqr_reports)").all() as Array<{ name: string }>
  ).map((c) => c.name);
  if (!pqrCols.includes("subject_type")) {
    db.exec("ALTER TABLE pqr_reports ADD COLUMN subject_type TEXT NOT NULL DEFAULT 'servicio'");
  }
  if (!pqrCols.includes("product_id")) {
    db.exec("ALTER TABLE pqr_reports ADD COLUMN product_id INTEGER");
  }
  if (!pqrCols.includes("product_name")) {
    db.exec("ALTER TABLE pqr_reports ADD COLUMN product_name TEXT NOT NULL DEFAULT ''");
  }
  db.exec(`
    UPDATE pqr_reports
    SET subject_type = 'producto'
    WHERE (subject_type IS NULL OR subject_type = '' OR subject_type = 'servicio')
      AND (product_id IS NOT NULL OR LOWER(related_to) LIKE 'producto #%' OR LOWER(radicado_number) LIKE 'pqr-prod-%')
  `);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined || raw === "") return fallback;
  if (typeof raw !== "string") return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function slugify(text: string, maxLen = 80): string {
  return (text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen) || "item";
}

export function haversineKm(
  lat1: number | null | undefined,
  lng1: number | null | undefined,
  lat2: number | null | undefined,
  lng2: number | null | undefined
): number | null {
  if (
    lat1 === null || lat1 === undefined ||
    lng1 === null || lng1 === undefined ||
    lat2 === null || lat2 === undefined ||
    lng2 === null || lng2 === undefined ||
    Number.isNaN(Number(lat1)) || Number.isNaN(Number(lng1)) ||
    Number.isNaN(Number(lat2)) || Number.isNaN(Number(lng2))
  ) {
    return null;
  }
  const R = 6371.0;
  const p1 = (Number(lat1) * Math.PI) / 180;
  const p2 = (Number(lat2) * Math.PI) / 180;
  const dp = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
  const dl = ((Number(lng2) - Number(lng1)) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10;
}

export function mergePlatformSettings(rawData: Record<string, unknown>) {
  const sec = (rawData.sections && typeof rawData.sections === "object" ? rawData.sections : {}) as Record<string, unknown>;
  return {
    ...DEFAULT_PLATFORM_SETTINGS,
    ...rawData,
    email: { ...DEFAULT_PLATFORM_SETTINGS.email, ...((rawData.email as Record<string, unknown>) || {}) },
    social: { ...DEFAULT_PLATFORM_SETTINGS.social, ...((rawData.social as Record<string, unknown>) || {}) },
    documents: { ...DEFAULT_PLATFORM_SETTINGS.documents, ...((rawData.documents as Record<string, unknown>) || {}) },
    features: { ...DEFAULT_PLATFORM_SETTINGS.features, ...((rawData.features as Record<string, unknown>) || {}) },
    sections: {
      ...DEFAULT_PLATFORM_SETTINGS.sections,
      ...sec,
      appearance: {
        ...DEFAULT_PLATFORM_SETTINGS.sections.appearance,
        ...((sec.appearance as Record<string, unknown>) || {}),
      },
      payments: {
        ...DEFAULT_PLATFORM_SETTINGS.sections.payments,
        ...((sec.payments as Record<string, unknown>) || {}),
      },
      security: {
        ...DEFAULT_PLATFORM_SETTINGS.sections.security,
        ...((sec.security as Record<string, unknown>) || {}),
      },
      app_params: {
        ...DEFAULT_PLATFORM_SETTINGS.sections.app_params,
        ...((sec.app_params as Record<string, unknown>) || {}),
      },
      role_params: {
        ...DEFAULT_PLATFORM_SETTINGS.sections.role_params,
        ...((sec.role_params as Record<string, unknown>) || {}),
      },
      benefit_catalog: {
        ...DEFAULT_PLATFORM_SETTINGS.sections.benefit_catalog,
        ...((sec.benefit_catalog as Record<string, unknown>) || {}),
      },
    },
  };
}

export function loadPlatformSettings() {
  const row = db.prepare("SELECT id, data, updated_at FROM platform_settings ORDER BY id ASC LIMIT 1").get() as
    | { id: number; data: string; updated_at: string }
    | undefined;
  const parsed = row ? safeJsonParse<Record<string, unknown>>(row.data, {}) : {};
  return mergePlatformSettings(parsed);
}

export function savePlatformSettings(nextData: Record<string, unknown>) {
  const merged = mergePlatformSettings(nextData);
  const ts = nowIso();
  const existing = db.prepare("SELECT id FROM platform_settings ORDER BY id ASC LIMIT 1").get() as
    | { id: number }
    | undefined;
  if (existing) {
    db.prepare("UPDATE platform_settings SET data = ?, updated_at = ? WHERE id = ?").run(
      JSON.stringify(merged),
      ts,
      existing.id
    );
  } else {
    db.prepare("INSERT INTO platform_settings (data, updated_at) VALUES (?, ?)").run(
      JSON.stringify(merged),
      ts
    );
  }
  return merged;
}

export function addAuditLog(adminName: string, action: string, target: string, reason = "", adminUserId: number | null = null): void {
  db.prepare(
    "INSERT INTO admin_audit_logs (admin_user_id, admin_name, action, target, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(adminUserId, adminName.slice(0, 150), action.slice(0, 150), target.slice(0, 255), reason, nowIso());
}

export function addNotification(params: {
  userId?: number | null;
  title: string;
  text: string;
  type?: string;
  link?: string;
  targetId?: string;
}): number {
  const res = db
    .prepare(
      "INSERT INTO notifications (user_id, title, text, notification_type, link, target_id, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)"
    )
    .run(
      params.userId ?? null,
      params.title,
      params.text,
      params.type || "sistema",
      params.link || "",
      params.targetId || "",
      nowIso()
    );
  return Number(res.lastInsertRowid);
}

export function paginate<T>(
  items: T[],
  pageParam: unknown,
  pageSizeParam: unknown,
  baseUrl: string,
  defaultSize = 20
): { count: number; next: string | null; previous: string | null; results: T[] } {
  const count = items.length;
  const page = Math.max(1, Number.parseInt(String(pageParam || "1"), 10) || 1);
  const pageSize = Math.min(200, Math.max(1, Number.parseInt(String(pageSizeParam || String(defaultSize)), 10) || defaultSize));
  const start = (page - 1) * pageSize;
  const results = items.slice(start, start + pageSize);
  const hasNext = start + pageSize < count;
  const hasPrev = page > 1;
  const cleanBase = baseUrl.split("?")[0];
  return {
    count,
    next: hasNext ? `${cleanBase}?page=${page + 1}` : null,
    previous: hasPrev ? `${cleanBase}?page=${page - 1}` : null,
    results,
  };
}

export function absoluteUrl(req: { protocol: string; get(name: string): string | undefined }, relPath: string): string {
  if (!relPath) return "";
  if (/^https?:\/\//i.test(relPath) || relPath.startsWith("data:")) return relPath;
  const host = req.get("host");
  const normalized = relPath.startsWith("/") ? relPath : `/${relPath}`;
  return host ? `${req.protocol}://${host}${normalized}` : normalized;
}
