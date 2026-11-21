import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import {
  findUserById,
  isStaffUser,
  requireAuth,
  requireStaff,
  type AuthedRequest,
  type DbUser,
} from "../auth.ts";
import {
  addAuditLog,
  addNotification,
  db,
  haversineKm,
  loadPlatformSettings,
  MEDIA_DIR,
  nowIso,
  paginate,
} from "../db.ts";
import {
  ALLOWED_TRANSITIONS,
  autoSettleCompletedPaidOrders,
  backfillSplits,
  computeDiscount,
  isSettleable,
  methodLabel,
  moneyNum,
  monthlySeries,
  ORDER_STATUS_LABELS,
  orderPrice,
  PAYMENT_ROW_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYOUT_STATUS_LABELS,
  personName,
  platformSummary,
  priceBoundsForOrder,
  professionalBalance,
  REFUND_STATUS_LABELS,
  registerSplit,
  serializeOrder,
  serializeServiceRequest,
  URGENCY_LABELS,
  WITHDRAWAL_STATUS_LABELS,
} from "../serializers.ts";

const router = Router();

const CLIENT_HOLD_MESSAGE =
  "Tienes un servicio terminado sin pagar. Tu cuenta está suspendida hasta que lo pagues.";
const PROFESSIONAL_HOLD_MESSAGE =
  "Tu cuenta está suspendida: un cliente aún no paga un servicio que terminaste. " +
  "Se reactiva automáticamente cuando el pago sea confirmado.";
const PAY_AFTER_COMPLETION = "El pago se habilita cuando el profesional termina el trabajo.";

const DECLINED_TEST_CARD = "4000000000000002";
const DECLINED_TEST_REFERENCE = "RECHAZADO";
const MIN_WITHDRAWAL = 10000;

const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 6 },
});

function saveMediaFile(subdir: string, origName: string, buffer: Buffer): string {
  const dir = path.join(MEDIA_DIR, subdir);
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(origName || "").toLowerCase() || ".jpg";
  const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `${subdir}/${filename}`;
}

function guessMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  return map[ext] || "application/octet-stream";
}

function clientHasHold(userId: number): boolean {
  return Boolean(
    db
      .prepare("SELECT 1 FROM orders WHERE client_id = ? AND status = 'completed' AND payment_status = 'pending' LIMIT 1")
      .get(userId)
  );
}

function professionalHasHold(profileId: number): boolean {
  return Boolean(
    db
      .prepare(
        "SELECT 1 FROM orders WHERE professional_id = ? AND status = 'completed' AND payment_status = 'pending' LIMIT 1"
      )
      .get(profileId)
  );
}

function professionalOffersService(profileId: number, serviceId: number | null | undefined): boolean {
  if (!serviceId) return false;
  return Boolean(
    db
      .prepare(
        `SELECT 1 FROM professional_services ps
         JOIN services s ON s.id = ps.service_id
         JOIN service_categories c ON c.id = s.category_id
         WHERE ps.profile_id = ? AND ps.service_id = ? AND s.is_active = 1 AND c.is_active = 1`
      )
      .get(profileId, serviceId)
  );
}

function isOrderClient(order: Record<string, unknown>, user?: DbUser | null): boolean {
  if (!user || user.role !== "client") return false;
  const prof = db
    .prepare("SELECT user_id FROM professional_profiles WHERE id = ?")
    .get(order.professional_id as number) as { user_id: number } | undefined;
  return Number(order.client_id) === user.id && prof?.user_id !== user.id;
}

function isAssignedProfessional(order: Record<string, unknown>, user?: DbUser | null): boolean {
  if (!user || user.role !== "professional") return false;
  const prof = db
    .prepare("SELECT user_id FROM professional_profiles WHERE id = ?")
    .get(order.professional_id as number) as { user_id: number } | undefined;
  return prof?.user_id === user.id && Number(order.client_id) !== user.id;
}

function generateArrivalCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function buildCandidatesForRequest(requestId: number, limit = 20): void {
  const sr = db.prepare("SELECT * FROM service_requests WHERE id = ?").get(requestId) as
    | Record<string, unknown>
    | undefined;
  if (!sr) return;
  const household = db.prepare("SELECT * FROM households WHERE id = ?").get(sr.household_id as number) as
    | Record<string, unknown>
    | undefined;
  db.prepare(
    `DELETE FROM request_candidates WHERE request_id = ? AND professional_id IN (
      SELECT id FROM professional_profiles WHERE user_id = ?
    )`
  ).run(requestId, sr.client_id as number);

  let profiles: Array<Record<string, unknown>>;
  if (sr.selected_service_id) {
    profiles = db
      .prepare(
        `SELECT DISTINCT pp.*
         FROM professional_profiles pp
         JOIN professional_services ps ON ps.profile_id = pp.id
         WHERE pp.is_active = 1 AND ps.service_id = ? AND pp.user_id != ?`
      )
      .all(sr.selected_service_id as number, sr.client_id as number) as Array<Record<string, unknown>>;
  } else {
    profiles = db
      .prepare(
        `SELECT DISTINCT pp.*
         FROM professional_profiles pp
         JOIN professional_services ps ON ps.profile_id = pp.id
         JOIN services s ON s.id = ps.service_id
         WHERE pp.is_active = 1 AND s.category_id = ? AND pp.user_id != ?`
      )
      .all(sr.selected_category_id as number, sr.client_id as number) as Array<Record<string, unknown>>;
  }

  const hasCoords = household?.latitude !== null && household?.latitude !== undefined && household?.longitude !== null && household?.longitude !== undefined;
  const radiusKm = Number(sr.search_radius_km || 10);

  const ranked = profiles
    .map((p) => {
      const dist = hasCoords
        ? haversineKm(
            Number(household!.latitude),
            Number(household!.longitude),
            p.latitude !== null ? Number(p.latitude) : null,
            p.longitude !== null ? Number(p.longitude) : null
          )
        : 0;
      return { p, dist };
    })
    .filter((entry) => {
      if (!hasCoords) return true;
      return entry.dist !== null && entry.dist <= radiusKm;
    })
    .sort((a, b) => {
      if (hasCoords) return (a.dist ?? 99999) - (b.dist ?? 99999);
      const rDiff = Number(b.p.rating_avg || 0) - Number(a.p.rating_avg || 0);
      if (rDiff !== 0) return rDiff;
      return Number(b.p.jobs_completed || 0) - Number(a.p.jobs_completed || 0);
    })
    .slice(0, limit);

  const ts = nowIso();
  for (const entry of ranked) {
    db.prepare(
      `INSERT OR IGNORE INTO request_candidates (request_id, professional_id, distance_km, status, created_at)
       VALUES (?, ?, ?, 'pending', ?)`
    ).run(requestId, entry.p.id as number, Math.round((entry.dist ?? 0) * 100) / 100, ts);
  }
}

function getScopedRequest(req: AuthedRequest, requestId: number): Record<string, unknown> | null {
  const sr = db.prepare("SELECT * FROM service_requests WHERE id = ?").get(requestId) as
    | Record<string, unknown>
    | undefined;
  if (!sr) return null;
  if (isStaffUser(req.user)) return sr;
  if (req.user!.role === "client" && Number(sr.client_id) === req.user!.id) return sr;
  if (req.user!.role === "professional") {
    const prof = db
      .prepare("SELECT id FROM professional_profiles WHERE user_id = ?")
      .get(req.user!.id) as { id: number } | undefined;
    if (prof && Number(sr.professional_id) === prof.id) return sr;
  }
  return null;
}

function getScopedOrder(req: AuthedRequest, orderId: number): Record<string, unknown> | null {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as Record<string, unknown> | undefined;
  if (!order) return null;
  if (isStaffUser(req.user)) return order;
  if (isAssignedProfessional(order, req.user)) return order;
  if (isOrderClient(order, req.user)) return order;
  return null;
}

function transitionOrder(
  orderId: number,
  newStatus: string,
  user: DbUser,
  opts: { note?: string; scheduled_for?: string; arrival_code?: string } = {}
): { ok: true; order: Record<string, unknown> } | { ok: false; status: number; payload: Record<string, unknown> } {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as Record<string, unknown> | undefined;
  if (!order) return { ok: false, status: 404, payload: { detail: "Orden no encontrada." } };
  const sr = db.prepare("SELECT * FROM service_requests WHERE id = ?").get(order.service_request_id as number) as
    | Record<string, unknown>
    | undefined;

  const isPro = isAssignedProfessional(order, user);
  const isStaff = isStaffUser(user);
  const clientCanCancel =
    isOrderClient(order, user) &&
    newStatus === "cancelled" &&
    ["requested", "accepted", "scheduled"].includes(String(order.status));

  if (!isPro && !isStaff && !clientCanCancel) {
    return { ok: false, status: 403, payload: { detail: "Solo el profesional asignado puede avanzar el trabajo." } };
  }
  if (newStatus === "accepted") {
    return { ok: false, status: 400, payload: { status: "Acepta la solicitud desde Mis solicitudes." } };
  }
  if (sr && sr.status !== "accepted" && newStatus !== "cancelled") {
    return {
      ok: false,
      status: 400,
      payload: { status: "El profesional debe aceptar la solicitud antes de iniciar el servicio." },
    };
  }
  const current = String(order.status);
  const allowed = ALLOWED_TRANSITIONS[current] || new Set<string>();
  if (!allowed.has(newStatus)) {
    const label = ORDER_STATUS_LABELS[current] || current;
    return { ok: false, status: 400, payload: { status: `No se puede pasar de «${label}» a «${newStatus}».` } };
  }

  let scheduledFor = order.scheduled_for ? String(order.scheduled_for) : null;
  if (newStatus === "scheduled") {
    if (!opts.scheduled_for) {
      return { ok: false, status: 400, payload: { status: "Selecciona una fecha futura para agendar la visita." } };
    }
    const dt = new Date(opts.scheduled_for);
    if (Number.isNaN(dt.getTime()) || dt.getTime() <= Date.now()) {
      return { ok: false, status: 400, payload: { status: "Selecciona una fecha futura para agendar la visita." } };
    }
    scheduledFor = dt.toISOString();
  }

  if (newStatus === "arrived") {
    const expected = String(order.arrival_code || "");
    const provided = String(opts.arrival_code || "").trim();
    if (!expected || provided !== expected) {
      return {
        ok: false,
        status: 400,
        payload: { status: "El código de llegada es incorrecto. Solicítalo al cliente." },
      };
    }
  }

  const ts = nowIso();
  db.prepare("UPDATE orders SET status = ?, scheduled_for = ?, updated_at = ? WHERE id = ?").run(
    newStatus,
    scheduledFor,
    ts,
    orderId
  );
  db.prepare("INSERT INTO order_events (order_id, status, note, created_by_id, created_at) VALUES (?, ?, ?, ?, ?)").run(
    orderId,
    newStatus,
    String(opts.note || "").slice(0, 200),
    user.id,
    ts
  );

  if (newStatus === "completed" || newStatus === "cancelled") {
    db.prepare("UPDATE service_requests SET status = ?, updated_at = ? WHERE id = ?").run(
      newStatus === "completed" ? "closed" : "cancelled",
      ts,
      order.service_request_id as number
    );
  }
  if (newStatus === "completed") {
    const cnt = db
      .prepare("SELECT COUNT(*) AS cnt FROM orders WHERE professional_id = ? AND status = 'completed'")
      .get(order.professional_id as number) as { cnt: number };
    db.prepare("UPDATE professional_profiles SET jobs_completed = ? WHERE id = ?").run(
      cnt.cnt,
      order.professional_id as number
    );
    autoSettleCompletedPaidOrders(orderId);
  }

  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as Record<string, unknown>;
  return { ok: true, order: updated };
}

function luhnValid(numStr: string): boolean {
  let total = 0;
  const rev = numStr.split("").reverse();
  for (let i = 0; i < rev.length; i += 1) {
    let val = Number(rev[i]);
    if (i % 2 === 1) {
      val *= 2;
      if (val > 9) val -= 9;
    }
    total += val;
  }
  return total % 10 === 0;
}

function serviceLabelForOrder(orderId: number, sr?: Record<string, unknown>): string {
  const reqRow =
    sr ||
    (db
      .prepare(
        "SELECT sr.selected_service_id, sr.selected_category_id FROM orders o JOIN service_requests sr ON sr.id = o.service_request_id WHERE o.id = ?"
      )
      .get(orderId) as { selected_service_id: number | null; selected_category_id: number } | undefined);
  if (!reqRow) return "Servicio";
  if (reqRow.selected_service_id) {
    const s = db.prepare("SELECT name FROM services WHERE id = ?").get(reqRow.selected_service_id as number) as
      | { name: string }
      | undefined;
    if (s) return s.name;
  }
  const c = db.prepare("SELECT name FROM service_categories WHERE id = ?").get(reqRow.selected_category_id as number) as
    | { name: string }
    | undefined;
  return c?.name || "Servicio";
}

function buildPaymentRow(p: Record<string, unknown>) {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(p.order_id as number) as Record<string, unknown>;
  const client = findUserById(Number(p.client_id));
  const prof = db
    .prepare("SELECT display_name FROM professional_profiles WHERE id = ?")
    .get(order.professional_id as number) as { display_name: string } | undefined;
  const statusStr = String(p.status);
  const refStr = String(p.reference || "");
  return {
    id: Number(p.id),
    order_id: Number(p.order_id),
    date: String(p.created_at),
    reference: refStr,
    method: methodLabel(String(p.payment_method || "")),
    user: personName(client),
    professional: prof?.display_name || "—",
    service: serviceLabelForOrder(Number(p.order_id)),
    amount: Number(p.amount_in_cents || 0) / 100,
    discount: moneyNum(p.discount_amount),
    status: statusStr,
    status_label: PAYMENT_ROW_STATUS_LABELS[statusStr] || statusStr,
    can_verify: (statusStr === "pending" || statusStr === "error") && !refStr.startsWith("DEV-"),
  };
}

function buildClientReceiptRow(p: Record<string, unknown>) {
  const base = buildPaymentRow(p);
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(p.order_id as number) as Record<string, unknown>;
  const client = findUserById(Number(p.client_id || order.client_id));
  const sr = db.prepare("SELECT * FROM service_requests WHERE id = ?").get(order.service_request_id as number) as Record<
    string,
    unknown
  >;
  const household = db.prepare("SELECT * FROM households WHERE id = ?").get(sr.household_id as number) as
    | Record<string, unknown>
    | undefined;
  const cat = db.prepare("SELECT name FROM service_categories WHERE id = ?").get(sr.selected_category_id as number) as
    | { name: string }
    | undefined;
  const gross = moneyNum(Number(p.amount_in_cents || 0) / 100 + moneyNum(p.discount_amount));
  const addrParts = [household?.address_line, household?.neighborhood, household?.city].filter(Boolean);

  return {
    ...base,
    receipt_available: true,
    client_email: client?.email || "",
    client_phone: client?.phone || "",
    client_document: client?.document_id || "",
    client_name: personName(client),
    scheduled_for: order.scheduled_for ? String(order.scheduled_for) : null,
    order_status_label: ORDER_STATUS_LABELS[String(order.status)] || String(order.status),
    service_category: cat?.name || "",
    service_description: String(sr.description || ""),
    service_address: addrParts.join(", "),
    paid_at: order.payment_confirmed_at ? String(order.payment_confirmed_at) : null,
    transaction_id: String(p.wompi_transaction_id || ""),
    discount: moneyNum(p.discount_amount),
    subtotal: gross,
  };
}

function buildWithdrawalRow(w: Record<string, unknown>) {
  const prof = db
    .prepare("SELECT display_name FROM professional_profiles WHERE id = ?")
    .get(w.professional_id as number) as { display_name: string } | undefined;
  const st = String(w.status || "pending");
  return {
    id: Number(w.id),
    professional: prof?.display_name || "—",
    amount: moneyNum(w.amount),
    destination: String(w.destination || ""),
    status: st,
    status_label: WITHDRAWAL_STATUS_LABELS[st] || st,
    transfer_reference: String(w.transfer_reference || ""),
    note: String(w.note || ""),
    created_at: String(w.created_at),
    resolved_at: w.resolved_at ? String(w.resolved_at) : null,
  };
}

function buildPayoutRow(o: Record<string, unknown>) {
  const prof = db
    .prepare("SELECT display_name FROM professional_profiles WHERE id = ?")
    .get(o.professional_id as number) as { display_name: string } | undefined;
  const client = findUserById(Number(o.client_id));
  const proAmt = moneyNum(o.professional_amount);
  const comAmt = moneyNum(o.commission_amount);
  const st = String(o.status);
  const ps = String(o.payout_status);
  return {
    order_id: Number(o.id),
    professional: prof?.display_name || "—",
    client: personName(client),
    service: serviceLabelForOrder(Number(o.id)),
    date: o.payment_confirmed_at ? String(o.payment_confirmed_at) : null,
    gross: moneyNum(proAmt + comAmt),
    commission: comAmt,
    commission_rate: moneyNum(o.commission_rate),
    net: proAmt,
    order_status: st,
    order_status_label: ORDER_STATUS_LABELS[st] || st,
    payout_status: ps,
    payout_status_label: PAYOUT_STATUS_LABELS[ps] || ps,
    payout_settled_at: o.payout_settled_at ? String(o.payout_settled_at) : null,
    eligible: isSettleable(o),
  };
}

function buildRefundRow(r: Record<string, unknown>) {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(r.order_id as number) as Record<string, unknown>;
  const client = findUserById(Number(order.client_id));
  const prof = db
    .prepare("SELECT display_name FROM professional_profiles WHERE id = ?")
    .get(order.professional_id as number) as { display_name: string } | undefined;
  const st = String(r.status);
  return {
    id: Number(r.id),
    order_id: Number(r.order_id),
    client: personName(client),
    professional: prof?.display_name || "—",
    amount: moneyNum(r.amount),
    reason: String(r.reason || ""),
    status: st,
    status_label: REFUND_STATUS_LABELS[st] || st,
    note: String(r.note || ""),
    created_at: String(r.created_at),
    resolved_at: r.resolved_at ? String(r.resolved_at) : null,
  };
}

// ── Service Requests ─────────────────────────────────────────────────────────

router.get("/requests/", requireAuth, (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  let rows: Array<Record<string, unknown>> = [];
  if (isStaffUser(user)) {
    rows = db.prepare("SELECT * FROM service_requests ORDER BY created_at DESC, id DESC").all() as Array<
      Record<string, unknown>
    >;
  } else if (user.role === "professional") {
    const prof = db.prepare("SELECT id FROM professional_profiles WHERE user_id = ?").get(user.id) as
      | { id: number }
      | undefined;
    if (prof) {
      rows = db
        .prepare("SELECT * FROM service_requests WHERE professional_id = ? ORDER BY created_at DESC, id DESC")
        .all(prof.id) as Array<Record<string, unknown>>;
    }
  } else {
    rows = db
      .prepare("SELECT * FROM service_requests WHERE client_id = ? ORDER BY created_at DESC, id DESC")
      .all(user.id) as Array<Record<string, unknown>>;
  }

  const statusFilter = req.query.status ? String(req.query.status) : "";
  const catSlug = req.query["selected_category__slug"] ? String(req.query["selected_category__slug"]) : "";
  if (statusFilter) rows = rows.filter((r) => String(r.status) === statusFilter);
  if (catSlug) {
    const cat = db.prepare("SELECT id FROM service_categories WHERE slug = ?").get(catSlug) as
      | { id: number }
      | undefined;
    rows = cat ? rows.filter((r) => Number(r.selected_category_id) === cat.id) : [];
  }

  res.json(
    paginate(
      rows.map((r) => serializeServiceRequest(r, req.user, req)),
      req.query.page,
      req.query.page_size,
      req.originalUrl,
      50
    )
  );
});

router.post("/requests/", requireAuth, uploadImages.array("images", 6), (req: AuthedRequest, res: Response) => {
  const settings = loadPlatformSettings();
  if (settings.features?.hirings === false) {
    res.status(403).json({ detail: "Las contrataciones están deshabilitadas temporalmente." });
    return;
  }
  if (req.user!.role !== "client") {
    res.status(400).json({ detail: "Solo los clientes pueden crear solicitudes." });
    return;
  }
  if (clientHasHold(req.user!.id)) {
    res.status(403).json({ detail: CLIENT_HOLD_MESSAGE });
    return;
  }

  const files = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];
  for (const f of files) {
    if (!f.mimetype?.startsWith("image/") && !/\.(png|jpe?g|webp|gif)$/i.test(f.originalname || "")) {
      res.status(400).json({ images: "Solo se permiten archivos de imagen." });
      return;
    }
  }

  const b = (req.body || {}) as Record<string, unknown>;
  const description = String(b.description || "").trim();
  if (!description) {
    res.status(400).json({ description: ["La descripcion es obligatoria."] });
    return;
  }

  // Household resolution (matches Django ServiceRequestCreateSerializer)
  let householdId = Number(b.household || 0);
  let household = householdId
    ? (db.prepare("SELECT * FROM households WHERE id = ?").get(householdId) as Record<string, unknown> | undefined)
    : undefined;
  if (!household || Number(household.owner_id) !== req.user!.id) {
    const existingHouse = db
      .prepare("SELECT * FROM households WHERE owner_id = ? ORDER BY is_default DESC, id ASC LIMIT 1")
      .get(req.user!.id) as Record<string, unknown> | undefined;
    if (existingHouse) {
      household = existingHouse;
      householdId = Number(existingHouse.id);
    } else {
      const hIns = db
        .prepare(
          `INSERT INTO households (owner_id, label, property_type, address_line, neighborhood, city, country, latitude, longitude, notes, is_default, created_at)
           VALUES (?, 'Mi hogar', 'apartment', ?, ?, ?, 'Colombia', ?, ?, '', 1, ?)`
        )
        .run(
          req.user!.id,
          String(household?.address_line || req.user!.address || "Dg. 40a # 8-91"),
          String(household?.neighborhood || "Santa Fé"),
          req.user!.city || "Bogotá",
          household?.latitude !== undefined ? Number(household.latitude) : 4.626910245009691,
          household?.longitude !== undefined ? Number(household.longitude) : -74.06721883068974,
          nowIso()
        );
      householdId = Number(hIns.lastInsertRowid);
    }
  }

  const selectedServiceId =
    b.selected_service !== undefined && b.selected_service !== null && b.selected_service !== ""
      ? Number(b.selected_service)
      : null;
  let selectedCategoryId =
    b.selected_category !== undefined && b.selected_category !== null && b.selected_category !== ""
      ? Number(b.selected_category)
      : null;
  let suggestedCategoryId =
    b.suggested_category !== undefined && b.suggested_category !== null && b.suggested_category !== ""
      ? Number(b.suggested_category)
      : null;
  const diagnosticSessionId =
    b.diagnostic_session !== undefined && b.diagnostic_session !== null && b.diagnostic_session !== ""
      ? Number(b.diagnostic_session)
      : null;

  if (diagnosticSessionId) {
    const ds = db.prepare("SELECT * FROM diagnostic_sessions WHERE id = ?").get(diagnosticSessionId) as
      | Record<string, unknown>
      | undefined;
    if (!ds || (ds.user_id !== null && Number(ds.user_id) !== req.user!.id)) {
      res.status(400).json({ diagnostic_session: "Esta sesión de diagnóstico no pertenece a tu cuenta." });
      return;
    }
    if (!suggestedCategoryId && ds.suggested_category_id) {
      suggestedCategoryId = Number(ds.suggested_category_id);
    }
    if (ds.user_id === null) {
      db.prepare("UPDATE diagnostic_sessions SET user_id = ? WHERE id = ?").run(req.user!.id, diagnosticSessionId);
    }
  }

  if (selectedServiceId) {
    const srv = db
      .prepare(
        "SELECT s.*, c.is_active AS cat_active FROM services s JOIN service_categories c ON c.id = s.category_id WHERE s.id = ?"
      )
      .get(selectedServiceId) as { id: number; category_id: number; is_active: number; cat_active: number } | undefined;
    if (!srv || !srv.is_active || !srv.cat_active) {
      res.status(400).json({ selected_service: "Selecciona un servicio activo." });
      return;
    }
    selectedCategoryId = srv.category_id;
  }

  const professionalId =
    b.professional !== undefined && b.professional !== null && b.professional !== ""
      ? Number(b.professional)
      : null;
  let urgency = String(b.urgency || "this_week");

  if (professionalId) {
    const prof = db.prepare("SELECT * FROM professional_profiles WHERE id = ?").get(professionalId) as
      | Record<string, unknown>
      | undefined;
    if (!prof || !prof.is_active) {
      res.status(400).json({ professional: "Selecciona un profesional activo." });
      return;
    }
    if (Number(prof.user_id) === req.user!.id) {
      res.status(400).json({ professional: "No puedes solicitar un servicio a tu propio perfil profesional." });
      return;
    }
    if (!selectedServiceId) {
      res.status(400).json({ selected_service: "Selecciona el servicio concreto." });
      return;
    }
    if (professionalHasHold(professionalId)) {
      res.status(403).json({ detail: PROFESSIONAL_HOLD_MESSAGE });
      return;
    }
    if (!professionalOffersService(professionalId, selectedServiceId)) {
      res.status(400).json({ professional: "El profesional no ofrece este servicio." });
      return;
    }
    if (urgency === "urgent" && !prof.accepts_urgent) {
      urgency = "this_week";
    }
  }

  if (!selectedCategoryId) {
    res.status(400).json({ selected_category: "Selecciona una categoria o un servicio." });
    return;
  }

  const ts = nowIso();
  const ins = db
    .prepare(
      `INSERT INTO service_requests (
        client_id, household_id, diagnostic_session_id, suggested_category_id,
        selected_category_id, selected_service_id, professional_id, description,
        urgency, search_radius_km, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`
    )
    .run(
      req.user!.id,
      householdId,
      diagnosticSessionId,
      suggestedCategoryId,
      selectedCategoryId,
      selectedServiceId,
      professionalId,
      description,
      urgency,
      Number(b.search_radius_km || 10) || 10,
      ts,
      ts
    );

  const reqId = Number(ins.lastInsertRowid);

  if (diagnosticSessionId) {
    const followed = suggestedCategoryId !== null && suggestedCategoryId === selectedCategoryId;
    db.prepare("UPDATE diagnostic_sessions SET status = ? WHERE id = ?").run(
      followed ? "confirmed" : "discarded",
      diagnosticSessionId
    );
  }

  for (const f of files) {
    const rel = saveMediaFile("requests", f.originalname || "foto.jpg", f.buffer);
    db.prepare(
      "INSERT INTO service_request_images (service_request_id, image_path, uploaded_by_id, created_at) VALUES (?, ?, ?, ?)"
    ).run(reqId, rel, req.user!.id, ts);
  }

  if (!professionalId) {
    buildCandidatesForRequest(reqId);
  } else {
    const prof = db
      .prepare("SELECT user_id, display_name FROM professional_profiles WHERE id = ?")
      .get(professionalId) as { user_id: number; display_name: string } | undefined;
    if (prof?.user_id) {
      addNotification({
        userId: prof.user_id,
        title: "Nueva solicitud de servicio",
        text: `${personName(req.user)} te envió una solicitud de servicio #${reqId}.`,
        type: "sistema",
        link: `/profesional/solicitudes/${reqId}`,
        targetId: String(reqId),
      });
    }
  }

  const created = db.prepare("SELECT * FROM service_requests WHERE id = ?").get(reqId) as Record<string, unknown>;
  res.status(201).json(serializeServiceRequest(created, req.user, req));
});

router.get("/requests/:id/", requireAuth, (req: AuthedRequest, res: Response) => {
  const sr = getScopedRequest(req, Number(req.params.id));
  if (!sr) {
    res.status(404).json({ detail: "Solicitud no encontrada." });
    return;
  }
  res.json(serializeServiceRequest(sr, req.user, req));
});

router.post("/requests/:id/refresh_candidates/", requireAuth, (req: AuthedRequest, res: Response) => {
  const sr = getScopedRequest(req, Number(req.params.id));
  if (!sr) {
    res.status(404).json({ detail: "Solicitud no encontrada." });
    return;
  }
  if (sr.professional_id !== null && sr.professional_id !== undefined) {
    res.status(400).json({ detail: "Las solicitudes dirigidas no recalculan candidatos." });
    return;
  }
  buildCandidatesForRequest(Number(sr.id));
  const updated = db.prepare("SELECT * FROM service_requests WHERE id = ?").get(Number(sr.id)) as Record<
    string,
    unknown
  >;
  res.json(serializeServiceRequest(updated, req.user, req));
});

router.post("/requests/:id/accept/", requireAuth, (req: AuthedRequest, res: Response) => {
  const settings = loadPlatformSettings();
  if (settings.features?.hirings === false) {
    res.status(403).json({ detail: "Las contrataciones están deshabilitadas temporalmente." });
    return;
  }
  const sr = getScopedRequest(req, Number(req.params.id));
  if (!sr) {
    res.status(404).json({ detail: "Solicitud no encontrada." });
    return;
  }
  if (req.user!.role !== "professional") {
    res.status(403).json({ detail: "Solo el profesional destinatario puede aceptar." });
    return;
  }
  const profile = db
    .prepare("SELECT * FROM professional_profiles WHERE user_id = ?")
    .get(req.user!.id) as Record<string, unknown> | undefined;
  if (!profile) {
    res.status(403).json({ detail: "Solo el profesional destinatario puede responder la solicitud." });
    return;
  }
  if (professionalHasHold(Number(profile.id))) {
    res.status(403).json({ detail: PROFESSIONAL_HOLD_MESSAGE });
    return;
  }
  if (Number(sr.client_id) === req.user!.id) {
    res.status(403).json({ detail: "No puedes aceptar tu propia solicitud de servicio." });
    return;
  }
  if (Number(sr.professional_id) !== Number(profile.id)) {
    res.status(403).json({ detail: "Esta solicitud no esta dirigida a este profesional." });
    return;
  }
  if (sr.status !== "open") {
    res.status(400).json({ status: "La solicitud ya no se puede aceptar." });
    return;
  }
  if (!professionalOffersService(Number(profile.id), sr.selected_service_id ? Number(sr.selected_service_id) : null)) {
    res.status(400).json({ professional: "El profesional no ofrece este servicio." });
    return;
  }

  const offering = db
    .prepare("SELECT * FROM professional_services WHERE profile_id = ? AND service_id = ?")
    .get(Number(profile.id), sr.selected_service_id as number) as Record<string, unknown>;
  const existingOrder = db
    .prepare("SELECT * FROM orders WHERE service_request_id = ? AND professional_id = ?")
    .get(Number(sr.id), Number(profile.id)) as Record<string, unknown> | undefined;

  const ts = nowIso();
  let orderId: number;
  if (!existingOrder) {
    const insOrd = db
      .prepare(
        `INSERT INTO orders (
          service_request_id, professional_id, client_id, status, payment_status,
          payout_status, estimate_min, estimate_max, client_notes, arrival_code,
          professional_latitude, professional_longitude, created_at, updated_at
        ) VALUES (?, ?, ?, 'accepted', 'pending', 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        Number(sr.id),
        Number(profile.id),
        Number(sr.client_id),
        offering?.price_min ?? null,
        offering?.price_max ?? null,
        String(sr.description || ""),
        generateArrivalCode(),
        profile.latitude ?? null,
        profile.longitude ?? null,
        ts,
        ts
      );
    orderId = Number(insOrd.lastInsertRowid);
  } else {
    orderId = Number(existingOrder.id);
    if (!["requested", "traveling"].includes(String(existingOrder.status))) {
      res.status(400).json({ status: "La orden ya tiene actividad. Actualiza la solicitud antes de aceptar." });
      return;
    }
    db.prepare(
      "UPDATE orders SET status = 'accepted', estimate_min = ?, estimate_max = ?, updated_at = ? WHERE id = ?"
    ).run(offering?.price_min ?? null, offering?.price_max ?? null, ts, orderId);
  }

  db.prepare(
    "INSERT INTO order_events (order_id, status, note, created_by_id, created_at) VALUES (?, 'accepted', 'Solicitud aceptada por el profesional.', ?, ?)"
  ).run(orderId, req.user!.id, ts);
  db.prepare("UPDATE service_requests SET status = 'accepted', updated_at = ? WHERE id = ?").run(ts, Number(sr.id));
  db.prepare(
    "UPDATE request_candidates SET status = 'hired' WHERE request_id = ? AND professional_id = ?"
  ).run(Number(sr.id), Number(profile.id));

  addNotification({
    userId: Number(sr.client_id),
    title: "Solicitud aceptada",
    text: `${profile.display_name} aceptó tu solicitud #${sr.id}.`,
    type: "sistema",
    link: `/cliente/ordenes/${orderId}`,
    targetId: String(orderId),
  });

  const updated = db.prepare("SELECT * FROM service_requests WHERE id = ?").get(Number(sr.id)) as Record<
    string,
    unknown
  >;
  res.json(serializeServiceRequest(updated, req.user, req));
});

router.post("/requests/:id/reject/", requireAuth, (req: AuthedRequest, res: Response) => {
  const sr = getScopedRequest(req, Number(req.params.id));
  if (!sr) {
    res.status(404).json({ detail: "Solicitud no encontrada." });
    return;
  }
  if (req.user!.role !== "professional") {
    res.status(403).json({ detail: "Solo el profesional destinatario puede rechazar." });
    return;
  }
  const profile = db
    .prepare("SELECT * FROM professional_profiles WHERE user_id = ?")
    .get(req.user!.id) as Record<string, unknown> | undefined;
  if (!profile || Number(sr.professional_id) !== Number(profile.id)) {
    res.status(403).json({ detail: "Esta solicitud no esta dirigida a este profesional." });
    return;
  }
  if (sr.status !== "open") {
    res.status(400).json({ status: "La solicitud ya no se puede rechazar." });
    return;
  }

  const orders = db.prepare("SELECT * FROM orders WHERE service_request_id = ?").all(Number(sr.id)) as Array<
    Record<string, unknown>
  >;
  for (const o of orders) {
    if (!["requested", "traveling", "cancelled"].includes(String(o.status))) {
      res.status(400).json({ status: "La orden ya tiene actividad y no se puede rechazar." });
      return;
    }
  }
  const ts = nowIso();
  for (const o of orders) {
    if (o.status !== "cancelled") {
      db.prepare("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?").run(ts, Number(o.id));
      db.prepare(
        "INSERT INTO order_events (order_id, status, note, created_by_id, created_at) VALUES (?, 'cancelled', 'Solicitud rechazada por el profesional.', ?, ?)"
      ).run(Number(o.id), req.user!.id, ts);
    }
  }
  db.prepare("UPDATE service_requests SET status = 'rejected', updated_at = ? WHERE id = ?").run(ts, Number(sr.id));
  db.prepare(
    "UPDATE request_candidates SET status = 'declined' WHERE request_id = ? AND professional_id = ?"
  ).run(Number(sr.id), Number(profile.id));

  const updated = db.prepare("SELECT * FROM service_requests WHERE id = ?").get(Number(sr.id)) as Record<
    string,
    unknown
  >;
  res.json(serializeServiceRequest(updated, req.user, req));
});

router.get("/requests/:id/images/:imageId/", requireAuth, (req: AuthedRequest, res: Response) => {
  const sr = getScopedRequest(req, Number(req.params.id));
  if (!sr) {
    res.status(404).json({ detail: "Solicitud no encontrada." });
    return;
  }
  const img = db
    .prepare("SELECT * FROM service_request_images WHERE id = ? AND service_request_id = ?")
    .get(Number(req.params.imageId), Number(sr.id)) as { image_path: string } | undefined;
  if (!img) {
    res.status(404).json({ detail: "Imagen no encontrada." });
    return;
  }
  const abs = path.join(MEDIA_DIR, img.image_path);
  if (!fs.existsSync(abs)) {
    res.status(404).json({ detail: "Archivo no encontrado." });
    return;
  }
  res.type(guessMime(abs)).send(fs.readFileSync(abs));
});

// ── Orders ───────────────────────────────────────────────────────────────────

router.get("/orders/", requireAuth, (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  let rows: Array<Record<string, unknown>> = [];
  if (isStaffUser(user)) {
    rows = db.prepare("SELECT * FROM orders ORDER BY created_at DESC, id DESC").all() as Array<
      Record<string, unknown>
    >;
  } else if (user.role === "professional") {
    const prof = db.prepare("SELECT id FROM professional_profiles WHERE user_id = ?").get(user.id) as
      | { id: number }
      | undefined;
    if (prof) {
      rows = db
        .prepare("SELECT * FROM orders WHERE professional_id = ? AND client_id != ? ORDER BY created_at DESC, id DESC")
        .all(prof.id, user.id) as Array<Record<string, unknown>>;
    }
  } else {
    rows = db
      .prepare(
        `SELECT o.* FROM orders o
         JOIN professional_profiles pp ON pp.id = o.professional_id
         WHERE o.client_id = ? AND pp.user_id != ?
         ORDER BY o.created_at DESC, o.id DESC`
      )
      .all(user.id, user.id) as Array<Record<string, unknown>>;
  }

  if (req.query.status) {
    rows = rows.filter((o) => String(o.status) === String(req.query.status));
  }
  res.json(
    paginate(
      rows.map((o) => serializeOrder(o, req.user, req)),
      req.query.page,
      req.query.page_size,
      req.originalUrl,
      50
    )
  );
});

router.post("/orders/", requireAuth, (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  if (user.role !== "client") {
    res.status(400).json({ detail: "Solo el cliente puede solicitar una orden." });
    return;
  }
  if (clientHasHold(user.id)) {
    res.status(403).json({ detail: CLIENT_HOLD_MESSAGE });
    return;
  }

  const b = (req.body || {}) as Record<string, unknown>;
  const srId = Number(b.service_request || 0);
  const profId = Number(b.professional || 0);
  const sr = db.prepare("SELECT * FROM service_requests WHERE id = ?").get(srId) as Record<string, unknown> | undefined;
  if (!sr || Number(sr.client_id) !== user.id) {
    res.status(400).json({ service_request: "La solicitud no pertenece a este usuario." });
    return;
  }
  if (!["open", "matched"].includes(String(sr.status))) {
    res.status(400).json({ service_request: "La solicitud ya no permite crear una orden." });
    return;
  }
  const prof = db.prepare("SELECT * FROM professional_profiles WHERE id = ?").get(profId) as
    | Record<string, unknown>
    | undefined;
  if (!prof) {
    res.status(400).json({ professional: "Profesional no encontrado." });
    return;
  }
  if (Number(prof.user_id) === user.id) {
    res.status(400).json({ professional: "No puedes contratar tu propio perfil profesional." });
    return;
  }
  if (professionalHasHold(profId)) {
    res.status(403).json({ detail: PROFESSIONAL_HOLD_MESSAGE });
    return;
  }
  if (
    sr.selected_service_id &&
    !professionalOffersService(profId, Number(sr.selected_service_id))
  ) {
    res.status(400).json({ professional: "El profesional no ofrece el servicio seleccionado." });
    return;
  }
  if (sr.professional_id !== null && Number(sr.professional_id) !== profId) {
    res.status(400).json({ detail: "La solicitud ya está dirigida a otro profesional." });
    return;
  }
  const existingOrd = db.prepare("SELECT id FROM orders WHERE service_request_id = ?").get(srId);
  if (existingOrd) {
    res.status(400).json({ detail: "Ya existe una orden para esta solicitud." });
    return;
  }

  const offering = sr.selected_service_id
    ? (db
        .prepare("SELECT price_min, price_max FROM professional_services WHERE profile_id = ? AND service_id = ?")
        .get(profId, Number(sr.selected_service_id)) as
        | { price_min: string | null; price_max: string | null }
        | undefined)
    : undefined;
  const ts = nowIso();
  const ins = db
    .prepare(
      `INSERT INTO orders (
        service_request_id, professional_id, client_id, status, payment_status,
        payout_status, scheduled_for, estimate_min, estimate_max, client_notes,
        arrival_code, created_at, updated_at
      ) VALUES (?, ?, ?, 'requested', 'pending', 'pending', ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      srId,
      profId,
      user.id,
      b.scheduled_for ? String(b.scheduled_for) : null,
      offering?.price_min ?? null,
      offering?.price_max ?? null,
      String(b.client_notes || ""),
      generateArrivalCode(),
      ts,
      ts
    );

  const orderId = Number(ins.lastInsertRowid);
  db.prepare(
    "INSERT INTO order_events (order_id, status, note, created_by_id, created_at) VALUES (?, 'requested', 'Visita solicitada desde la app.', ?, ?)"
  ).run(orderId, user.id, ts);
  db.prepare("UPDATE service_requests SET professional_id = ?, status = 'open', updated_at = ? WHERE id = ?").run(
    profId,
    ts,
    srId
  );

  const created = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as Record<string, unknown>;
  res.status(201).json(serializeOrder(created, req.user, req));
});

router.get("/orders/:id/", requireAuth, (req: AuthedRequest, res: Response) => {
  const order = getScopedOrder(req, Number(req.params.id));
  if (!order) {
    res.status(404).json({ detail: "Orden no encontrada." });
    return;
  }
  res.json(serializeOrder(order, req.user, req));
});

router.post("/orders/:id/transition/", requireAuth, (req: AuthedRequest, res: Response) => {
  const order = getScopedOrder(req, Number(req.params.id));
  if (!order) {
    res.status(404).json({ detail: "Orden no encontrada." });
    return;
  }
  const b = (req.body || {}) as Record<string, unknown>;
  const newStatus = String(b.status || "").trim();
  if (!newStatus || !(newStatus in ORDER_STATUS_LABELS)) {
    res.status(400).json({ status: "Estado de orden inválido." });
    return;
  }
  const result = transitionOrder(Number(order.id), newStatus, req.user!, {
    note: String(b.note || ""),
    scheduled_for: b.scheduled_for ? String(b.scheduled_for) : undefined,
    arrival_code: String(b.arrival_code || ""),
  });
  if (!result.ok) {
    res.status(result.status).json(result.payload);
    return;
  }
  res.json(serializeOrder(result.order, req.user, req));
});

router.post("/orders/:id/price/", requireAuth, (req: AuthedRequest, res: Response) => {
  const order = getScopedOrder(req, Number(req.params.id));
  if (!order) {
    res.status(404).json({ detail: "Orden no encontrada." });
    return;
  }
  if (!isAssignedProfessional(order, req.user)) {
    res.status(403).json({ detail: "Solo el profesional asignado puede registrar el valor final acordado." });
    return;
  }
  const amount = Number(req.body?.final_price);
  if (!Number.isFinite(amount) || amount < 1) {
    res.status(400).json({ final_price: "Ingresa un valor final válido." });
    return;
  }
  if (["requested", "cancelled"].includes(String(order.status))) {
    res.status(400).json({ detail: "La orden debe estar aceptada y no cancelada para confirmar la tarifa." });
    return;
  }
  const [lower, upper] = priceBoundsForOrder(order);
  if (lower === null || upper === null || lower < 1 || upper < lower) {
    res.status(400).json({
      detail: "El servicio necesita una tarifa mínima y máxima publicadas válidas antes de confirmar el valor final.",
    });
    return;
  }
  if (amount < lower || amount > upper) {
    res.status(400).json({ detail: `La tarifa final debe estar entre ${lower} y ${upper} COP.` });
    return;
  }
  const currentFinal = order.final_price !== null ? Number(order.final_price) : null;
  const hasPendingPay = Boolean(
    db.prepare("SELECT 1 FROM payments WHERE order_id = ? AND status = 'pending' LIMIT 1").get(Number(order.id))
  );
  if (amount !== currentFinal && (order.payment_status === "paid" || hasPendingPay)) {
    res.status(400).json({ detail: "El valor no se puede cambiar con un pago confirmado o en proceso." });
    return;
  }
  db.prepare(
    "UPDATE orders SET final_price = ?, estimate_min = ?, estimate_max = ?, updated_at = ? WHERE id = ?"
  ).run(amount.toFixed(2), String(lower), String(upper), nowIso(), Number(order.id));
  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(order.id)) as Record<string, unknown>;
  res.json(serializeOrder(updated, req.user, req));
});

router.post("/orders/:id/wompi-checkout/", requireAuth, (req: AuthedRequest, res: Response) => {
  const order = getScopedOrder(req, Number(req.params.id));
  if (!order) {
    res.status(404).json({ detail: "Orden no encontrada." });
    return;
  }
  if (!isOrderClient(order, req.user)) {
    res.status(403).json({ detail: "Solo el cliente de la orden puede pagarla." });
    return;
  }
  if (order.payment_status !== "pending") {
    res.status(400).json({ detail: "La orden ya está pagada." });
    return;
  }
  if (order.status !== "completed") {
    res.status(400).json({ detail: PAY_AFTER_COMPLETION });
    return;
  }
  const settings = loadPlatformSettings();
  const payCfg = (settings.sections?.payments || {}) as Record<string, unknown>;
  if (
    payCfg.pse_enabled === false &&
    payCfg.card_enabled === false &&
    payCfg.transfer_enabled === false &&
    payCfg.wallet_enabled === false
  ) {
    res.status(503).json({ detail: "Los pagos en línea están desactivados por el administrador." });
    return;
  }
  const amount = order.final_price !== null && order.final_price !== undefined ? Number(order.final_price) : 0;
  if (!amount) {
    res
      .status(400)
      .json({ detail: "El profesional debe registrar el valor final acordado antes de iniciar el pago." });
    return;
  }
  const [lower, upper] = priceBoundsForOrder(order);
  if (lower !== null && upper !== null && (amount < lower || amount > upper)) {
    res.status(400).json({ detail: `La tarifa final debe estar entre ${lower} y ${upper} COP.` });
    return;
  }
  const discount = computeDiscount(amount);
  const cents = Math.round((amount - discount) * 100);
  if (cents < 150000) {
    res.status(400).json({ detail: "El monto mínimo de pago es $1.500 COP." });
    return;
  }
  const reference = `SPX-${order.id}-${crypto.randomBytes(4).toString("hex")}`;
  const ts = nowIso();
  db.prepare(
    `INSERT INTO payments (order_id, client_id, reference, amount_in_cents, discount_amount, currency, status, wompi_transaction_id, payment_method, test_mode, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'COP', 'pending', '', '', 1, ?, ?)`
  ).run(Number(order.id), req.user!.id, reference, cents, discount.toFixed(2), ts, ts);

  const origin = req.get("origin") || `${req.protocol}://${req.get("host")}`;
  const checkoutUrl = `${origin}/cliente/historialpago?order=${order.id}&reference=${encodeURIComponent(reference)}`;
  res.json({ checkout_url: checkoutUrl, reference, amount_in_cents: cents });
});

router.post("/orders/:id/confirm-demo-payment/", requireAuth, (req: AuthedRequest, res: Response) => {
  const order = getScopedOrder(req, Number(req.params.id));
  if (!order) {
    res.status(404).json({ detail: "Orden no encontrada." });
    return;
  }
  if (!isOrderClient(order, req.user)) {
    res.status(403).json({ detail: "Solo el cliente de la orden puede confirmar el pago." });
    return;
  }
  if (order.payment_status === "pending" && order.status !== "completed") {
    res.status(400).json({ detail: PAY_AFTER_COMPLETION });
    return;
  }

  const b = (req.body || {}) as Record<string, unknown>;
  const method = b.method ? String(b.method) : "";
  const methodCodes: Record<string, string> = {
    credit: "DEV_CREDIT",
    debit: "DEV_DEBIT",
    transfer: "DEV_TRANSFER",
    wallet: "NEQUI",
  };
  let simulateDecline = false;

  if (method) {
    if (!["credit", "debit", "transfer", "wallet"].includes(method)) {
      res.status(400).json({ method: "Método de pago no válido." });
      return;
    }
    const errors: Record<string, string> = {};
    if (method === "credit" || method === "debit") {
      const cardNumber = String(b.card_number || "").replace(/[ -]/g, "");
      if (!/^\d{13,19}$/.test(cardNumber) || !luhnValid(cardNumber)) {
        errors.card_number = "El número de tarjeta no es válido.";
      }
      if (String(b.card_holder || "").trim().length < 3) {
        errors.card_holder = "Ingresa el nombre como aparece en la tarjeta.";
      }
      const cvv = String(b.cvv || "");
      if (!/^\d{3,4}$/.test(cvv)) {
        errors.cvv = "El código de seguridad debe tener 3 o 4 dígitos.";
      }
      const expiry = String(b.expiry || "").replace(/\s/g, "");
      const m = expiry.match(/^(\d{1,2})\/(\d{2,4})$/);
      if (!m) {
        errors.expiry = "Usa el formato MM/AA.";
      } else {
        const month = Number(m[1]);
        let year = Number(m[2]);
        if (year < 100) year += 2000;
        const now = new Date();
        if (month < 1 || month > 12) {
          errors.expiry = "Usa el formato MM/AA.";
        } else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
          errors.expiry = "La tarjeta está vencida.";
        }
      }
      if (cardNumber === DECLINED_TEST_CARD) simulateDecline = true;
    } else if (method === "transfer") {
      if (!String(b.bank || "").trim()) errors.bank = "Selecciona el banco.";
      if (!["savings", "checking"].includes(String(b.account_type || ""))) {
        errors.account_type = "Selecciona el tipo de cuenta.";
      }
      if (!["CC", "CE", "NIT", "PP"].includes(String(b.document_type || ""))) {
        errors.document_type = "Selecciona el tipo de documento.";
      }
      const docNum = String(b.document_number || "");
      if (!/^[a-zA-Z0-9]{5,15}$/.test(docNum)) {
        errors.document_number = "El número de documento no es válido.";
      }
      if (String(b.transfer_reference || "").trim().toUpperCase() === DECLINED_TEST_REFERENCE) {
        simulateDecline = true;
      }
    }
    if (Object.keys(errors).length > 0) {
      res.status(400).json(errors);
      return;
    }
  }

  const price = orderPrice(order);
  const discount = computeDiscount(price);
  const cents = Math.max(0, Math.round((price - discount) * 100));
  const payMethod = methodCodes[method] || "DEV";
  const ts = nowIso();

  if (order.payment_status === "pending" && simulateDecline) {
    const declRef = `DEV-DECL-${order.id}-${crypto.randomBytes(3).toString("hex")}`;
    db.prepare(
      `INSERT INTO payments (order_id, client_id, reference, amount_in_cents, discount_amount, currency, status, wompi_transaction_id, payment_method, test_mode, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'COP', 'declined', '', ?, 1, ?, ?)`
    ).run(Number(order.id), req.user!.id, declRef, cents, discount.toFixed(2), payMethod, ts, ts);
    res.status(402).json({
      detail: "Pago rechazado. Verifica los datos o intenta con otro medio de pago.",
      payment_status: "declined",
      reference: declRef,
    });
    return;
  }

  if (order.payment_status === "pending") {
    const ref = String(order.payment_reference || `DEV-${order.id}`);
    db.prepare(
      "UPDATE orders SET payment_status = 'paid', payment_confirmed_at = ?, payment_reference = ?, updated_at = ? WHERE id = ?"
    ).run(ts, ref, ts, Number(order.id));
    const existingApproved = db
      .prepare("SELECT * FROM payments WHERE order_id = ? AND status = 'approved' LIMIT 1")
      .get(Number(order.id)) as Record<string, unknown> | undefined;
    if (!existingApproved) {
      db.prepare(
        `INSERT INTO payments (order_id, client_id, reference, amount_in_cents, discount_amount, currency, status, wompi_transaction_id, payment_method, test_mode, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'COP', 'approved', ?, ?, 1, ?, ?)`
      ).run(Number(order.id), req.user!.id, ref, cents, discount.toFixed(2), `SIM-${order.id}`, payMethod, ts, ts);
    }
    registerSplit(Number(order.id), price, discount);
    autoSettleCompletedPaidOrders(Number(order.id));
  }

  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(order.id)) as Record<string, unknown>;
  res.json(serializeOrder(updated, req.user, req));
});

router.post("/orders/:id/location/", requireAuth, (req: AuthedRequest, res: Response) => {
  const order = getScopedOrder(req, Number(req.params.id));
  if (!order) {
    res.status(404).json({ detail: "Orden no encontrada." });
    return;
  }
  if (!isAssignedProfessional(order, req.user)) {
    res.status(403).json({ detail: "Solo el profesional puede actualizar su ubicacion." });
    return;
  }
  const sr = db.prepare("SELECT status FROM service_requests WHERE id = ?").get(order.service_request_id as number) as
    | { status: string }
    | undefined;
  if (order.status !== "traveling" || sr?.status !== "accepted") {
    res.status(400).json({ detail: "La ubicación solo se comparte durante el desplazamiento." });
    return;
  }
  const lat = Number(req.body?.latitude);
  const lng = Number(req.body?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ detail: "Las coordenadas no son válidas." });
    return;
  }
  db.prepare("UPDATE orders SET professional_latitude = ?, professional_longitude = ?, updated_at = ? WHERE id = ?").run(
    lat,
    lng,
    nowIso(),
    Number(order.id)
  );
  db.prepare("UPDATE professional_profiles SET latitude = ?, longitude = ? WHERE id = ?").run(
    lat,
    lng,
    order.professional_id as number
  );
  const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(order.id)) as Record<string, unknown>;
  res.json(serializeOrder(updated, req.user, req));
});

router.post(
  "/orders/:id/evidence/",
  requireAuth,
  uploadImages.single("image"),
  (req: AuthedRequest, res: Response) => {
    const order = getScopedOrder(req, Number(req.params.id));
    if (!order) {
      res.status(404).json({ detail: "Orden no encontrada." });
      return;
    }
    if (!isAssignedProfessional(order, req.user)) {
      res.status(403).json({ detail: "Solo el profesional puede subir evidencia." });
      return;
    }
    if (["requested", "completed", "cancelled"].includes(String(order.status))) {
      res.status(400).json({ detail: "Esta orden no permite adjuntar evidencias." });
      return;
    }
    if (!req.file) {
      res.status(400).json({ detail: "La foto es obligatoria." });
      return;
    }
    const rel = saveMediaFile("evidence", req.file.originalname || "evidencia.jpg", req.file.buffer);
    db.prepare("INSERT INTO work_evidence (order_id, image_path, caption, created_at) VALUES (?, ?, ?, ?)").run(
      Number(order.id),
      rel,
      String(req.body?.caption || ""),
      nowIso()
    );
    const updated = db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(order.id)) as Record<string, unknown>;
    res.status(201).json(serializeOrder(updated, req.user, req));
  }
);

router.get("/orders/:id/evidence/:evidenceId/", requireAuth, (req: AuthedRequest, res: Response) => {
  const order = getScopedOrder(req, Number(req.params.id));
  if (!order) {
    res.status(404).json({ detail: "Orden no encontrada." });
    return;
  }
  const ev = db
    .prepare("SELECT * FROM work_evidence WHERE id = ? AND order_id = ?")
    .get(Number(req.params.evidenceId), Number(order.id)) as { image_path: string } | undefined;
  if (!ev) {
    res.status(404).json({ detail: "Imagen no encontrada." });
    return;
  }
  const abs = path.join(MEDIA_DIR, ev.image_path);
  if (!fs.existsSync(abs)) {
    res.status(404).json({ detail: "Archivo no encontrado." });
    return;
  }
  res.setHeader("Cache-Control", "private, no-store");
  res.type(guessMime(abs)).send(fs.readFileSync(abs));
});

// ── Reviews ──────────────────────────────────────────────────────────────────

router.get("/reviews/", requireAuth, (req: AuthedRequest, res: Response) => {
  const rows = db
    .prepare(
      `SELECT r.* FROM reviews r
       JOIN orders o ON o.id = r.order_id
       WHERE o.client_id = ?
       ORDER BY r.created_at DESC, r.id DESC`
    )
    .all(req.user!.id) as Array<Record<string, unknown>>;
  res.json(
    rows.map((r) => ({
      id: Number(r.id),
      order: Number(r.order_id),
      rating: Number(r.rating),
      comment: String(r.comment || ""),
      created_at: String(r.created_at),
    }))
  );
});

router.post("/reviews/", requireAuth, (req: AuthedRequest, res: Response) => {
  const orderId = Number(req.body?.order || 0);
  const rating = Number(req.body?.rating || 0);
  const comment = String(req.body?.comment || "");
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as Record<string, unknown> | undefined;
  if (!order) {
    res.status(400).json({ order: "Orden no encontrada." });
    return;
  }
  if (!isOrderClient(order, req.user)) {
    res.status(400).json({ order: "Solo el cliente puede calificar la orden." });
    return;
  }
  if (order.status !== "completed") {
    res.status(400).json({ order: "La orden aun no esta completada." });
    return;
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ rating: "Calificación debe estar entre 1 y 5." });
    return;
  }
  if (db.prepare("SELECT id FROM reviews WHERE order_id = ?").get(orderId)) {
    res.status(400).json({ order: "Esta orden ya tiene calificación." });
    return;
  }
  const ts = nowIso();
  const ins = db
    .prepare("INSERT INTO reviews (order_id, rating, comment, created_at) VALUES (?, ?, ?, ?)")
    .run(orderId, rating, comment, ts);
  const avgRow = db
    .prepare(
      `SELECT AVG(r.rating) AS avg_r
       FROM reviews r
       JOIN orders o ON o.id = r.order_id
       WHERE o.professional_id = ?`
    )
    .get(order.professional_id as number) as { avg_r: number | null };
  db.prepare("UPDATE professional_profiles SET rating_avg = ? WHERE id = ?").run(
    (avgRow?.avg_r || 0).toFixed(2),
    order.professional_id as number
  );
  res.status(201).json({
    id: Number(ins.lastInsertRowid),
    order: orderId,
    rating,
    comment,
    created_at: ts,
  });
});

// ── Client & Professional Finance ────────────────────────────────────────────

router.get("/payments/hold/", requireAuth, (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  const role = user.role === "professional" ? "professional" : "client";
  const rows =
    role === "client"
      ? (db
          .prepare("SELECT * FROM orders WHERE client_id = ? AND status = 'completed' AND payment_status = 'pending' LIMIT 20")
          .all(user.id) as Array<Record<string, unknown>>)
      : (db
          .prepare(
            `SELECT o.* FROM orders o
             JOIN professional_profiles pp ON pp.id = o.professional_id
             WHERE pp.user_id = ? AND o.status = 'completed' AND o.payment_status = 'pending'
             LIMIT 20`
          )
          .all(user.id) as Array<Record<string, unknown>>);

  const items = rows.map((o) => ({
    order_id: Number(o.id),
    service: serviceLabelForOrder(Number(o.id)),
    amount: orderPrice(o),
  }));
  const message = items.length ? (role === "client" ? CLIENT_HOLD_MESSAGE : PROFESSIONAL_HOLD_MESSAGE) : "";
  res.json({ hold: items.length > 0, role, message, orders: items });
});

router.get("/payments/history/", requireAuth, (req: AuthedRequest, res: Response) => {
  const rows = db
    .prepare("SELECT * FROM payments WHERE client_id = ? ORDER BY created_at DESC, id DESC LIMIT 200")
    .all(req.user!.id) as Array<Record<string, unknown>>;
  res.json(rows.map(buildClientReceiptRow));
});

router.get("/payments/:id/receipt/", requireAuth, (req: AuthedRequest, res: Response) => {
  const p = db
    .prepare("SELECT * FROM payments WHERE id = ? AND client_id = ?")
    .get(Number(req.params.id), req.user!.id) as Record<string, unknown> | undefined;
  if (!p) {
    res.status(404).json({ detail: "Comprobante no encontrado." });
    return;
  }
  res.json(buildClientReceiptRow(p));
});

router.post("/payments/wompi/events/", (req: Request, res: Response) => {
  const body = (req.body || {}) as Record<string, unknown>;
  if (body.event !== "transaction.updated") {
    res.json({ detail: "Evento ignorado." });
    return;
  }
  const tx = ((body.data as Record<string, unknown>)?.transaction || {}) as Record<string, unknown>;
  const payment = db
    .prepare("SELECT * FROM payments WHERE reference = ?")
    .get(String(tx.reference || "")) as Record<string, unknown> | undefined;
  const wompiMap: Record<string, string> = {
    APPROVED: "approved",
    DECLINED: "declined",
    VOIDED: "voided",
    ERROR: "error",
  };
  const newStatus = wompiMap[String(tx.status || "")];
  if (!payment || !newStatus) {
    res.json({ detail: "Sin cambios." });
    return;
  }
  if (payment.status === "approved" || payment.status === "refunded") {
    res.json({ detail: "Pago ya registrado." });
    return;
  }
  const ts = nowIso();
  db.prepare(
    "UPDATE payments SET status = ?, wompi_transaction_id = ?, payment_method = ?, updated_at = ? WHERE id = ?"
  ).run(newStatus, String(tx.id || "").slice(0, 80), String(tx.payment_method_type || "").slice(0, 40), ts, Number(payment.id));
  if (newStatus === "approved") {
    db.prepare(
      "UPDATE orders SET payment_status = 'paid', payment_confirmed_at = ?, payment_reference = ?, updated_at = ? WHERE id = ?"
    ).run(ts, String(payment.reference), ts, Number(payment.order_id));
    registerSplit(
      Number(payment.order_id),
      Number(payment.amount_in_cents || 0) / 100 + moneyNum(payment.discount_amount),
      moneyNum(payment.discount_amount)
    );
    autoSettleCompletedPaidOrders(Number(payment.order_id));
  }
  res.json({ detail: "Evento procesado." });
});

router.get("/professional/earnings/", requireAuth, (req: AuthedRequest, res: Response) => {
  const prof = db
    .prepare("SELECT * FROM professional_profiles WHERE user_id = ?")
    .get(req.user!.id) as Record<string, unknown> | undefined;
  if (!prof) {
    res.status(403).json({ detail: "Solo los profesionales tienen ingresos." });
    return;
  }
  const summary = professionalBalance(Number(prof.id));
  const orders = db
    .prepare(
      `SELECT * FROM orders
       WHERE professional_id = ? AND payment_status IN ('paid', 'refunded')
       ORDER BY COALESCE(payment_confirmed_at, created_at) DESC
       LIMIT 200`
    )
    .all(Number(prof.id)) as Array<Record<string, unknown>>;

  const incomes = orders.map((o) => {
    const client = findUserById(Number(o.client_id));
    const proAmt = moneyNum(o.professional_amount);
    const comAmt = moneyNum(o.commission_amount);
    return {
      order_id: Number(o.id),
      service: serviceLabelForOrder(Number(o.id)),
      client: personName(client),
      date: o.payment_confirmed_at ? String(o.payment_confirmed_at) : String(o.created_at),
      gross: moneyNum(proAmt + comAmt),
      commission: comAmt,
      commission_rate: moneyNum(o.commission_rate),
      net: proAmt,
      payout_status: String(o.payout_status),
      payout_status_label: PAYOUT_STATUS_LABELS[String(o.payout_status)] || String(o.payout_status),
      payout_settled_at: o.payout_settled_at ? String(o.payout_settled_at) : null,
      order_status_label: ORDER_STATUS_LABELS[String(o.status)] || String(o.status),
    };
  });

  const wRows = db
    .prepare("SELECT * FROM withdrawals WHERE professional_id = ? ORDER BY created_at DESC LIMIT 200")
    .all(Number(prof.id)) as Array<Record<string, unknown>>;
  const withdrawals = wRows.map(buildWithdrawalRow);
  const transfers = withdrawals.filter((w) => w.status === "paid");

  res.json({ summary, incomes, withdrawals, transfers });
});

router.post("/professional/withdrawals/", requireAuth, (req: AuthedRequest, res: Response) => {
  const prof = db
    .prepare("SELECT * FROM professional_profiles WHERE user_id = ?")
    .get(req.user!.id) as Record<string, unknown> | undefined;
  if (!prof) {
    res.status(403).json({ detail: "Solo los profesionales pueden solicitar retiros." });
    return;
  }
  const rawAmount = Number(req.body?.amount);
  const amount = Number.isFinite(rawAmount) ? moneyNum(rawAmount) : NaN;
  const destination = String(req.body?.destination || "").trim();
  if (destination.length < 5) {
    res.status(400).json({ detail: "Indica la cuenta de destino (banco o billetera y número)." });
    return;
  }
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) {
    res.status(400).json({ detail: `El retiro mínimo es $${MIN_WITHDRAWAL.toLocaleString("es-CO")} COP.` });
    return;
  }

  let createdRow: Record<string, unknown> | undefined;
  const ts = nowIso();
  db.exec("BEGIN IMMEDIATE");
  try {
    const balance = professionalBalance(Number(prof.id));
    if (amount > balance.available_balance) {
      db.exec("ROLLBACK");
      res.status(400).json({
        detail: `El monto supera tu saldo disponible ($${Math.floor(balance.available_balance).toLocaleString("es-CO")} COP).`,
      });
      return;
    }
    const ins = db
      .prepare(
        "INSERT INTO withdrawals (professional_id, amount, destination, status, transfer_reference, note, created_at) VALUES (?, ?, ?, 'pending', '', '', ?)"
      )
      .run(Number(prof.id), amount.toFixed(2), destination.slice(0, 160), ts);
    createdRow = db.prepare("SELECT * FROM withdrawals WHERE id = ?").get(ins.lastInsertRowid) as Record<string, unknown>;
    db.exec("COMMIT");
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore rollback errors
    }
    throw err;
  }

  const profName = String(prof.display_name || personName(req.user));
  const formattedAmt = Math.round(amount).toLocaleString("es-CO");
  addNotification({
    userId: null,
    type: "withdrawal",
    title: `Nueva solicitud de retiro ($${formattedAmt} COP)`,
    text: `${profName} solicitó retirar $${formattedAmt} COP hacia ${destination.slice(0, 120)}.`,
    link: "payments",
    targetId: String(createdRow?.id || ""),
  });

  res.status(201).json(buildWithdrawalRow(createdRow!));
});

// ── Admin Finance & Payments (Specific routes before :id!) ───────────────────

router.get("/admin/payments/", requireStaff, (_req: AuthedRequest, res: Response) => {
  const rows = db.prepare("SELECT * FROM payments ORDER BY created_at DESC, id DESC LIMIT 200").all() as Array<
    Record<string, unknown>
  >;
  res.json(rows.map(buildPaymentRow));
});

router.post("/admin/payments/connection/", requireStaff, (req: AuthedRequest, res: Response) => {
  const method = String(req.body?.method || "");
  if (!["pse", "card", "transfer", "wallet", "other"].includes(method)) {
    res.status(400).json({ detail: "Método de pago desconocido." });
    return;
  }
  const cfg = (loadPlatformSettings().sections?.payments || {}) as Record<string, unknown>;
  const enabled = cfg[`${method}_enabled`] !== false;
  addAuditLog(personName(req.user), `Prueba de conexión de pagos (${method}): ${enabled ? "correcta" : "deshabilitado"}`, "Pagos", "", req.user!.id);
  res.json({ ok: enabled, method, detail: enabled ? "Canal operativo en entorno local." : "Desactivado por el administrador." });
});

router.get("/admin/payments/health/", requireStaff, (_req: AuthedRequest, res: Response) => {
  const cfg = (loadPlatformSettings().sections?.payments || {}) as Record<string, unknown>;
  const methods: Record<string, unknown> = {};
  for (const m of ["pse", "card", "transfer", "wallet", "other"]) {
    const enabled = cfg[`${m}_enabled`] !== false;
    methods[m] = {
      status: enabled ? "ok" : "disabled",
      ok: true,
      detail: enabled ? "Operativo" : "Deshabilitado en configuración",
      enabled,
    };
  }
  res.json({
    checked_at: nowIso(),
    configured: true,
    mode: cfg.test_payment_enabled ? "test" : "local",
    merchant: "Serviprox Local SQLite",
    methods,
    alerts: [],
  });
});

router.get("/admin/payments/stats/", requireStaff, (req: AuthedRequest, res: Response) => {
  const days = Math.min(Math.max(Number(req.query.days || 30) || 30, 1), 365);
  const includeTest = req.query.include_test === "1" || req.query.include_test === "true";
  const cutoff = new Date(Date.now() - days * 86400 * 1000).toISOString();
  const rows = db.prepare("SELECT * FROM payments WHERE created_at >= ?").all(cutoff) as Array<
    Record<string, unknown>
  >;
  const groups: Record<string, string> = {
    CARD: "card",
    DEV_CREDIT: "card",
    DEV_DEBIT: "card",
    PSE: "pse",
    BANCOLOMBIA_TRANSFER: "transfer",
    DEV_TRANSFER: "transfer",
    NEQUI: "wallet",
    DAVIPLATA: "wallet",
  };
  const stats: Record<string, Record<string, unknown>> = {};
  for (const p of rows) {
    const code = String(p.payment_method || "").toUpperCase();
    if (!includeTest && (p.test_mode || code.startsWith("DEV"))) continue;
    const key = groups[code] || "other";
    if (!stats[key]) {
      stats[key] = { method: key, total: 0, approved: 0, declined: 0, pending: 0, approved_amount: 0 };
    }
    const s = stats[key];
    s.total = Number(s.total) + 1;
    if (p.status === "approved") {
      s.approved = Number(s.approved) + 1;
      s.approved_amount = moneyNum(Number(s.approved_amount) + Number(p.amount_in_cents || 0) / 100);
    } else if (["declined", "error", "voided"].includes(String(p.status))) {
      s.declined = Number(s.declined) + 1;
    } else if (p.status === "pending") {
      s.pending = Number(s.pending) + 1;
    }
  }
  for (const s of Object.values(stats)) {
    const finished = Number(s.approved) + Number(s.declined);
    s.approval_rate = finished ? Math.round((Number(s.approved) / finished) * 1000) / 10 : null;
  }
  res.json({ days, include_test: includeTest, methods: stats });
});

router.get("/admin/payments/:id/", requireStaff, (req: AuthedRequest, res: Response) => {
  const p = db.prepare("SELECT * FROM payments WHERE id = ?").get(Number(req.params.id)) as
    | Record<string, unknown>
    | undefined;
  if (!p) {
    res.status(404).json({ detail: "Pago no encontrado." });
    return;
  }
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(p.order_id)) as Record<string, unknown>;
  const prof = db
    .prepare("SELECT user_id FROM professional_profiles WHERE id = ?")
    .get(Number(order.professional_id)) as { user_id: number } | undefined;
  const profUser = prof?.user_id ? findUserById(prof.user_id) : undefined;
  const row = buildClientReceiptRow(p);
  res.json({
    ...row,
    test_mode: Boolean(p.test_mode),
    created_at: String(p.created_at),
    updated_at: String(p.updated_at),
    order_status: String(order.status),
    payment_status: String(order.payment_status),
    commission_rate: order.commission_rate !== null ? moneyNum(order.commission_rate) : null,
    commission_amount: order.commission_amount !== null ? moneyNum(order.commission_amount) : null,
    professional_amount: order.professional_amount !== null ? moneyNum(order.professional_amount) : null,
    payout_status: String(order.payout_status),
    payout_status_label: PAYOUT_STATUS_LABELS[String(order.payout_status)] || String(order.payout_status),
    professional_email: profUser?.email || "",
  });
});

router.post("/admin/payments/:id/verify/", requireStaff, (req: AuthedRequest, res: Response) => {
  const p = db.prepare("SELECT * FROM payments WHERE id = ?").get(Number(req.params.id)) as
    | Record<string, unknown>
    | undefined;
  if (!p) {
    res.status(404).json({ detail: "Pago no encontrado." });
    return;
  }
  if (p.status === "approved" || p.status === "refunded") {
    res.status(400).json({ detail: "El pago ya está confirmado." });
    return;
  }
  if (String(p.reference || "").startsWith("DEV-")) {
    res.status(400).json({ detail: "Este pago no se puede verificar con la pasarela." });
    return;
  }
  const ts = nowIso();
  db.prepare("UPDATE payments SET status = 'approved', updated_at = ? WHERE id = ?").run(ts, Number(p.id));
  db.prepare(
    "UPDATE orders SET payment_status = 'paid', payment_confirmed_at = ?, payment_reference = ?, updated_at = ? WHERE id = ?"
  ).run(ts, String(p.reference), ts, Number(p.order_id));
  registerSplit(
    Number(p.order_id),
    Number(p.amount_in_cents || 0) / 100 + moneyNum(p.discount_amount),
    moneyNum(p.discount_amount)
  );
  autoSettleCompletedPaidOrders(Number(p.order_id));
  res.json({ detail: "Estado verificado: Aprobado." });
});

router.get("/admin/finance/summary/", requireStaff, (_req: AuthedRequest, res: Response) => {
  res.json({
    ...platformSummary(),
    series: monthlySeries(6),
  });
});

router.get("/admin/finance/report/", requireStaff, (req: AuthedRequest, res: Response) => {
  backfillSplits();
  const fromStr = req.query.from ? String(req.query.from) : "";
  const toStr = req.query.to ? String(req.query.to) : "";
  if ((fromStr && !/^\d{4}-\d{2}-\d{2}$/.test(fromStr)) || (toStr && !/^\d{4}-\d{2}-\d{2}$/.test(toStr))) {
    res.status(400).json({ detail: "Fechas inválidas (use AAAA-MM-DD)." });
    return;
  }
  let orders = db
    .prepare(
      "SELECT * FROM orders WHERE payment_status IN ('paid', 'refunded') ORDER BY payment_confirmed_at ASC, id ASC"
    )
    .all() as Array<Record<string, unknown>>;
  if (fromStr) {
    orders = orders.filter((o) => String(o.payment_confirmed_at || "").slice(0, 10) >= fromStr);
  }
  if (toStr) {
    orders = orders.filter((o) => String(o.payment_confirmed_at || "").slice(0, 10) <= toStr);
  }
  const rows = orders.filter((o) => o.commission_rate !== null && o.commission_rate !== "").map(buildPayoutRow);
  const active = rows.filter((r) => r.payout_status !== "refunded");
  const totals = {
    orders: active.length,
    gross: moneyNum(active.reduce((s, r) => s + r.gross, 0)),
    commissions: moneyNum(active.reduce((s, r) => s + r.commission, 0)),
    professionals: moneyNum(active.reduce((s, r) => s + r.net, 0)),
  };
  if (req.query.export !== "csv") {
    res.json({ totals, rows });
    return;
  }
  const csvSafe = (val: unknown) => {
    const s = String(val ?? "");
    const guarded = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${guarded.replace(/"/g, '""')}"`;
  };
  const header = [
    "Orden",
    "Fecha de pago",
    "Cliente",
    "Profesional",
    "Servicio",
    "Bruto",
    "Comisión %",
    "Comisión Serviprox",
    "Neto profesional",
    "Estado de orden",
    "Estado de liquidación",
  ];
  const lines = [
    header.map(csvSafe).join(","),
    ...rows.map((r) =>
      [
        r.order_id,
        r.date || "",
        r.client,
        r.professional,
        r.service,
        r.gross,
        r.commission_rate,
        r.commission,
        r.net,
        r.order_status_label,
        r.payout_status_label,
      ]
        .map(csvSafe)
        .join(",")
    ),
  ];
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="reporte-financiero-serviprox.csv"');
  res.send("\ufeff" + lines.join("\n"));
});

router.get("/admin/payouts/", requireStaff, (_req: AuthedRequest, res: Response) => {
  backfillSplits();
  const rows = db
    .prepare(
      "SELECT * FROM orders WHERE payment_status IN ('paid', 'refunded') AND commission_rate IS NOT NULL AND commission_rate != '' ORDER BY payment_confirmed_at DESC LIMIT 200"
    )
    .all() as Array<Record<string, unknown>>;
  res.json(rows.map(buildPayoutRow));
});

router.post("/admin/payouts/settle/", requireStaff, (req: AuthedRequest, res: Response) => {
  backfillSplits();
  const orderIds = req.body?.order_ids;
  const ts = nowIso();
  if (orderIds !== undefined) {
    if (!Array.isArray(orderIds) || !orderIds.every((i) => Number.isInteger(i))) {
      res.status(400).json({ detail: "Lista de órdenes inválida." });
      return;
    }
    if (orderIds.length === 0) {
      res.json({ settled: 0, detail: "0 orden(es) liquidada(s)." });
      return;
    }
    const placeholders = orderIds.map(() => "?").join(",");
    const info = db
      .prepare(
        `UPDATE orders SET payout_status = 'settled', payout_settled_at = ?, updated_at = ?
         WHERE payment_status = 'paid' AND status = 'completed' AND payout_status = 'pending' AND id IN (${placeholders})`
      )
      .run(ts, ts, ...orderIds);
    res.json({ settled: Number(info.changes), detail: `${info.changes} orden(es) liquidada(s).` });
    return;
  }
  if (req.body?.all !== true) {
    res.status(400).json({ detail: "Indica las órdenes a liquidar." });
    return;
  }
  const info = db
    .prepare(
      "UPDATE orders SET payout_status = 'settled', payout_settled_at = ?, updated_at = ? WHERE payment_status = 'paid' AND status = 'completed' AND payout_status = 'pending'"
    )
    .run(ts, ts);
  res.json({ settled: Number(info.changes), detail: `${info.changes} orden(es) liquidada(s).` });
});

router.get("/admin/withdrawals/", requireStaff, (_req: AuthedRequest, res: Response) => {
  const rows = db.prepare("SELECT * FROM withdrawals ORDER BY created_at DESC LIMIT 200").all() as Array<
    Record<string, unknown>
  >;
  res.json(rows.map(buildWithdrawalRow));
});

router.post("/admin/withdrawals/:id/resolve/", requireStaff, (req: AuthedRequest, res: Response) => {
  const id = Number(req.params.id);
  const w = db.prepare("SELECT * FROM withdrawals WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!w) {
    res.status(404).json({ detail: "Solicitud no encontrada." });
    return;
  }
  if (!["pending", "approved"].includes(String(w.status))) {
    res.status(400).json({ detail: "Esta solicitud ya fue resuelta." });
    return;
  }
  const action = String(req.body?.action || "");
  const reference = String(req.body?.reference || "").trim();
  const note = String(req.body?.note || "").trim();
  let nextStatus = String(w.status);
  let transferRef = String(w.transfer_reference || "");

  if (action === "approve") {
    if (w.status !== "pending") {
      res.status(400).json({ detail: "La solicitud ya está aprobada." });
      return;
    }
    nextStatus = "approved";
  } else if (action === "reject") {
    if (!note) {
      res.status(400).json({ detail: "Indica el motivo del rechazo." });
      return;
    }
    nextStatus = "rejected";
  } else if (action === "pay") {
    if (!reference) {
      res.status(400).json({ detail: "Indica la referencia de la transferencia." });
      return;
    }
    nextStatus = "paid";
    transferRef = reference.slice(0, 80);
  } else {
    res.status(400).json({ detail: "Acción desconocida." });
    return;
  }

  db.prepare(
    "UPDATE withdrawals SET status = ?, transfer_reference = ?, note = ?, resolved_by_id = ?, resolved_at = ? WHERE id = ?"
  ).run(nextStatus, transferRef, note.slice(0, 240), req.user!.id, nowIso(), id);
  const updated = db.prepare("SELECT * FROM withdrawals WHERE id = ?").get(id) as Record<string, unknown>;

  const profRow = db
    .prepare("SELECT user_id FROM professional_profiles WHERE id = ?")
    .get(Number(w.professional_id)) as { user_id: number } | undefined;
  if (profRow?.user_id) {
    const amtText = Math.round(moneyNum(w.amount)).toLocaleString("es-CO");
    const destText = String(w.destination || "");
    if (nextStatus === "approved") {
      addNotification({
        userId: Number(profRow.user_id),
        type: "withdrawal",
        title: `Retiro aprobado ($${amtText} COP)`,
        text: `Tu solicitud de retiro hacia ${destText} fue aprobada y está en proceso de transferencia.`,
        link: "/profesional/ingresos",
        targetId: String(id),
      });
    } else if (nextStatus === "paid") {
      addNotification({
        userId: Number(profRow.user_id),
        type: "withdrawal",
        title: `Transferencia completada ($${amtText} COP)`,
        text: `Tu retiro hacia ${destText} fue transferido. Referencia: ${transferRef}.`,
        link: "/profesional/ingresos",
        targetId: String(id),
      });
    } else if (nextStatus === "rejected") {
      addNotification({
        userId: Number(profRow.user_id),
        type: "withdrawal",
        title: `Retiro rechazado ($${amtText} COP)`,
        text: `Tu solicitud fue rechazada (${note.slice(0, 140)}). El saldo volvió a quedar disponible.`,
        link: "/profesional/ingresos",
        targetId: String(id),
      });
    }
  }

  res.json(buildWithdrawalRow(updated));
});

router.get("/admin/refunds/", requireStaff, (_req: AuthedRequest, res: Response) => {
  const rows = db.prepare("SELECT * FROM refunds ORDER BY created_at DESC LIMIT 200").all() as Array<
    Record<string, unknown>
  >;
  res.json(rows.map(buildRefundRow));
});

router.post("/admin/refunds/", requireStaff, (req: AuthedRequest, res: Response) => {
  const orderId = Number(req.body?.order_id || 0);
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as Record<string, unknown> | undefined;
  if (!order) {
    res.status(404).json({ detail: "Orden no encontrada." });
    return;
  }
  const reason = String(req.body?.reason || "").trim();
  if (reason.length < 5) {
    res.status(400).json({ detail: "Indica el motivo del reembolso." });
    return;
  }
  if (order.payment_status !== "paid") {
    res.status(400).json({ detail: "Solo se pueden reembolsar órdenes pagadas." });
    return;
  }
  if (db.prepare("SELECT id FROM refunds WHERE order_id = ? AND status = 'requested'").get(orderId)) {
    res.status(400).json({ detail: "Ya hay un reembolso en revisión para esta orden." });
    return;
  }
  const payment = db
    .prepare("SELECT id, amount_in_cents FROM payments WHERE order_id = ? AND status = 'approved' LIMIT 1")
    .get(orderId) as { id: number; amount_in_cents: number } | undefined;
  const amount = payment ? moneyNum(payment.amount_in_cents / 100) : orderPrice(order);
  const ins = db
    .prepare(
      "INSERT INTO refunds (order_id, payment_id, amount, reason, status, note, requested_by_id, created_at) VALUES (?, ?, ?, ?, 'requested', '', ?, ?)"
    )
    .run(orderId, payment?.id ?? null, amount.toFixed(2), reason.slice(0, 240), req.user!.id, nowIso());
  const created = db.prepare("SELECT * FROM refunds WHERE id = ?").get(ins.lastInsertRowid) as Record<string, unknown>;
  res.status(201).json(buildRefundRow(created));
});

router.post("/admin/refunds/:id/resolve/", requireStaff, (req: AuthedRequest, res: Response) => {
  const id = Number(req.params.id);
  const r = db.prepare("SELECT * FROM refunds WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!r) {
    res.status(404).json({ detail: "Reembolso no encontrado." });
    return;
  }
  if (r.status !== "requested") {
    res.status(400).json({ detail: "Este reembolso ya fue resuelto." });
    return;
  }
  const action = String(req.body?.action || "");
  const note = String(req.body?.note || "").trim();
  const ts = nowIso();
  if (action === "reject") {
    if (!note) {
      res.status(400).json({ detail: "Indica el motivo del rechazo." });
      return;
    }
    db.prepare(
      "UPDATE refunds SET status = 'rejected', note = ?, resolved_by_id = ?, resolved_at = ? WHERE id = ?"
    ).run(note.slice(0, 240), req.user!.id, ts, id);
  } else if (action === "approve") {
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(Number(r.order_id)) as Record<string, unknown>;
    if (order.payment_status !== "paid") {
      res.status(400).json({ detail: "La orden ya no está pagada." });
      return;
    }
    if (order.payout_status === "settled") {
      const bal = professionalBalance(Number(order.professional_id));
      if (bal.available_balance < moneyNum(order.professional_amount)) {
        res.status(400).json({
          detail: "El profesional ya retiró este valor; no se puede reembolsar automáticamente.",
        });
        return;
      }
    }
    db.prepare(
      "UPDATE orders SET payment_status = 'refunded', payout_status = 'refunded', updated_at = ? WHERE id = ?"
    ).run(ts, Number(order.id));
    if (r.payment_id) {
      db.prepare("UPDATE payments SET status = 'refunded', updated_at = ? WHERE id = ?").run(ts, Number(r.payment_id));
    }
    db.prepare(
      "UPDATE refunds SET status = 'approved', note = ?, resolved_by_id = ?, resolved_at = ? WHERE id = ?"
    ).run(note.slice(0, 240), req.user!.id, ts, id);
  } else {
    res.status(400).json({ detail: "Acción desconocida." });
    return;
  }
  const updated = db.prepare("SELECT * FROM refunds WHERE id = ?").get(id) as Record<string, unknown>;
  res.json(buildRefundRow(updated));
});

// ── Admin Hirings (Specific routes before :id!) ──────────────────────────────

const HIRING_ACTIVE = new Set([
  "requested",
  "accepted",
  "scheduled",
  "traveling",
  "arrived",
  "in_progress",
  "break",
  "lunch",
  "other_service",
]);

function computeHiringAlerts(o: Record<string, unknown>, nowMs: number): string[] {
  const alerts: string[] = [];
  const updatedMs = new Date(String(o.updated_at)).getTime();
  if (HIRING_ACTIVE.has(String(o.status)) && updatedMs < nowMs - 48 * 3600 * 1000) {
    alerts.push("stalled");
  }
  if (
    ["accepted", "scheduled", "traveling"].includes(String(o.status)) &&
    o.scheduled_for &&
    new Date(String(o.scheduled_for)).getTime() < nowMs - 12 * 3600 * 1000
  ) {
    alerts.push("overdue_visit");
  }
  if (o.status === "completed" && o.payment_status === "pending" && updatedMs < nowMs - 24 * 3600 * 1000) {
    alerts.push("unpaid");
  }
  const hasReview = Boolean(db.prepare("SELECT 1 FROM reviews WHERE order_id = ?").get(Number(o.id)));
  if (o.status === "completed" && !hasReview && updatedMs < nowMs - 7 * 86400 * 1000) {
    alerts.push("no_review");
  }
  return alerts;
}

function buildHiringRow(o: Record<string, unknown>, nowMs: number) {
  const sr = db.prepare("SELECT * FROM service_requests WHERE id = ?").get(Number(o.service_request_id)) as Record<
    string,
    unknown
  >;
  const hh = sr
    ? (db.prepare("SELECT * FROM households WHERE id = ?").get(Number(sr.household_id)) as
        | Record<string, unknown>
        | undefined)
    : undefined;
  const cat = sr
    ? (db.prepare("SELECT name FROM service_categories WHERE id = ?").get(Number(sr.selected_category_id)) as
        | { name: string }
        | undefined)
    : undefined;
  const client = findUserById(Number(o.client_id));
  const prof = db
    .prepare("SELECT id, display_name FROM professional_profiles WHERE id = ?")
    .get(Number(o.professional_id)) as { id: number; display_name: string } | undefined;
  const rev = db.prepare("SELECT rating FROM reviews WHERE order_id = ?").get(Number(o.id)) as
    | { rating: number }
    | undefined;

  return {
    id: Number(o.id),
    request_id: Number(o.service_request_id),
    created_at: String(o.created_at),
    status: String(o.status),
    status_label: ORDER_STATUS_LABELS[String(o.status)] || String(o.status),
    service: serviceLabelForOrder(Number(o.id), sr),
    category: cat?.name || "—",
    client: {
      id: Number(o.client_id),
      name: personName(client),
      email: client?.email || "",
      phone: client?.phone || "",
    },
    professional: {
      id: Number(o.professional_id),
      name: prof?.display_name || "—",
    },
    city: String(hh?.city || ""),
    neighborhood: String(hh?.neighborhood || ""),
    final_price: o.final_price !== null && o.final_price !== undefined ? Number(o.final_price) : null,
    payment_status: String(o.payment_status),
    payment_status_label: PAYMENT_STATUS_LABELS[String(o.payment_status)] || String(o.payment_status),
    payout_status: String(o.payout_status),
    payout_status_label: PAYOUT_STATUS_LABELS[String(o.payout_status)] || String(o.payout_status),
    scheduled_for: o.scheduled_for ? String(o.scheduled_for) : null,
    rating: rev?.rating ?? null,
    alerts: computeHiringAlerts(o, nowMs),
  };
}

router.get("/admin/hirings/summary/", requireStaff, (_req: AuthedRequest, res: Response) => {
  const nowMs = Date.now();
  const orders = db.prepare("SELECT * FROM orders").all() as Array<Record<string, unknown>>;
  const byStatus: Record<string, number> = {};
  let active = 0;
  let valueTotal = 0;
  let billableCount = 0;
  const topServiceCounts = new Map<string, number>();
  const topProMap = new Map<number, { id: number; name: string; count: number; ratings: number[] }>();

  for (const o of orders) {
    const st = String(o.status);
    byStatus[st] = (byStatus[st] || 0) + 1;
    if (HIRING_ACTIVE.has(st)) active += 1;
    if (st !== "cancelled" && o.final_price !== null && o.final_price !== undefined) {
      valueTotal += Number(o.final_price);
      billableCount += 1;
    }
    const srvLabel = serviceLabelForOrder(Number(o.id));
    topServiceCounts.set(srvLabel, (topServiceCounts.get(srvLabel) || 0) + 1);

    const pid = Number(o.professional_id);
    const prof = db.prepare("SELECT display_name FROM professional_profiles WHERE id = ?").get(pid) as
      | { display_name: string }
      | undefined;
    const rev = db.prepare("SELECT rating FROM reviews WHERE order_id = ?").get(Number(o.id)) as
      | { rating: number }
      | undefined;
    const entry = topProMap.get(pid) || { id: pid, name: prof?.display_name || "—", count: 0, ratings: [] };
    entry.count += 1;
    if (rev?.rating) entry.ratings.push(rev.rating);
    topProMap.set(pid, entry);
  }

  const daily: Array<{ date: string; count: number }> = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(nowMs - i * 86400 * 1000).toISOString().slice(0, 10);
    daily.push({
      date: d,
      count: orders.filter((o) => String(o.created_at).slice(0, 10) === d).length,
    });
  }

  const monthly = monthlySeries(6).map((m) => ({
    month: m.month,
    count: orders.filter((o) => String(o.created_at).slice(0, 7) === m.month).length,
  }));

  const alertCounts: Record<string, number> = { stalled: 0, overdue_visit: 0, unpaid: 0, no_review: 0 };
  for (const o of orders) {
    for (const flag of computeHiringAlerts(o, nowMs)) {
      alertCounts[flag] = (alertCounts[flag] || 0) + 1;
    }
  }
  const alertLabels: Record<string, string> = {
    stalled: "Sin movimiento hace más de 48 horas",
    overdue_visit: "Visita agendada vencida",
    unpaid: "Terminadas sin pago hace más de 24 horas",
    no_review: "Terminadas sin calificación hace más de 7 días",
  };
  const alerts = Object.entries(alertCounts)
    .filter(([, cnt]) => cnt > 0)
    .map(([key, count]) => ({ key, label: alertLabels[key], count }));

  const openReqs = db
    .prepare(
      "SELECT * FROM service_requests sr WHERE sr.status = 'open' AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.service_request_id = sr.id)"
    )
    .all() as Array<Record<string, unknown>>;
  const noProf = openReqs.filter((r) => !r.professional_id).length;
  const awaiting = openReqs.filter((r) => Boolean(r.professional_id));
  const staleAwaiting = awaiting.filter(
    (r) => new Date(String(r.created_at)).getTime() < nowMs - 24 * 3600 * 1000
  ).length;

  res.json({
    total: orders.length,
    by_status: byStatus,
    active,
    completed: byStatus.completed || 0,
    cancelled: byStatus.cancelled || 0,
    value_total: moneyNum(valueTotal),
    avg_ticket: billableCount ? moneyNum(valueTotal / billableCount) : 0,
    daily,
    monthly,
    top_services: Array.from(topServiceCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    top_professionals: Array.from(topProMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        name: p.name,
        count: p.count,
        rating: p.ratings.length
          ? Math.round((p.ratings.reduce((a, b) => a + b, 0) / p.ratings.length) * 100) / 100
          : null,
      })),
    alerts,
    requests: {
      no_professional: noProf,
      awaiting: awaiting.length,
      awaiting_stale: staleAwaiting,
    },
    generated_at: nowIso(),
  });
});

router.get("/admin/hirings/", requireStaff, (req: AuthedRequest, res: Response) => {
  const nowMs = Date.now();
  const orders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC, id DESC").all() as Array<
    Record<string, unknown>
  >;
  let rows = orders.map((o) => buildHiringRow(o, nowMs));

  const qStatus = req.query.status ? String(req.query.status) : "";
  const qPay = req.query.payment ? String(req.query.payment) : "";
  const qCity = req.query.city ? String(req.query.city).toLowerCase() : "";
  const qPro = req.query.professional ? String(req.query.professional) : "";
  const qFrom = req.query.date_from ? String(req.query.date_from) : "";
  const qTo = req.query.date_to ? String(req.query.date_to) : "";
  const qAlert = req.query.alert ? String(req.query.alert) : "";
  const qSearch = req.query.q ? String(req.query.q).trim().toLowerCase() : "";
  const ordering = String(req.query.ordering || "-created_at");

  if (qStatus) rows = rows.filter((r) => r.status === qStatus);
  if (["paid", "pending", "refunded"].includes(qPay)) rows = rows.filter((r) => r.payment_status === qPay);
  if (qCity) rows = rows.filter((r) => r.city.toLowerCase().includes(qCity));
  if (/^\d+$/.test(qPro)) rows = rows.filter((r) => r.professional.id === Number(qPro));
  if (qFrom) rows = rows.filter((r) => r.created_at.slice(0, 10) >= qFrom);
  if (qTo) rows = rows.filter((r) => r.created_at.slice(0, 10) <= qTo);
  if (qAlert) rows = rows.filter((r) => r.alerts.includes(qAlert));
  if (qSearch) {
    const cleanNum = qSearch.replace(/^#/, "");
    rows = rows.filter(
      (r) =>
        r.client.email.toLowerCase().includes(qSearch) ||
        r.client.name.toLowerCase().includes(qSearch) ||
        r.professional.name.toLowerCase().includes(qSearch) ||
        r.service.toLowerCase().includes(qSearch) ||
        r.category.toLowerCase().includes(qSearch) ||
        r.neighborhood.toLowerCase().includes(qSearch) ||
        (/^\d+$/.test(cleanNum) && r.id === Number(cleanNum))
    );
  }

  if (ordering === "created_at") rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
  else if (ordering === "final_price") rows.sort((a, b) => (a.final_price || 0) - (b.final_price || 0));
  else if (ordering === "-final_price") rows.sort((a, b) => (b.final_price || 0) - (a.final_price || 0));

  const page = Math.max(1, Number.parseInt(String(req.query.page || "1"), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(req.query.page_size || "15"), 10) || 15));
  const start = (page - 1) * pageSize;
  res.json({
    count: rows.length,
    page,
    page_size: pageSize,
    results: rows.slice(start, start + pageSize),
  });
});

router.get("/admin/hirings/requests/", requireStaff, (req: AuthedRequest, res: Response) => {
  const nowMs = Date.now();
  let rows = db
    .prepare(
      `SELECT * FROM service_requests sr
       WHERE sr.status = 'open' AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.service_request_id = sr.id)
       ORDER BY sr.created_at ASC`
    )
    .all() as Array<Record<string, unknown>>;

  const kind = req.query.kind ? String(req.query.kind) : "";
  if (kind === "no_professional") rows = rows.filter((r) => !r.professional_id);
  if (kind === "awaiting") rows = rows.filter((r) => Boolean(r.professional_id));

  const page = Math.max(1, Number.parseInt(String(req.query.page || "1"), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(req.query.page_size || "15"), 10) || 15));
  const start = (page - 1) * pageSize;

  const mapped = rows.slice(start, start + pageSize).map((r) => {
    const client = findUserById(Number(r.client_id));
    const hh = db.prepare("SELECT city, neighborhood FROM households WHERE id = ?").get(Number(r.household_id)) as
      | { city: string; neighborhood: string }
      | undefined;
    const cat = db
      .prepare("SELECT name FROM service_categories WHERE id = ?")
      .get(Number(r.selected_category_id)) as { name: string } | undefined;
    const srv = r.selected_service_id
      ? (db.prepare("SELECT name FROM services WHERE id = ?").get(Number(r.selected_service_id)) as
          | { name: string }
          | undefined)
      : undefined;
    const prof = r.professional_id
      ? (db.prepare("SELECT id, display_name FROM professional_profiles WHERE id = ?").get(Number(r.professional_id)) as
          | { id: number; display_name: string }
          | undefined)
      : undefined;
    const hrs = Math.max(0, Math.floor((nowMs - new Date(String(r.created_at)).getTime()) / 3600000));
    return {
      id: Number(r.id),
      created_at: String(r.created_at),
      hours_waiting: hrs,
      client: { name: personName(client), email: client?.email || "", phone: client?.phone || "" },
      service: srv?.name || cat?.name || "—",
      category: cat?.name || "—",
      city: hh?.city || "",
      neighborhood: hh?.neighborhood || "",
      urgency: String(r.urgency || "this_week"),
      urgency_label: URGENCY_LABELS[String(r.urgency || "this_week")] || String(r.urgency),
      description: String(r.description || ""),
      professional: prof ? { id: prof.id, name: prof.display_name } : null,
    };
  });

  res.json({ count: rows.length, page, page_size: pageSize, results: mapped });
});

router.get(
  "/admin/hirings/requests/:requestId/professionals/",
  requireStaff,
  (req: AuthedRequest, res: Response) => {
    const reqId = Number(req.params.requestId);
    const sr = db
      .prepare(
        "SELECT * FROM service_requests WHERE id = ? AND status = 'open' AND NOT EXISTS (SELECT 1 FROM orders WHERE service_request_id = ?)"
      )
      .get(reqId, reqId) as Record<string, unknown> | undefined;
    if (!sr) {
      res.status(404).json({ detail: "Solicitud no encontrada o ya contratada." });
      return;
    }
    const hh = db.prepare("SELECT latitude, longitude FROM households WHERE id = ?").get(Number(sr.household_id)) as
      | { latitude: number | null; longitude: number | null }
      | undefined;

    const profiles = sr.selected_service_id
      ? (db
          .prepare(
            `SELECT DISTINCT pp.*
             FROM professional_profiles pp
             JOIN professional_services ps ON ps.profile_id = pp.id
             JOIN services s ON s.id = ps.service_id
             JOIN service_categories c ON c.id = s.category_id
             WHERE pp.is_active = 1 AND ps.service_id = ? AND s.is_active = 1 AND c.is_active = 1 AND pp.user_id != ?`
          )
          .all(Number(sr.selected_service_id), Number(sr.client_id)) as Array<Record<string, unknown>>)
      : (db
          .prepare("SELECT * FROM professional_profiles WHERE is_active = 1 AND user_id != ?")
          .all(Number(sr.client_id)) as Array<Record<string, unknown>>);

    const results = profiles
      .map((p) => ({
        id: Number(p.id),
        name: String(p.display_name),
        rating: Number(p.rating_avg || 0),
        jobs_completed: Number(p.jobs_completed || 0),
        verified: Boolean(p.is_verified),
        city: String(p.city || ""),
        distance_km: haversineKm(
          hh?.latitude ?? null,
          hh?.longitude ?? null,
          p.latitude !== null ? Number(p.latitude) : null,
          p.longitude !== null ? Number(p.longitude) : null
        ),
        current: Number(p.id) === Number(sr.professional_id),
      }))
      .sort((a, b) => {
        if ((a.distance_km === null) !== (b.distance_km === null)) return a.distance_km === null ? 1 : -1;
        if ((a.distance_km ?? 0) !== (b.distance_km ?? 0)) return (a.distance_km ?? 0) - (b.distance_km ?? 0);
        return b.rating - a.rating;
      })
      .slice(0, 30);

    res.json(results);
  }
);

router.post("/admin/hirings/requests/:requestId/assign/", requireStaff, (req: AuthedRequest, res: Response) => {
  const reqId = Number(req.params.requestId);
  const sr = db
    .prepare(
      "SELECT * FROM service_requests WHERE id = ? AND status = 'open' AND NOT EXISTS (SELECT 1 FROM orders WHERE service_request_id = ?)"
    )
    .get(reqId, reqId) as Record<string, unknown> | undefined;
  if (!sr) {
    res.status(404).json({ detail: "Solicitud no encontrada o ya contratada." });
    return;
  }
  const profId = Number(req.body?.professional_id || 0);
  const prof = profId
    ? (db.prepare("SELECT * FROM professional_profiles WHERE id = ? AND is_active = 1").get(profId) as
        | Record<string, unknown>
        | undefined)
    : undefined;
  if (!prof) {
    res.status(400).json({ detail: "Profesional no encontrado o inactivo." });
    return;
  }
  if (Number(prof.user_id) === Number(sr.client_id)) {
    res.status(400).json({ detail: "El cliente no puede ser el profesional de su propia solicitud." });
    return;
  }
  if (sr.selected_service_id && !professionalOffersService(profId, Number(sr.selected_service_id))) {
    res.status(400).json({ detail: "Ese profesional no ofrece este servicio." });
    return;
  }
  const prevProf = sr.professional_id
    ? (db.prepare("SELECT display_name FROM professional_profiles WHERE id = ?").get(Number(sr.professional_id)) as
        | { display_name: string }
        | undefined)
    : undefined;
  const previous = prevProf?.display_name || "sin profesional";

  const ts = nowIso();
  db.prepare("UPDATE service_requests SET professional_id = ?, updated_at = ? WHERE id = ?").run(profId, ts, reqId);
  const hh = db.prepare("SELECT latitude, longitude FROM households WHERE id = ?").get(Number(sr.household_id)) as
    | { latitude: number | null; longitude: number | null }
    | undefined;
  const dist =
    haversineKm(
      hh?.latitude ?? null,
      hh?.longitude ?? null,
      prof.latitude !== null ? Number(prof.latitude) : null,
      prof.longitude !== null ? Number(prof.longitude) : null
    ) || 0;
  const existingCand = db
    .prepare("SELECT id FROM request_candidates WHERE request_id = ? AND professional_id = ?")
    .get(reqId, profId) as { id: number } | undefined;
  if (existingCand) {
    db.prepare("UPDATE request_candidates SET distance_km = ?, status = 'contacted' WHERE id = ?").run(
      dist,
      existingCand.id
    );
  } else {
    db.prepare(
      "INSERT INTO request_candidates (request_id, professional_id, distance_km, status, created_at) VALUES (?, ?, ?, 'contacted', ?)"
    ).run(reqId, profId, dist, ts);
  }
  if (prof.user_id) {
    addNotification({
      userId: Number(prof.user_id),
      title: "Nueva solicitud asignada",
      text: `Serviprox te asignó la solicitud #${reqId}. Revísala y respóndela.`,
      type: "sistema",
      link: `/profesional/solicitudes/${reqId}`,
      targetId: String(reqId),
    });
  }
  addAuditLog(
    personName(req.user),
    "Solicitud asignada a un profesional",
    `Solicitud #${reqId}`,
    `${previous} → ${prof.display_name}`,
    req.user!.id
  );
  res.json({ detail: `Solicitud asignada a ${prof.display_name}.`, id: reqId });
});

router.get("/admin/hirings/:id/", requireStaff, (req: AuthedRequest, res: Response) => {
  const id = Number(req.params.id);
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!order) {
    res.status(404).json({ detail: "Contratación no encontrada." });
    return;
  }
  const nowMs = Date.now();
  const base = buildHiringRow(order, nowMs);
  const sr = db.prepare("SELECT * FROM service_requests WHERE id = ?").get(Number(order.service_request_id)) as Record<
    string,
    unknown
  >;
  const hh = db.prepare("SELECT * FROM households WHERE id = ?").get(Number(sr.household_id)) as Record<
    string,
    unknown
  >;
  const prof = db
    .prepare("SELECT * FROM professional_profiles WHERE id = ?")
    .get(Number(order.professional_id)) as Record<string, unknown>;
  const profUser = prof?.user_id ? findUserById(Number(prof.user_id)) : undefined;
  const rev = db.prepare("SELECT * FROM reviews WHERE order_id = ?").get(id) as Record<string, unknown> | undefined;
  const events = db.prepare("SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at ASC, id ASC").all(id) as Array<
    Record<string, unknown>
  >;
  const evidence = db.prepare("SELECT * FROM work_evidence WHERE order_id = ? ORDER BY id ASC").all(id) as Array<
    Record<string, unknown>
  >;
  const payments = db.prepare("SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC, id DESC").all(id) as Array<
    Record<string, unknown>
  >;
  const notes = db.prepare("SELECT * FROM order_admin_notes WHERE order_id = ? ORDER BY created_at DESC, id DESC").all(id) as Array<
    Record<string, unknown>
  >;

  const isAct = HIRING_ACTIVE.has(String(order.status));
  res.json({
    ...base,
    description: String(sr.description || ""),
    client_notes: String(order.client_notes || ""),
    urgency: URGENCY_LABELS[String(sr.urgency || "this_week")] || String(sr.urgency),
    address: [hh?.address_line, hh?.neighborhood, hh?.city].filter(Boolean).join(", "),
    estimate_min: order.estimate_min !== null ? Number(order.estimate_min) : null,
    estimate_max: order.estimate_max !== null ? Number(order.estimate_max) : null,
    payment_reference: String(order.payment_reference || ""),
    payment_confirmed_at: order.payment_confirmed_at ? String(order.payment_confirmed_at) : null,
    commission_amount: order.commission_amount !== null ? Number(order.commission_amount) : null,
    professional_amount: order.professional_amount !== null ? Number(order.professional_amount) : null,
    payout_settled_at: order.payout_settled_at ? String(order.payout_settled_at) : null,
    professional_detail: {
      email: profUser?.email || "",
      phone: profUser?.phone || "",
      rating: Number(prof?.rating_avg || 0),
      jobs_completed: Number(prof?.jobs_completed || 0),
      verified: Boolean(prof?.is_verified),
    },
    review: rev ? { rating: Number(rev.rating), comment: String(rev.comment || "") } : null,
    events: events.map((e) => {
      const byUser = e.created_by_id ? findUserById(Number(e.created_by_id)) : undefined;
      return {
        status: String(e.status),
        label: ORDER_STATUS_LABELS[String(e.status)] || String(e.status),
        note: String(e.note || ""),
        by: byUser ? personName(byUser) : "Sistema",
        created_at: String(e.created_at),
      };
    }),
    evidence: evidence.map((ev) => ({
      id: Number(ev.id),
      caption: String(ev.caption || ""),
      created_at: String(ev.created_at),
      url: `/api/v1/orders/${id}/evidence/${ev.id}/`,
    })),
    payments: payments.map((p) => ({
      id: Number(p.id),
      reference: String(p.reference),
      status: String(p.status),
      status_label: PAYMENT_ROW_STATUS_LABELS[String(p.status)] || String(p.status),
      amount: Number(p.amount_in_cents || 0) / 100,
      discount: moneyNum(p.discount_amount),
      method: methodLabel(String(p.payment_method || "")),
      created_at: String(p.created_at),
    })),
    notes: notes.map((n) => ({
      id: Number(n.id),
      text: String(n.text || ""),
      author: String(n.author_name || ""),
      created_at: String(n.created_at),
    })),
    can_cancel: isAct && order.payment_status === "pending",
    cancel_blocked_reason:
      isAct && order.payment_status !== "pending"
        ? "La orden tiene un pago confirmado: gestiona primero el reembolso en Pagos e ingresos."
        : "",
    can_settle: order.payment_status === "paid" && order.status === "completed" && order.payout_status === "pending",
  });
});

router.post("/admin/hirings/:id/cancel/", requireStaff, (req: AuthedRequest, res: Response) => {
  const id = Number(req.params.id);
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!order) {
    res.status(404).json({ detail: "Contratación no encontrada." });
    return;
  }
  const reason = String(req.body?.reason || "").trim();
  if (reason.length < 5) {
    res.status(400).json({ detail: "Indica el motivo de la cancelación (mínimo 5 caracteres)." });
    return;
  }
  if (order.payment_status !== "pending") {
    res.status(400).json({
      detail: "La orden tiene un pago confirmado: gestiona primero el reembolso en Pagos e ingresos.",
    });
    return;
  }
  const result = transitionOrder(id, "cancelled", req.user!, {
    note: `Cancelada por administración: ${reason}`.slice(0, 200),
  });
  if (!result.ok) {
    res.status(result.status).json(result.payload);
    return;
  }
  addAuditLog(personName(req.user), "Contratación cancelada", `Orden #${id}`, reason, req.user!.id);
  res.json({ detail: "Contratación cancelada.", id });
});

router.post("/admin/hirings/:id/notes/", requireStaff, (req: AuthedRequest, res: Response) => {
  const id = Number(req.params.id);
  const order = db.prepare("SELECT id FROM orders WHERE id = ?").get(id);
  if (!order) {
    res.status(404).json({ detail: "Contratación no encontrada." });
    return;
  }
  const text = String(req.body?.text || "").trim();
  if (text.length < 3) {
    res.status(400).json({ detail: "Escribe la nota (mínimo 3 caracteres)." });
    return;
  }
  const ts = nowIso();
  const authorName = personName(req.user);
  const ins = db
    .prepare("INSERT INTO order_admin_notes (order_id, author_id, author_name, text, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, req.user!.id, authorName, text.slice(0, 1000), ts);
  res.status(201).json({ id: Number(ins.lastInsertRowid), text: text.slice(0, 1000), author: authorName, created_at: ts });
});

router.post("/admin/hirings/:id/pqr/", requireStaff, (req: AuthedRequest, res: Response) => {
  const id = Number(req.params.id);
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!order) {
    res.status(404).json({ detail: "Contratación no encontrada." });
    return;
  }
  const kind = String(req.body?.type || "");
  if (!["queja", "reclamo", "peticion"].includes(kind)) {
    res.status(400).json({ detail: "Elige el tipo: queja, reclamo o petición." });
    return;
  }
  const description = String(req.body?.description || "").trim();
  if (description.length < 10) {
    res.status(400).json({ detail: "Describe el caso (mínimo 10 caracteres)." });
    return;
  }
  const prof = db
    .prepare("SELECT * FROM professional_profiles WHERE id = ?")
    .get(Number(order.professional_id)) as Record<string, unknown>;
  const client = findUserById(Number(order.client_id));
  const sr = db.prepare("SELECT * FROM service_requests WHERE id = ?").get(Number(order.service_request_id)) as Record<
    string,
    unknown
  >;
  const hh = db.prepare("SELECT address_line FROM households WHERE id = ?").get(Number(sr.household_id)) as
    | { address_line: string }
    | undefined;
  const year = new Date().getFullYear();
  let radicado = `PQR-ADM-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
  while (db.prepare("SELECT id FROM pqr_reports WHERE radicado_number = ?").get(radicado)) {
    radicado = `PQR-ADM-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
  }
  const ts = nowIso();
  const ins = db
    .prepare(
      `INSERT INTO pqr_reports (
        radicado_number, client_id, client_name, client_phone, client_email, client_document_id, client_address,
        contractor_id, contractor_id_ref, contractor_name, contractor_company, contractor_specialty, contractor_avatar,
        pqr_type, reason, status, priority, assigned_to, related_to, incident_date, description, desired_resolution,
        evidence_files, admin_resolution_notes, estimated_response_days, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, 'contratacion_admin', 'radicado', '', '', ?, ?, ?, '', '[]', '', 3, ?, ?)`
    )
    .run(
      radicado,
      client?.id ?? null,
      personName(client),
      client?.phone || "",
      client?.email || "",
      client?.document_id || "",
      hh?.address_line || "",
      Number(prof.id),
      String(prof.id),
      String(prof.display_name),
      String(prof.display_name),
      serviceLabelForOrder(id, sr),
      kind,
      `Contratación #${id}`,
      ts.slice(0, 10),
      description.slice(0, 2000),
      ts,
      ts
    );
  const pqrId = Number(ins.lastInsertRowid);
  db.prepare(
    "INSERT INTO pqr_messages (pqr_id, sender, sender_name, sender_role, text, timestamp) VALUES (?, 'system', 'Serviprox', 'Sistema', ?, ?)"
  ).run(pqrId, `Solicitud ${radicado} registrada desde administración.`, ts);
  addAuditLog(personName(req.user), "PQR abierto desde una contratación", `Orden #${id} → ${radicado}`, "", req.user!.id);
  res.status(201).json({ id: pqrId, radicado_number: radicado });
});

export default router;
