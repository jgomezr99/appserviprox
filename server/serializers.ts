import type { Request } from "express";
import { getInitials, isStaffUser, type DbUser } from "./auth.ts";
import { absoluteUrl, db, haversineKm, loadPlatformSettings, safeJsonParse } from "./db.ts";

export const ORDER_STATUS_LABELS: Record<string, string> = {
  requested: "Solicitada",
  accepted: "Aceptada",
  scheduled: "Agendada",
  traveling: "En camino",
  arrived: "En domicilio",
  in_progress: "En ejecucion",
  break: "Descanso",
  lunch: "Almuerzo",
  other_service: "En otro servicio",
  completed: "Completada",
  cancelled: "Cancelada",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  refunded: "Reembolsado",
};

export const PAYOUT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  settled: "Liquidado",
  refunded: "Reembolsado",
};

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  open: "Abierta",
  matched: "Con candidatos",
  accepted: "Aceptada",
  rejected: "Rechazada",
  closed: "Cerrada",
  cancelled: "Cancelada",
};

export const URGENCY_LABELS: Record<string, string> = {
  urgent: "Urgente hoy",
  this_week: "Esta semana",
  flexible: "Flexible",
};

export const WEEKDAY_LABELS: Record<number, string> = {
  0: "Lunes",
  1: "Martes",
  2: "Miercoles",
  3: "Jueves",
  4: "Viernes",
  5: "Sabado",
  6: "Domingo",
};

export const METHOD_LABELS: Record<string, string> = {
  CARD: "Tarjeta",
  PSE: "PSE",
  NEQUI: "Nequi",
  BANCOLOMBIA_TRANSFER: "Transferencia Bancolombia",
  BANCOLOMBIA_COLLECT: "Corresponsal Bancolombia",
  DEV: "Pago simulado",
  DEV_CREDIT: "Tarjeta de crédito (prueba)",
  DEV_DEBIT: "Tarjeta débito (prueba)",
  DEV_TRANSFER: "Transferencia bancaria (prueba)",
};

export const WITHDRAWAL_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  paid: "Pagado",
  rejected: "Rechazado",
};

export const REFUND_STATUS_LABELS: Record<string, string> = {
  requested: "Solicitado",
  approved: "Aprobado",
  rejected: "Rechazado",
};

export const PAYMENT_ROW_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  declined: "Rechazado",
  voided: "Anulado",
  error: "Error",
  refunded: "Reembolsado",
};

export const ALLOWED_TRANSITIONS: Record<string, Set<string>> = {
  requested: new Set(["accepted", "cancelled"]),
  accepted: new Set(["scheduled", "traveling", "cancelled"]),
  scheduled: new Set(["traveling", "cancelled"]),
  traveling: new Set(["arrived", "cancelled"]),
  arrived: new Set(["in_progress", "cancelled"]),
  in_progress: new Set(["break", "lunch", "other_service", "completed", "cancelled"]),
  break: new Set(["in_progress", "cancelled"]),
  lunch: new Set(["in_progress", "cancelled"]),
  other_service: new Set(["in_progress", "cancelled"]),
  completed: new Set(),
  cancelled: new Set(),
};

const CITY_CENTERS: Record<string, [number, number]> = {
  bogota: [4.6486, -74.0626],
  medellin: [6.2442, -75.5812],
  cali: [3.4516, -76.532],
  cartagena: [10.391, -75.4794],
};

export function isCityCenter(lat: number | null, lng: number | null, city: string): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return true;
  const key = (city || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const center = CITY_CENTERS[key];
  if (!center) return false;
  return Math.abs(Number(lat) - center[0]) < 0.002 && Math.abs(Number(lng) - center[1]) < 0.002;
}

export function moneyNum(value: unknown): number {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function moneyStr(value: unknown): string {
  return moneyNum(value).toFixed(2);
}

export function methodLabel(code: string): string {
  return METHOD_LABELS[(code || "").toUpperCase()] || code || "—";
}

export function personName(user?: Partial<DbUser> | null): string {
  if (!user) return "—";
  const full = `${user.first_name || ""} ${user.last_name || ""}`.trim();
  return full || user.email || user.username || "—";
}

export function commissionRate(): number {
  const paymentsCfg = (loadPlatformSettings().sections?.payments || {}) as Record<string, unknown>;
  const raw = Number(paymentsCfg.platform_commission ?? 10);
  if (!Number.isFinite(raw)) return 10;
  return Math.min(Math.max(raw, 0), 100);
}

export function computeDiscount(priceInput: unknown): number {
  const price = moneyNum(priceInput);
  const cfg = (loadPlatformSettings().sections?.payments || {}) as Record<string, unknown>;
  if (cfg.discount_enabled !== true || price <= 0) return 0;
  const value = Number(cfg.discount_value || 0);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const raw = cfg.discount_type === "percent" ? (price * Math.min(value, 100)) / 100 : value;
  const commission = moneyNum((price * commissionRate()) / 100);
  return Math.max(0, moneyNum(Math.min(raw, commission, Math.max(0, price - 1500))));
}

export function orderPrice(order: Record<string, unknown>): number {
  return moneyNum(order.final_price ?? order.estimate_max ?? order.estimate_min ?? 0);
}

export function orderGross(orderId: number, orderRow: Record<string, unknown>): number {
  const payment = db
    .prepare("SELECT amount_in_cents FROM payments WHERE order_id = ? AND status IN ('approved', 'refunded') ORDER BY id ASC LIMIT 1")
    .get(orderId) as { amount_in_cents: number } | undefined;
  if (payment) {
    return moneyNum(payment.amount_in_cents / 100);
  }
  return orderPrice(orderRow);
}

export function registerSplit(orderId: number, grossOverride?: number | null, discountInput = 0): void {
  const orderRow = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as Record<string, unknown> | undefined;
  if (!orderRow) return;
  const gross = moneyNum(grossOverride !== undefined && grossOverride !== null ? grossOverride : orderGross(orderId, orderRow));
  const discount = moneyNum(discountInput);
  const rate = commissionRate();
  const fullCommission = moneyNum((gross * rate) / 100);
  const commissionAmount = Math.max(0, moneyNum(fullCommission - discount));
  const professionalAmount = moneyNum(gross - fullCommission);
  db.prepare(
    "UPDATE orders SET commission_rate = ?, commission_amount = ?, professional_amount = ?, updated_at = ? WHERE id = ?"
  ).run(rate.toFixed(2), commissionAmount.toFixed(2), professionalAmount.toFixed(2), new Date().toISOString(), orderId);
}

export function backfillSplits(): void {
  const rows = db
    .prepare(
      `SELECT * FROM orders
       WHERE payment_status = 'paid'
         AND (commission_rate IS NULL OR commission_rate = '' OR CAST(COALESCE(professional_amount, '0') AS REAL) <= 0)`
    )
    .all() as Array<Record<string, unknown>>;
  for (const r of rows) {
    const id = Number(r.id);
    if (orderGross(id, r) > 0 || !r.commission_rate) {
      registerSplit(id);
    }
  }
}

export function autoSettleCompletedPaidOrders(orderId?: number): number {
  backfillSplits();
  const ts = new Date().toISOString();
  if (typeof orderId === "number" && Number.isFinite(orderId) && orderId > 0) {
    const info = db
      .prepare(
        `UPDATE orders
         SET payout_status = 'settled',
             payout_settled_at = COALESCE(NULLIF(payout_settled_at, ''), ?),
             updated_at = ?
         WHERE id = ? AND payment_status = 'paid' AND status = 'completed' AND payout_status = 'pending'`
      )
      .run(ts, ts, orderId);
    return Number(info.changes || 0);
  }
  const info = db
    .prepare(
      `UPDATE orders
       SET payout_status = 'settled',
           payout_settled_at = COALESCE(NULLIF(payout_settled_at, ''), ?),
           updated_at = ?
       WHERE payment_status = 'paid' AND status = 'completed' AND payout_status = 'pending'`
    )
    .run(ts, ts);
  return Number(info.changes || 0);
}

export function professionalBalance(profileId: number) {
  autoSettleCompletedPaidOrders();
  const orders = db
    .prepare("SELECT payment_status, payout_status, commission_amount, professional_amount FROM orders WHERE professional_id = ?")
    .all(profileId) as Array<Record<string, unknown>>;

  let grossTotal = 0;
  let commissionTotal = 0;
  let netTotal = 0;
  let pendingSettlement = 0;
  let settledTotal = 0;

  for (const o of orders) {
    if (o.payment_status === "paid") {
      const pro = moneyNum(o.professional_amount);
      const com = moneyNum(o.commission_amount);
      grossTotal += pro + com;
      commissionTotal += com;
      netTotal += pro;
      if (o.payout_status === "settled") settledTotal += pro;
      else pendingSettlement += pro;
    }
  }

  const withdrawals = db
    .prepare("SELECT amount, status FROM withdrawals WHERE professional_id = ?")
    .all(profileId) as Array<{ amount: string; status: string }>;
  let reserved = 0;
  let withdrawnTotal = 0;
  let pendingWithdrawals = 0;
  for (const w of withdrawals) {
    const amt = moneyNum(w.amount);
    if (w.status === "pending" || w.status === "approved" || w.status === "paid") reserved += amt;
    if (w.status === "paid") withdrawnTotal += amt;
    if (w.status === "pending" || w.status === "approved") pendingWithdrawals += amt;
  }

  return {
    commission_rate: commissionRate(),
    gross_total: moneyNum(grossTotal),
    commission_total: moneyNum(commissionTotal),
    net_total: moneyNum(netTotal),
    pending_settlement: moneyNum(pendingSettlement),
    settled_total: moneyNum(settledTotal),
    available_balance: moneyNum(settledTotal - reserved),
    withdrawn_total: moneyNum(withdrawnTotal),
    pending_withdrawals: moneyNum(pendingWithdrawals),
  };
}

export function isSettleable(order: Record<string, unknown>): boolean {
  return order.payment_status === "paid" && order.status === "completed" && order.payout_status === "pending";
}

export function platformSummary() {
  backfillSplits();
  const paidOrders = db
    .prepare("SELECT status, payout_status, commission_amount, professional_amount FROM orders WHERE payment_status = 'paid'")
    .all() as Array<Record<string, unknown>>;
  const payments = db
    .prepare("SELECT amount_in_cents, discount_amount, status FROM payments")
    .all() as Array<{ amount_in_cents: number; discount_amount: string; status: string }>;
  const withdrawals = db
    .prepare("SELECT amount, status FROM withdrawals")
    .all() as Array<{ amount: string; status: string }>;
  const refunds = db
    .prepare("SELECT amount, status FROM refunds")
    .all() as Array<{ amount: string; status: string }>;

  let approvedCents = 0;
  let pendingCents = 0;
  let discountsTotal = 0;
  const byStatus: Record<string, number> = {
    pending: 0,
    approved: 0,
    declined: 0,
    voided: 0,
    error: 0,
    refunded: 0,
  };
  for (const p of payments) {
    if (p.status in byStatus) byStatus[p.status] += 1;
    if (p.status === "approved") {
      approvedCents += Number(p.amount_in_cents || 0);
      discountsTotal += moneyNum(p.discount_amount);
    } else if (p.status === "pending") {
      pendingCents += Number(p.amount_in_cents || 0);
    }
  }

  let commissions = 0;
  let proShare = 0;
  let pendingSettlement = 0;
  let eligibleOrders = 0;
  let settled = 0;
  for (const o of paidOrders) {
    const com = moneyNum(o.commission_amount);
    const pro = moneyNum(o.professional_amount);
    commissions += com;
    proShare += pro;
    if (o.payout_status === "settled") settled += pro;
    else {
      pendingSettlement += pro;
      if (o.status === "completed") eligibleOrders += 1;
    }
  }

  let openWCount = 0;
  let openWAmount = 0;
  let paidWAmount = 0;
  for (const w of withdrawals) {
    const amt = moneyNum(w.amount);
    if (w.status === "pending" || w.status === "approved") {
      openWCount += 1;
      openWAmount += amt;
    } else if (w.status === "paid") {
      paidWAmount += amt;
    }
  }

  let openRefunds = 0;
  let refundsTotal = 0;
  for (const r of refunds) {
    if (r.status === "requested") openRefunds += 1;
    if (r.status === "approved") refundsTotal += moneyNum(r.amount);
  }

  return {
    commission_rate: commissionRate(),
    discounts_total: moneyNum(discountsTotal),
    payments_total: payments.length,
    collected: moneyNum(approvedCents / 100),
    pending_collection: moneyNum(pendingCents / 100),
    commissions: moneyNum(commissions),
    professionals_share: moneyNum(proShare),
    pending_settlement: moneyNum(pendingSettlement),
    eligible_settlement_orders: eligibleOrders,
    settled: moneyNum(settled),
    withdrawals_open_count: openWCount,
    withdrawals_open_amount: moneyNum(openWAmount),
    withdrawals_paid: moneyNum(paidWAmount),
    refunds_open_count: openRefunds,
    refunds_total: moneyNum(refundsTotal),
    payments_by_status: byStatus,
  };
}

export function monthlySeries(months = 6) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  const buckets: string[] = [];
  for (let i = 0; i < months; i += 1) {
    buckets.push(`${year}-${String(month).padStart(2, "0")}`);
    month -= 1;
    if (month === 0) {
      year -= 1;
      month = 12;
    }
  }
  buckets.reverse();

  const orders = db
    .prepare(
      "SELECT payment_confirmed_at, commission_amount, professional_amount FROM orders WHERE payment_status = 'paid' AND payment_confirmed_at IS NOT NULL"
    )
    .all() as Array<{ payment_confirmed_at: string; commission_amount: string; professional_amount: string }>;

  return buckets.map((b) => {
    let commissions = 0;
    let pro = 0;
    for (const o of orders) {
      if ((o.payment_confirmed_at || "").slice(0, 7) === b) {
        commissions += moneyNum(o.commission_amount);
        pro += moneyNum(o.professional_amount);
      }
    }
    return {
      month: b,
      commissions: moneyNum(commissions),
      collected: moneyNum(commissions + pro),
    };
  });
}

// ── Catalog & Store ──────────────────────────────────────────────────────────

export function serializeServiceCategoryList(cat: Record<string, unknown>) {
  const prosCountRow = db
    .prepare(
      `SELECT COUNT(DISTINCT ps.id) AS cnt
       FROM professional_services ps
       JOIN services s ON s.id = ps.service_id
       JOIN professional_profiles pp ON pp.id = ps.profile_id
       WHERE s.category_id = ? AND s.is_active = 1 AND pp.is_active = 1`
    )
    .get(cat.id as number) as { cnt: number };

  return {
    id: Number(cat.id),
    name: String(cat.name),
    slug: String(cat.slug),
    description: String(cat.description || ""),
    icon_key: String(cat.icon_key || "construct"),
    professionals_count: Number(prosCountRow?.cnt || 0),
  };
}

export function serializeService(srv: Record<string, unknown>) {
  const cat = db.prepare("SELECT * FROM service_categories WHERE id = ?").get(srv.category_id as number) as
    | Record<string, unknown>
    | undefined;
  return {
    id: Number(srv.id),
    name: String(srv.name),
    slug: String(srv.slug),
    description: String(srv.description || ""),
    price_min: srv.price_min !== null && srv.price_min !== undefined ? String(srv.price_min) : null,
    price_max: srv.price_max !== null && srv.price_max !== undefined ? String(srv.price_max) : null,
    estimated_hours:
      srv.estimated_hours !== null && srv.estimated_hours !== undefined ? String(srv.estimated_hours) : null,
    category: cat
      ? {
          id: Number(cat.id),
          name: String(cat.name),
          slug: String(cat.slug),
          description: String(cat.description || ""),
          icon_key: String(cat.icon_key || "construct"),
          professionals_count: 0,
        }
      : { id: Number(srv.category_id), name: "", slug: "", description: "", icon_key: "construct", professionals_count: 0 },
  };
}

export function serializeServiceCategoryDetail(cat: Record<string, unknown>) {
  const base = serializeServiceCategoryList(cat);
  const services = db
    .prepare("SELECT * FROM services WHERE category_id = ? AND is_active = 1 ORDER BY name ASC, id ASC")
    .all(cat.id as number) as Array<Record<string, unknown>>;
  return {
    ...base,
    services: services.map(serializeService),
  };
}

export function serializeStoreProduct(prod: Record<string, unknown>, req?: Request) {
  const owner = db.prepare("SELECT email, username, is_blocked FROM users WHERE id = ?").get(prod.owner_id as number) as
    | { email: string; username: string; is_blocked: number }
    | undefined;
  const rawImg = String(prod.image || "");
  const resolvedImg = rawImg && !rawImg.startsWith("/assets/") && !rawImg.startsWith("data:") && !/^https?:\/\//i.test(rawImg) && req
    ? absoluteUrl(req, rawImg.startsWith("/") ? rawImg : `/media/${rawImg}`)
    : rawImg;
  const imagesList = safeJsonParse<string[]>(prod.images, []);
  const finalImages = imagesList.length > 0 ? imagesList : resolvedImg ? [resolvedImg] : [];

  return {
    id: Number(prod.id),
    owner: Number(prod.owner_id),
    title: String(prod.title || ""),
    category: String(prod.category || "Otros"),
    price: Number(prod.price || 0),
    stock: Number(prod.stock ?? 1),
    condition: String(prod.condition || "Nuevo"),
    description: String(prod.description || ""),
    seller_name: String(prod.seller_name || ""),
    seller_email: String(prod.seller_email || owner?.email || ""),
    seller_username: String(prod.seller_username || owner?.username || ""),
    seller_role: String(prod.seller_role || "Cliente"),
    seller_blocked: Boolean(prod.seller_blocked || owner?.is_blocked),
    phone: String(prod.phone || ""),
    city: String(prod.city || "Bogotá"),
    image_url: resolvedImg,
    images: finalImages,
    is_active: Boolean(prod.is_active),
    review_status: String(prod.review_status || "aprobado"),
    review_notes: String(prod.review_notes || ""),
    reviewed_by: String(prod.reviewed_by || ""),
    reviewed_at: prod.reviewed_at ? String(prod.reviewed_at) : null,
    reports_count: Number(prod.reports_count || 0),
    last_report_reason: String(prod.last_report_reason || ""),
    created_at: String(prod.created_at),
    updated_at: String(prod.updated_at || prod.created_at),
  };
}

// ── Household ────────────────────────────────────────────────────────────────

export function serializeHousehold(h: Record<string, unknown>) {
  return {
    id: Number(h.id),
    label: String(h.label || "Mi hogar"),
    property_type: String(h.property_type || "apartment"),
    address_line: String(h.address_line || ""),
    neighborhood: String(h.neighborhood || ""),
    city: String(h.city || "Bogota"),
    country: String(h.country || "Colombia"),
    latitude: h.latitude !== null && h.latitude !== undefined ? Number(h.latitude) : null,
    longitude: h.longitude !== null && h.longitude !== undefined ? Number(h.longitude) : null,
    area_m2: h.area_m2 !== null && h.area_m2 !== undefined ? Number(h.area_m2) : null,
    build_year: h.build_year !== null && h.build_year !== undefined ? Number(h.build_year) : null,
    notes: String(h.notes || ""),
    is_default: Boolean(h.is_default),
    created_at: String(h.created_at),
  };
}

// ── Professionals ────────────────────────────────────────────────────────────

export function serializeProfessionalService(ps: Record<string, unknown>) {
  const srv = db.prepare("SELECT * FROM services WHERE id = ?").get(ps.service_id as number) as
    | Record<string, unknown>
    | undefined;
  const cat = srv
    ? (db.prepare("SELECT * FROM service_categories WHERE id = ?").get(srv.category_id as number) as
        | Record<string, unknown>
        | undefined)
    : undefined;
  return {
    id: Number(ps.id),
    service: Number(ps.service_id),
    service_name: srv ? String(srv.name) : "",
    service_slug: srv ? String(srv.slug) : "",
    category: srv ? Number(srv.category_id) : 0,
    category_name: cat ? String(cat.name) : "",
    category_slug: cat ? String(cat.slug) : "",
    price_min: ps.price_min !== null && ps.price_min !== undefined ? String(ps.price_min) : null,
    price_max: ps.price_max !== null && ps.price_max !== undefined ? String(ps.price_max) : null,
    observaciones: String(ps.observations || ""),
    years_experience: Number(ps.years_experience || 0),
  };
}

function getAvailabilityLabel(profileId: number): string {
  const slots = db
    .prepare("SELECT weekday, start_time, end_time FROM availability_slots WHERE profile_id = ? ORDER BY weekday ASC, start_time ASC")
    .all(profileId) as Array<{ weekday: number; start_time: string; end_time: string }>;
  if (!slots.length) return "Horario por acordar";
  // JS getDay(): 0=Sun..6=Sat -> Python weekday(): Mon=0..Sun=6
  const todayPy = (new Date().getDay() + 6) % 7;
  const todaySlots = slots.filter((s) => Number(s.weekday) === todayPy);
  const selected = todaySlots.length ? todaySlots : slots.slice(0, 1);
  const ranges = selected
    .map((s) => `${String(s.start_time).slice(0, 5)}-${String(s.end_time).slice(0, 5)}`)
    .join(", ");
  return todaySlots.length ? `Hoy ${ranges}` : `Disponible ${ranges}`;
}

export function serializeProfessionalList(
  prof: Record<string, unknown>,
  opts: { viewerUser?: DbUser | null; serviceParam?: string | null; distanceKm?: number | null } = {}
) {
  const profileId = Number(prof.id);
  const user = db.prepare("SELECT first_name, last_name, username, email, phone FROM users WHERE id = ?").get(prof.user_id as number) as
    | { first_name: string; last_name: string; username: string; email: string; phone: string }
    | undefined;
  const services = db
    .prepare(
      `SELECT ps.*, s.name AS srv_name, s.slug AS srv_slug, c.name AS cat_name
       FROM professional_services ps
       JOIN services s ON s.id = ps.service_id
       JOIN service_categories c ON c.id = s.category_id
       WHERE ps.profile_id = ?`
    )
    .all(profileId) as Array<Record<string, unknown>>;

  const categories = Array.from(new Set(services.map((s) => String(s.cat_name)))).sort();
  let matchingService: ReturnType<typeof serializeProfessionalService> | null = null;
  if (opts.serviceParam) {
    const param = String(opts.serviceParam);
    const found = services.find((s) =>
      /^\d+$/.test(param) ? Number(s.service_id) === Number(param) : String(s.srv_slug) === param
    );
    if (found) matchingService = serializeProfessionalService(found);
  }

  const displayName = String(prof.display_name || "");
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || getInitials(user?.first_name || "", user?.last_name || "", user?.username || "", user?.email || "");

  const lat = prof.latitude !== null && prof.latitude !== undefined ? Number(prof.latitude) : null;
  const lng = prof.longitude !== null && prof.longitude !== undefined ? Number(prof.longitude) : null;

  return {
    id: profileId,
    slug: String(prof.slug),
    display_name: displayName,
    initials,
    location_approximate: isCityCenter(lat, lng, String(prof.city || "")),
    is_own_profile: Boolean(opts.viewerUser && Number(prof.user_id) === Number(opts.viewerUser.id)),
    headline: String(prof.headline || ""),
    company_name: String(prof.headline || ""),
    specialty_label: String(prof.specialty_label || ""),
    has_certificate: Boolean(prof.certificate_file),
    avatar_url: String(prof.avatar_url || ""),
    phone: user?.phone || "",
    rating_avg: String(prof.rating_avg || "0.00"),
    jobs_completed: Number(prof.jobs_completed || 0),
    is_verified: Boolean(prof.is_verified),
    is_active: Boolean(prof.is_active),
    points: Number(prof.points || 0),
    wallet_balance: String(prof.wallet_balance || "0.00"),
    accepts_urgent: Boolean(prof.accepts_urgent),
    neighborhood: String(prof.neighborhood || ""),
    city: String(prof.city || "Bogota"),
    latitude: lat,
    longitude: lng,
    distance_km: opts.distanceKm ?? undefined,
    categories,
    matching_service: matchingService,
    availability_label: getAvailabilityLabel(profileId),
  };
}

export function serializeProfessionalDetail(
  prof: Record<string, unknown>,
  opts: { viewerUser?: DbUser | null; serviceParam?: string | null; distanceKm?: number | null } = {}
) {
  const base = serializeProfessionalList(prof, opts);
  const profileId = Number(prof.id);
  const psRows = db.prepare("SELECT * FROM professional_services WHERE profile_id = ?").all(profileId) as Array<
    Record<string, unknown>
  >;
  const slots = db
    .prepare("SELECT * FROM availability_slots WHERE profile_id = ? ORDER BY weekday ASC, start_time ASC")
    .all(profileId) as Array<Record<string, unknown>>;
  const portfolio = db
    .prepare("SELECT * FROM portfolio_items WHERE profile_id = ? ORDER BY sort_order ASC, id ASC")
    .all(profileId) as Array<Record<string, unknown>>;

  return {
    ...base,
    bio: String(prof.bio || ""),
    coverage_radius_km: Number(prof.coverage_radius_km || 10),
    response_time_minutes: Number(prof.response_time_minutes || 60),
    services: psRows.map(serializeProfessionalService),
    availability: slots.map((s) => ({
      id: Number(s.id),
      weekday: Number(s.weekday),
      weekday_label: WEEKDAY_LABELS[Number(s.weekday)] || String(s.weekday),
      start_time: String(s.start_time),
      end_time: String(s.end_time),
    })),
    portfolio: portfolio.map((p) => ({
      id: Number(p.id),
      image_url: String(p.image_url || ""),
      caption: String(p.caption || ""),
      sort_order: Number(p.sort_order || 0),
    })),
    created_at: String(prof.created_at),
  };
}

export function serializeProfessionalMe(prof: Record<string, unknown>) {
  const profileId = Number(prof.id);
  const psRows = db.prepare("SELECT * FROM professional_services WHERE profile_id = ?").all(profileId) as Array<
    Record<string, unknown>
  >;
  return {
    id: profileId,
    display_name: String(prof.display_name || ""),
    headline: String(prof.headline || ""),
    bio: String(prof.bio || ""),
    latitude: prof.latitude !== null && prof.latitude !== undefined ? Number(prof.latitude) : null,
    longitude: prof.longitude !== null && prof.longitude !== undefined ? Number(prof.longitude) : null,
    neighborhood: String(prof.neighborhood || ""),
    city: String(prof.city || "Bogota"),
    coverage_radius_km: Number(prof.coverage_radius_km || 10),
    response_time_minutes: Number(prof.response_time_minutes || 60),
    accepts_urgent: Boolean(prof.accepts_urgent),
    is_verified: Boolean(prof.is_verified),
    is_active: Boolean(prof.is_active),
    rating_avg: String(prof.rating_avg || "0.00"),
    jobs_completed: Number(prof.jobs_completed || 0),
    services: psRows.map(serializeProfessionalService),
    created_at: String(prof.created_at),
  };
}

// ── Service Requests & Orders ────────────────────────────────────────────────

export function serializeServiceRequest(sr: Record<string, unknown>, viewerUser?: DbUser | null, req?: Request) {
  const client = db.prepare("SELECT * FROM users WHERE id = ?").get(sr.client_id as number) as DbUser | undefined;
  const household = db.prepare("SELECT * FROM households WHERE id = ?").get(sr.household_id as number) as
    | Record<string, unknown>
    | undefined;
  const sugCat = sr.suggested_category_id
    ? (db.prepare("SELECT * FROM service_categories WHERE id = ?").get(sr.suggested_category_id as number) as
        | Record<string, unknown>
        | undefined)
    : undefined;
  const selCat = db.prepare("SELECT * FROM service_categories WHERE id = ?").get(sr.selected_category_id as number) as
    | Record<string, unknown>
    | undefined;
  const selSrv = sr.selected_service_id
    ? (db.prepare("SELECT * FROM services WHERE id = ?").get(sr.selected_service_id as number) as
        | Record<string, unknown>
        | undefined)
    : undefined;
  const prof = sr.professional_id
    ? (db.prepare("SELECT * FROM professional_profiles WHERE id = ?").get(sr.professional_id as number) as
        | Record<string, unknown>
        | undefined)
    : undefined;

  const candidates = db
    .prepare("SELECT * FROM request_candidates WHERE request_id = ? ORDER BY distance_km ASC, id ASC")
    .all(sr.id as number) as Array<Record<string, unknown>>;
  const images = db
    .prepare("SELECT * FROM service_request_images WHERE service_request_id = ? ORDER BY id ASC")
    .all(sr.id as number) as Array<Record<string, unknown>>;
  const order = db
    .prepare("SELECT * FROM orders WHERE service_request_id = ? ORDER BY id ASC LIMIT 1")
    .get(sr.id as number) as Record<string, unknown> | undefined;

  const followedSuggestion =
    sr.suggested_category_id && sr.selected_category_id
      ? Number(sr.suggested_category_id) === Number(sr.selected_category_id)
      : null;

  return {
    id: Number(sr.id),
    client: client
      ? {
          id: client.id,
          first_name: client.first_name,
          last_name: client.last_name,
          initials: getInitials(client.first_name, client.last_name, client.username, client.email),
          city: client.city,
        }
      : { id: Number(sr.client_id), first_name: "", last_name: "", initials: "CL", city: "" },
    household: household ? serializeHousehold(household) : null,
    diagnostic_session: sr.diagnostic_session_id ? Number(sr.diagnostic_session_id) : null,
    suggested_category: sugCat ? serializeServiceCategoryList(sugCat) : null,
    selected_category: selCat ? serializeServiceCategoryList(selCat) : null,
    selected_service: selSrv ? serializeService(selSrv) : null,
    professional: prof ? serializeProfessionalList(prof, { viewerUser }) : null,
    followed_suggestion: followedSuggestion,
    description: String(sr.description || ""),
    urgency: String(sr.urgency || "this_week"),
    search_radius_km: Number(sr.search_radius_km || 10),
    status: String(sr.status || "open"),
    status_label: REQUEST_STATUS_LABELS[String(sr.status || "open")] || String(sr.status),
    order: order
      ? {
          id: Number(order.id),
          status: String(order.status),
          status_label: ORDER_STATUS_LABELS[String(order.status)] || String(order.status),
          payment_status: String(order.payment_status),
          payment_status_label: PAYMENT_STATUS_LABELS[String(order.payment_status)] || String(order.payment_status),
          payment_confirmed_at: order.payment_confirmed_at ? String(order.payment_confirmed_at) : null,
        }
      : null,
    images: images.map((img) => {
      const p = `/api/v1/requests/${sr.id}/images/${img.id}/`;
      return {
        id: Number(img.id),
        image_url: req ? absoluteUrl(req, p) : p,
        created_at: String(img.created_at),
      };
    }),
    candidates: candidates
      .map((c) => {
        const cProf = db
          .prepare("SELECT * FROM professional_profiles WHERE id = ?")
          .get(c.professional_id as number) as Record<string, unknown> | undefined;
        if (!cProf) return null;
        return {
          id: Number(c.id),
          professional: serializeProfessionalList(cProf, { viewerUser }),
          distance_km: Number(c.distance_km || 0),
          status: String(c.status || "pending"),
          created_at: String(c.created_at),
        };
      })
      .filter(Boolean),
    created_at: String(sr.created_at),
  };
}

export function priceBoundsForOrder(orderRow: Record<string, unknown>): [number | null, number | null] {
  let lower = orderRow.estimate_min !== null && orderRow.estimate_min !== undefined ? Number(orderRow.estimate_min) : null;
  let upper = orderRow.estimate_max !== null && orderRow.estimate_max !== undefined ? Number(orderRow.estimate_max) : null;
  if (lower !== null && upper !== null) return [lower, upper];

  const sr = db.prepare("SELECT selected_service_id FROM service_requests WHERE id = ?").get(orderRow.service_request_id as number) as
    | { selected_service_id: number | null }
    | undefined;
  if (sr?.selected_service_id) {
    const ps = db
      .prepare("SELECT price_min, price_max FROM professional_services WHERE profile_id = ? AND service_id = ?")
      .get(orderRow.professional_id as number, sr.selected_service_id) as
      | { price_min: string | null; price_max: string | null }
      | undefined;
    if (ps) {
      if (lower === null && ps.price_min !== null) lower = Number(ps.price_min);
      if (upper === null && ps.price_max !== null) upper = Number(ps.price_max);
    }
    const srv = db.prepare("SELECT price_min, price_max FROM services WHERE id = ?").get(sr.selected_service_id) as
      | { price_min: string | null; price_max: string | null }
      | undefined;
    if (srv) {
      if (lower === null && srv.price_min !== null) lower = Number(srv.price_min);
      if (upper === null && srv.price_max !== null) upper = Number(srv.price_max);
    }
  }
  return [lower, upper];
}

export function serializeOrder(orderRow: Record<string, unknown>, viewerUser?: DbUser | null, req?: Request) {
  const orderId = Number(orderRow.id);
  const prof = db
    .prepare("SELECT * FROM professional_profiles WHERE id = ?")
    .get(orderRow.professional_id as number) as Record<string, unknown>;
  const sr = db
    .prepare("SELECT * FROM service_requests WHERE id = ?")
    .get(orderRow.service_request_id as number) as Record<string, unknown>;
  const household = sr
    ? (db.prepare("SELECT * FROM households WHERE id = ?").get(sr.household_id as number) as
        | Record<string, unknown>
        | undefined)
    : undefined;
  const events = db.prepare("SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at ASC, id ASC").all(orderId) as Array<
    Record<string, unknown>
  >;
  const review = db.prepare("SELECT * FROM reviews WHERE order_id = ?").get(orderId) as
    | Record<string, unknown>
    | undefined;
  const evidence = db.prepare("SELECT * FROM work_evidence WHERE order_id = ? ORDER BY id ASC").all(orderId) as Array<
    Record<string, unknown>
  >;
  const payments = db.prepare("SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC, id DESC").all(orderId) as Array<
    Record<string, unknown>
  >;

  const isClient = Boolean(viewerUser && Number(orderRow.client_id) === Number(viewerUser.id));
  const isAssignedPro = Boolean(viewerUser && prof && Number(prof.user_id) === Number(viewerUser.id));
  const viewerRole = isAssignedPro
    ? "professional"
    : isClient
      ? "client"
      : isStaffUser(viewerUser)
        ? "staff"
        : "none";

  const [lower, upper] = priceBoundsForOrder(orderRow);
  const validBounds = lower !== null && upper !== null && lower > 0 && upper >= lower;
  const hasPendingPayment = payments.some((p) => p.status === "pending");
  const canSetFinalPrice =
    isAssignedPro &&
    !["requested", "cancelled"].includes(String(orderRow.status)) &&
    orderRow.payment_status !== "paid" &&
    validBounds &&
    !hasPendingPayment;

  const baseAllowed = new Set(ALLOWED_TRANSITIONS[String(orderRow.status)] || []);
  baseAllowed.delete("accepted");
  if (sr && sr.status !== "accepted") {
    for (const s of Array.from(baseAllowed)) {
      if (s !== "cancelled") baseAllowed.delete(s);
    }
  }
  let availableTransitions: string[] = [];
  if (viewerUser) {
    if (isAssignedPro || isStaffUser(viewerUser)) {
      availableTransitions = Array.from(baseAllowed).sort();
    } else if (isClient && ["requested", "accepted", "scheduled"].includes(String(orderRow.status))) {
      availableTransitions = Array.from(baseAllowed).filter((s) => s === "cancelled");
    }
  }

  let paymentInfo: Record<string, unknown> | null = null;
  if (orderRow.payment_status !== "pending") {
    const paidRow = payments.find((p) => p.status === "approved" || p.status === "refunded");
    if (paidRow) {
      const amt = moneyNum(Number(paidRow.amount_in_cents || 0) / 100);
      const disc = moneyNum(paidRow.discount_amount);
      paymentInfo = {
        amount: amt.toFixed(2),
        discount: disc.toFixed(2),
        subtotal: moneyNum(amt + disc).toFixed(2),
        method: methodLabel(String(paidRow.payment_method || "")),
        reference: String(paidRow.reference || ""),
        paid_at: orderRow.payment_confirmed_at ? String(orderRow.payment_confirmed_at) : null,
        receipt_id: isClient ? Number(paidRow.id) : null,
      };
    }
  }

  const finalPrice = orderRow.final_price !== null && orderRow.final_price !== undefined ? String(orderRow.final_price) : null;
  let discountPreview = "0.00";
  let amountDue: string | null = null;
  if (orderRow.payment_status === "pending" && finalPrice) {
    const disc = computeDiscount(finalPrice);
    discountPreview = disc.toFixed(2);
    amountDue = moneyNum(Number(finalPrice) - disc).toFixed(2);
  }

  return {
    id: orderId,
    service_request: Number(orderRow.service_request_id),
    professional: prof ? serializeProfessionalList(prof, { viewerUser }) : null,
    status: String(orderRow.status),
    status_label: ORDER_STATUS_LABELS[String(orderRow.status)] || String(orderRow.status),
    available_transitions: availableTransitions,
    viewer_role: viewerRole,
    price_bounds: {
      min: lower !== null ? String(lower) : null,
      max: upper !== null ? String(upper) : null,
    },
    can_set_final_price: canSetFinalPrice,
    discount_preview: discountPreview,
    amount_due: amountDue,
    payment_info: paymentInfo,
    payment_status: String(orderRow.payment_status),
    payment_status_label: PAYMENT_STATUS_LABELS[String(orderRow.payment_status)] || String(orderRow.payment_status),
    payment_confirmed_at: orderRow.payment_confirmed_at ? String(orderRow.payment_confirmed_at) : null,
    payment_reference: String(orderRow.payment_reference || ""),
    scheduled_for: orderRow.scheduled_for ? String(orderRow.scheduled_for) : null,
    estimate_min: orderRow.estimate_min !== null && orderRow.estimate_min !== undefined ? String(orderRow.estimate_min) : null,
    estimate_max: orderRow.estimate_max !== null && orderRow.estimate_max !== undefined ? String(orderRow.estimate_max) : null,
    final_price: finalPrice,
    client_notes: String(orderRow.client_notes || ""),
    arrival_code: isClient ? String(orderRow.arrival_code || "") : "",
    professional_latitude:
      orderRow.professional_latitude !== null && orderRow.professional_latitude !== undefined
        ? Number(orderRow.professional_latitude)
        : null,
    professional_longitude:
      orderRow.professional_longitude !== null && orderRow.professional_longitude !== undefined
        ? Number(orderRow.professional_longitude)
        : null,
    workplace_latitude:
      household?.latitude !== null && household?.latitude !== undefined ? Number(household.latitude) : null,
    workplace_longitude:
      household?.longitude !== null && household?.longitude !== undefined ? Number(household.longitude) : null,
    workplace_address: String(household?.address_line || ""),
    workplace_neighborhood: String(household?.neighborhood || ""),
    workplace_city: String(household?.city || ""),
    household_label: String(household?.label || "Tu Vivienda"),
    events: events.map((e) => ({
      id: Number(e.id),
      status: String(e.status),
      status_label: ORDER_STATUS_LABELS[String(e.status)] || String(e.status),
      note: String(e.note || ""),
      created_at: String(e.created_at),
    })),
    review: review
      ? {
          id: Number(review.id),
          order: orderId,
          rating: Number(review.rating),
          comment: String(review.comment || ""),
          created_at: String(review.created_at),
        }
      : null,
    work_evidence: evidence.map((ev) => {
      const p = `/api/v1/orders/${orderId}/evidence/${ev.id}/`;
      return {
        id: Number(ev.id),
        image_url: req ? absoluteUrl(req, p) : p,
        caption: String(ev.caption || ""),
        created_at: String(ev.created_at),
      };
    }),
    created_at: String(orderRow.created_at),
  };
}

// ── PQRs & Technical Problems ────────────────────────────────────────────────

export function serializePqrMessage(m: Record<string, unknown>) {
  return {
    id: `msg-${m.id}`,
    sender: String(m.sender || "client"),
    senderName: String(m.sender_name || ""),
    senderRole: String(m.sender_role || ""),
    text: String(m.text || ""),
    timestamp: String(m.timestamp),
  };
}

export function serializePqrReport(p: Record<string, unknown>) {
  const msgs = db.prepare("SELECT * FROM pqr_messages WHERE pqr_id = ? ORDER BY id ASC").all(p.id as number) as Array<
    Record<string, unknown>
  >;
  const rawSubject = String(p.subject_type || "").toLowerCase().trim();
  const relatedTo = String(p.related_to || "");
  const radicado = String(p.radicado_number || "");
  const subjectType: "servicio" | "producto" =
    rawSubject === "producto" ||
    Boolean(p.product_id) ||
    relatedTo.toLowerCase().startsWith("producto #") ||
    radicado.toUpperCase().startsWith("PQR-PROD-")
      ? "producto"
      : "servicio";
  const productName =
    String(p.product_name || "").trim() ||
    (subjectType === "producto" && relatedTo.toLowerCase().startsWith("producto #")
      ? relatedTo.replace(/^producto #\d+:\s*/i, "").trim()
      : "");

  return {
    id: `pqr-${p.id}`,
    radicadoNumber: radicado,
    status: String(p.status || "radicado"),
    priority: String(p.priority || ""),
    assignedTo: String(p.assigned_to || ""),
    relatedTo,
    subjectType,
    subject_type: subjectType,
    productId: p.product_id !== null && p.product_id !== undefined ? Number(p.product_id) : null,
    productName,
    type: String(p.pqr_type || "queja"),
    reason: String(p.reason || ""),
    contractorId: String(p.contractor_id_ref || ""),
    contractorName: String(p.contractor_name || ""),
    contractorCompany: String(p.contractor_company || ""),
    contractorSpecialty: String(p.contractor_specialty || ""),
    contractorAvatar: String(p.contractor_avatar || ""),
    clientName: String(p.client_name || ""),
    clientPhone: String(p.client_phone || ""),
    clientEmail: String(p.client_email || ""),
    clientDocumentId: String(p.client_document_id || ""),
    clientAddress: String(p.client_address || ""),
    incidentDate: String(p.incident_date || ""),
    amountDisputed: p.amount_disputed !== null && p.amount_disputed !== undefined ? Number(p.amount_disputed) : null,
    description: String(p.description || ""),
    desiredResolution: String(p.desired_resolution || ""),
    evidenceFiles: safeJsonParse<string[]>(p.evidence_files, []),
    adminResolutionNotes: String(p.admin_resolution_notes || ""),
    estimatedResponseDays: Number(p.estimated_response_days || 3),
    createdAt: String(p.created_at),
    updatedAt: String(p.updated_at),
    messages: msgs.map(serializePqrMessage),
  };
}

export function serializeAppProblem(prob: Record<string, unknown>, req?: Request) {
  const user = prob.user_id
    ? (db.prepare("SELECT id, email FROM users WHERE id = ?").get(prob.user_id as number) as
        | { id: number; email: string }
        | undefined)
    : undefined;
  const isPro = prob.user_id
    ? Boolean(db.prepare("SELECT id FROM professional_profiles WHERE user_id = ?").get(prob.user_id as number))
    : false;
  const atts = db
    .prepare("SELECT * FROM app_problem_attachments WHERE problem_id = ? ORDER BY id ASC")
    .all(prob.id as number) as Array<Record<string, unknown>>;

  return {
    id: `prob-${prob.id}`,
    ticketNumber: String(prob.ticket_number),
    title: String(prob.title || ""),
    category: String(prob.category || "error_mapa"),
    categoryLabel: String(prob.category_label || "Falla Técnica"),
    description: String(prob.description || ""),
    deviceInfo: String(prob.device_info || "Web"),
    version: String(prob.version || ""),
    reportedBy: String(prob.reported_by || ""),
    reportedByRole: isPro ? "Profesional" : user ? "Cliente" : "Usuario",
    userEmail: String(prob.user_email || user?.email || ""),
    status: String(prob.status || "recibido"),
    priority: String(prob.priority || ""),
    assignedTo: String(prob.assigned_to || ""),
    responseNotes: String(prob.response_notes || ""),
    createdAt: String(prob.created_at),
    attachments: atts.map((a) => {
      const fp = String(a.file_path || "");
      const ext = fp.split(".").pop()?.toLowerCase() || "";
      const rel = fp.startsWith("/") ? fp : `/media/${fp}`;
      return {
        id: Number(a.id),
        name: String(a.original_name || "archivo"),
        url: req ? absoluteUrl(req, rel) : rel,
        type: ["gif", "jpeg", "jpg", "png", "webp"].includes(ext) ? "image" : "file",
        size: Number(a.size_bytes || 0),
      };
    }),
  };
}

export { haversineKm };
