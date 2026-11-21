import { Router, type Response } from "express";
import { isStaffUser, requireAuth, type AuthedRequest } from "../auth.ts";
import {
  addNotification,
  db,
  haversineKm,
  loadPlatformSettings,
  nowIso,
  paginate,
  slugify,
} from "../db.ts";
import {
  serializeHousehold,
  serializeProfessionalDetail,
  serializeProfessionalList,
  serializeProfessionalMe,
} from "../serializers.ts";

const router = Router();

// ── Households ───────────────────────────────────────────────────────────────

router.get("/households/", requireAuth, (req: AuthedRequest, res: Response) => {
  const rows = db
    .prepare("SELECT * FROM households WHERE owner_id = ? ORDER BY is_default DESC, id ASC")
    .all(req.user!.id) as Array<Record<string, unknown>>;
  res.json(paginate(rows.map(serializeHousehold), req.query.page, req.query.page_size, req.originalUrl, 50));
});

router.post("/households/", requireAuth, (req: AuthedRequest, res: Response) => {
  const b = (req.body || {}) as Record<string, unknown>;
  const addressLine = String(b.address_line || "").trim();
  if (!addressLine) {
    res.status(400).json({ address_line: ["La direccion es obligatoria."] });
    return;
  }
  const countRow = db
    .prepare("SELECT COUNT(*) AS cnt FROM households WHERE owner_id = ?")
    .get(req.user!.id) as { cnt: number };
  const isDefault = b.is_default !== undefined ? Boolean(b.is_default) : countRow.cnt === 0;
  if (isDefault) {
    db.prepare("UPDATE households SET is_default = 0 WHERE owner_id = ?").run(req.user!.id);
  }
  const lat = b.latitude !== undefined && b.latitude !== null && b.latitude !== "" ? Number(b.latitude) : null;
  const lng = b.longitude !== undefined && b.longitude !== null && b.longitude !== "" ? Number(b.longitude) : null;
  const area = b.area_m2 !== undefined && b.area_m2 !== null && b.area_m2 !== "" ? Number(b.area_m2) : null;
  const buildYear = b.build_year !== undefined && b.build_year !== null && b.build_year !== "" ? Number(b.build_year) : null;

  const info = db
    .prepare(
      `INSERT INTO households (
        owner_id, label, property_type, address_line, neighborhood, city, country,
        latitude, longitude, area_m2, build_year, notes, is_default, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user!.id,
      String(b.label || "Mi hogar").trim() || "Mi hogar",
      String(b.property_type || "apartment"),
      addressLine,
      String(b.neighborhood || ""),
      String(b.city || req.user!.city || "Bogota"),
      String(b.country || "Colombia"),
      Number.isFinite(lat as number) ? lat : null,
      Number.isFinite(lng as number) ? lng : null,
      Number.isFinite(area as number) ? area : null,
      Number.isFinite(buildYear as number) ? buildYear : null,
      String(b.notes || ""),
      isDefault ? 1 : 0,
      nowIso()
    );

  const created = db.prepare("SELECT * FROM households WHERE id = ?").get(info.lastInsertRowid) as Record<
    string,
    unknown
  >;
  res.status(201).json(serializeHousehold(created));
});

router.get("/households/:id/", requireAuth, (req: AuthedRequest, res: Response) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM households WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row || (Number(row.owner_id) !== req.user!.id && !isStaffUser(req.user))) {
    res.status(404).json({ detail: "No encontrado." });
    return;
  }
  res.json(serializeHousehold(row));
});

router.patch("/households/:id/", requireAuth, (req: AuthedRequest, res: Response) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM households WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row || (Number(row.owner_id) !== req.user!.id && !isStaffUser(req.user))) {
    res.status(404).json({ detail: "No encontrado." });
    return;
  }
  const b = (req.body || {}) as Record<string, unknown>;
  if (b.is_default === true) {
    db.prepare("UPDATE households SET is_default = 0 WHERE owner_id = ?").run(Number(row.owner_id));
  }
  const fields: string[] = [];
  const values: Array<string | number | null> = [];
  for (const col of ["label", "property_type", "address_line", "neighborhood", "city", "country", "notes"]) {
    if (b[col] !== undefined) {
      fields.push(`${col} = ?`);
      values.push(String(b[col]));
    }
  }
  for (const numCol of ["latitude", "longitude", "area_m2", "build_year"]) {
    if (b[numCol] !== undefined) {
      const val = b[numCol] === null || b[numCol] === "" ? null : Number(b[numCol]);
      fields.push(`${numCol} = ?`);
      values.push(val !== null && Number.isFinite(val) ? val : null);
    }
  }
  if (b.is_default !== undefined) {
    fields.push("is_default = ?");
    values.push(b.is_default ? 1 : 0);
  }
  if (fields.length > 0) {
    values.push(id);
    db.prepare(`UPDATE households SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  }
  const updated = db.prepare("SELECT * FROM households WHERE id = ?").get(id) as Record<string, unknown>;
  res.json(serializeHousehold(updated));
});

router.delete("/households/:id/", requireAuth, (req: AuthedRequest, res: Response) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM households WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row || (Number(row.owner_id) !== req.user!.id && !isStaffUser(req.user))) {
    res.status(404).json({ detail: "No encontrado." });
    return;
  }
  db.prepare("DELETE FROM households WHERE id = ?").run(id);
  res.status(200).json({ ok: true, detail: "Vivienda eliminada." });
});

// ── Professionals: /me, /location, /benefit-redemptions ─────────────────────

function syncProfessionalServices(
  profileId: number,
  body: Record<string, unknown>
): string | null {
  const serviceIds = Array.isArray(body.service_ids) ? (body.service_ids as number[]) : undefined;
  let offerings = Array.isArray(body.service_offerings)
    ? (body.service_offerings as Array<Record<string, unknown>>)
    : undefined;
  const customServices = Array.isArray(body.custom_services)
    ? (body.custom_services as Array<Record<string, unknown>>)
    : undefined;

  const settings = loadPlatformSettings();
  const servicesEnabled = settings.features?.services !== false;

  if (!servicesEnabled) {
    const requested = new Set<number>(serviceIds || []);
    for (const off of offerings || []) requested.add(Number(off.service));
    const currentRows = db
      .prepare("SELECT service_id FROM professional_services WHERE profile_id = ?")
      .all(profileId) as Array<{ service_id: number }>;
    const currentSet = new Set(currentRows.map((r) => r.service_id));
    let addsNew = Boolean(customServices && customServices.length > 0);
    for (const id of requested) {
      if (!currentSet.has(id)) addsNew = true;
    }
    if (addsNew) {
      return "La publicacion de servicios esta desactivada por el administrador.";
    }
  }

  if (offerings === undefined && serviceIds !== undefined) {
    offerings = serviceIds.map((id) => ({ service: Number(id) }));
  }

  if (customServices && customServices.length > 0) {
    offerings = [...(offerings || [])];
    for (const item of customServices) {
      const catId = Number(item.category);
      const name = String(item.name || "").trim();
      const cat = db.prepare("SELECT id FROM service_categories WHERE id = ? AND is_active = 1").get(catId) as
        | { id: number }
        | undefined;
      if (!cat || !name) return "Selecciona categorias validas para servicios nuevos.";
      const pMin = item.price_min !== undefined && item.price_min !== null && item.price_min !== "" ? Number(item.price_min) : null;
      const pMax = item.price_max !== undefined && item.price_max !== null && item.price_max !== "" ? Number(item.price_max) : null;
      if (pMin !== null && pMax !== null && pMin > pMax) {
        return "La tarifa minima no puede superar la maxima.";
      }
      const sSlug = slugify(name);
      const existingSrv = db
        .prepare("SELECT id FROM services WHERE category_id = ? AND slug = ?")
        .get(catId, sSlug) as { id: number } | undefined;
      let serviceId: number;
      if (existingSrv) {
        serviceId = existingSrv.id;
        db.prepare(
          "UPDATE services SET name = ?, description = ?, price_min = ?, price_max = ?, is_active = 1 WHERE id = ?"
        ).run(
          name,
          String(item.description || ""),
          pMin !== null ? String(pMin) : null,
          pMax !== null ? String(pMax) : null,
          serviceId
        );
      } else {
        const resSrv = db
          .prepare(
            "INSERT INTO services (category_id, name, slug, description, keywords, price_min, price_max, estimated_hours, is_active) VALUES (?, ?, ?, ?, '[]', ?, ?, NULL, 1)"
          )
          .run(
            catId,
            name,
            sSlug,
            String(item.description || ""),
            pMin !== null ? String(pMin) : null,
            pMax !== null ? String(pMax) : null
          );
        serviceId = Number(resSrv.lastInsertRowid);
      }
      offerings.push({
        service: serviceId,
        price_min: item.price_min ?? null,
        price_max: item.price_max ?? null,
        observaciones: item.observaciones || "",
        years_experience: item.years_experience || 0,
      });
    }
  }

  if (offerings === undefined) return null;

  const byService = new Map<number, Record<string, unknown>>();
  for (const item of offerings) {
    const sid = Number(item.service);
    const srv = db
      .prepare(
        "SELECT s.id FROM services s JOIN service_categories c ON c.id = s.category_id WHERE s.id = ? AND s.is_active = 1 AND c.is_active = 1"
      )
      .get(sid);
    if (!srv) return "Selecciona servicios validos del catalogo.";
    const pMin = item.price_min !== undefined && item.price_min !== null && item.price_min !== "" ? Number(item.price_min) : null;
    const pMax = item.price_max !== undefined && item.price_max !== null && item.price_max !== "" ? Number(item.price_max) : null;
    if (pMin !== null && pMax !== null && pMin > pMax) {
      return "La tarifa minima no puede superar la maxima.";
    }
    byService.set(sid, item);
  }

  const keepIds = Array.from(byService.keys());
  if (keepIds.length > 0) {
    db.prepare(
      `DELETE FROM professional_services WHERE profile_id = ? AND service_id NOT IN (${keepIds.map(() => "?").join(",")})`
    ).run(profileId, ...keepIds);
  } else {
    db.prepare("DELETE FROM professional_services WHERE profile_id = ?").run(profileId);
  }

  for (const [sid, item] of byService.entries()) {
    const pMin = item.price_min !== undefined && item.price_min !== null && item.price_min !== "" ? String(item.price_min) : null;
    const pMax = item.price_max !== undefined && item.price_max !== null && item.price_max !== "" ? String(item.price_max) : null;
    const obs = String(item.observaciones || item.observations || "");
    const yrs = Math.max(0, Math.min(80, Number(item.years_experience || 0) || 0));
    const existing = db
      .prepare("SELECT id FROM professional_services WHERE profile_id = ? AND service_id = ?")
      .get(profileId, sid) as { id: number } | undefined;
    if (existing) {
      db.prepare(
        "UPDATE professional_services SET price_min = ?, price_max = ?, observations = ?, years_experience = ? WHERE id = ?"
      ).run(pMin, pMax, obs, yrs, existing.id);
    } else {
      db.prepare(
        "INSERT INTO professional_services (profile_id, service_id, price_min, price_max, observations, years_experience) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(profileId, sid, pMin, pMax, obs, yrs);
    }
  }
  return null;
}

function handleProfessionalMe(req: AuthedRequest, res: Response) {
  if (req.user!.role !== "professional") {
    res.status(403).json({ detail: "Solo los profesionales pueden gestionar este perfil." });
    return;
  }
  let profile = db
    .prepare("SELECT * FROM professional_profiles WHERE user_id = ?")
    .get(req.user!.id) as Record<string, unknown> | undefined;

  if (req.method === "GET") {
    if (!profile) {
      res.status(404).json({ detail: "Perfil profesional no encontrado." });
      return;
    }
    res.json(serializeProfessionalMe(profile));
    return;
  }

  const b = (req.body || {}) as Record<string, unknown>;
  if (req.method === "PATCH" && !profile) {
    res.status(404).json({ detail: "Perfil profesional no encontrado." });
    return;
  }

  if (!profile && req.method === "POST") {
    const displayName =
      String(b.display_name || `${req.user!.first_name} ${req.user!.last_name}`.trim() || req.user!.username).trim();
    const baseSlug = slugify(displayName);
    let uniqueSlug = baseSlug;
    let idx = 2;
    while (db.prepare("SELECT id FROM professional_profiles WHERE slug = ?").get(uniqueSlug)) {
      uniqueSlug = `${baseSlug}-${idx}`;
      idx += 1;
    }
    const lat = b.latitude !== undefined && b.latitude !== null && b.latitude !== "" ? Number(b.latitude) : null;
    const lng = b.longitude !== undefined && b.longitude !== null && b.longitude !== "" ? Number(b.longitude) : null;
    const resIns = db
      .prepare(
        `INSERT INTO professional_profiles (
          user_id, display_name, headline, slug, avatar_url, specialty_label, bio,
          latitude, longitude, neighborhood, city, coverage_radius_km, rating_avg,
          jobs_completed, response_time_minutes, is_verified, is_active, accepts_urgent,
          points, wallet_balance, created_at
        ) VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, '0.00', 0, ?, 0, 1, ?, 0, '0.00', ?)`
      )
      .run(
        req.user!.id,
        displayName,
        String(b.headline || ""),
        uniqueSlug,
        String(req.user!.avatar_url || ""),
        String(b.bio || ""),
        Number.isFinite(lat as number) ? lat : null,
        Number.isFinite(lng as number) ? lng : null,
        String(b.neighborhood || ""),
        String(b.city || req.user!.city || "Bogota"),
        Number(b.coverage_radius_km || 10) || 10,
        Number(b.response_time_minutes || 60) || 60,
        b.accepts_urgent ? 1 : 0,
        nowIso()
      );
    const createdId = Number(resIns.lastInsertRowid);
    const syncErr = syncProfessionalServices(createdId, b);
    if (syncErr) {
      db.prepare("DELETE FROM professional_profiles WHERE id = ?").run(createdId);
      res.status(400).json({ detail: syncErr });
      return;
    }
    profile = db.prepare("SELECT * FROM professional_profiles WHERE id = ?").get(createdId) as Record<string, unknown>;
    res.status(201).json(serializeProfessionalMe(profile));
    return;
  }

  // Update existing profile (POST or PATCH)
  const profileId = Number(profile!.id);
  const fields: string[] = [];
  const values: Array<string | number | null> = [];
  for (const col of ["display_name", "headline", "bio", "neighborhood", "city"]) {
    if (b[col] !== undefined) {
      fields.push(`${col} = ?`);
      values.push(String(b[col]));
    }
  }
  for (const numCol of ["latitude", "longitude"]) {
    if (b[numCol] !== undefined) {
      const val = b[numCol] === null || b[numCol] === "" ? null : Number(b[numCol]);
      fields.push(`${numCol} = ?`);
      values.push(val !== null && Number.isFinite(val) ? val : null);
    }
  }
  for (const intCol of ["coverage_radius_km", "response_time_minutes"]) {
    if (b[intCol] !== undefined) {
      fields.push(`${intCol} = ?`);
      values.push(Number(b[intCol]) || 10);
    }
  }
  if (b.accepts_urgent !== undefined) {
    fields.push("accepts_urgent = ?");
    values.push(b.accepts_urgent ? 1 : 0);
  }
  if (fields.length > 0) {
    values.push(profileId);
    db.prepare(`UPDATE professional_profiles SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  }

  const syncErr = syncProfessionalServices(profileId, b);
  if (syncErr) {
    res.status(400).json({ detail: syncErr });
    return;
  }
  const updated = db.prepare("SELECT * FROM professional_profiles WHERE id = ?").get(profileId) as Record<
    string,
    unknown
  >;
  res.json(serializeProfessionalMe(updated));
}

router.get("/professionals/me/", requireAuth, handleProfessionalMe);
router.post("/professionals/me/", requireAuth, handleProfessionalMe);
router.patch("/professionals/me/", requireAuth, handleProfessionalMe);

function handleProfessionalLocation(req: AuthedRequest, res: Response) {
  if (req.user!.role !== "professional") {
    res.status(403).json({ detail: "Solo los profesionales pueden actualizar su ubicación." });
    return;
  }
  const profile = db
    .prepare("SELECT * FROM professional_profiles WHERE user_id = ?")
    .get(req.user!.id) as Record<string, unknown> | undefined;
  if (!profile) {
    res.status(404).json({ detail: "Perfil profesional no encontrado." });
    return;
  }
  const lat = Number(req.body?.latitude);
  const lng = Number(req.body?.longitude);
  if (
    req.body?.latitude === undefined ||
    req.body?.longitude === undefined ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    res.status(400).json({ detail: "latitude y longitude son obligatorios." });
    return;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ detail: "Coordenadas fuera de rango válido." });
    return;
  }
  db.prepare("UPDATE professional_profiles SET latitude = ?, longitude = ? WHERE id = ?").run(
    lat,
    lng,
    profile.id as number
  );
  res.json({
    status: "ok",
    professional_id: Number(profile.id),
    latitude: lat,
    longitude: lng,
    updated_at: nowIso(),
  });
}

router.post("/professionals/location/", requireAuth, handleProfessionalLocation);
router.patch("/professionals/location/", requireAuth, handleProfessionalLocation);

router.get("/professionals/benefit-redemptions/", requireAuth, (req: AuthedRequest, res: Response) => {
  if (req.user!.role !== "professional") {
    res.status(403).json({ detail: "Solo los profesionales pueden gestionar sus beneficios." });
    return;
  }
  const profile = db
    .prepare("SELECT * FROM professional_profiles WHERE user_id = ?")
    .get(req.user!.id) as Record<string, unknown> | undefined;
  if (!profile) {
    res.status(404).json({ detail: "Perfil profesional no encontrado." });
    return;
  }
  const rows = db
    .prepare("SELECT * FROM benefit_redemptions WHERE profile_id = ? ORDER BY created_at DESC, id DESC")
    .all(profile.id as number) as Array<Record<string, unknown>>;
  res.json(
    rows.map((r) => ({
      id: Number(r.id),
      benefit_id: String(r.benefit_id),
      title: String(r.title),
      points: Number(r.points),
      recharge_amount: String(r.recharge_amount || "0.00"),
      status: String(r.status),
      created_at: String(r.created_at),
    }))
  );
});

router.post("/professionals/benefit-redemptions/", requireAuth, (req: AuthedRequest, res: Response) => {
  if (req.user!.role !== "professional") {
    res.status(403).json({ detail: "Solo los profesionales pueden gestionar sus beneficios." });
    return;
  }
  const settings = loadPlatformSettings();
  if (settings.features?.benefits === false) {
    res.status(403).json({ detail: "El sistema de beneficios está deshabilitado temporalmente." });
    return;
  }
  const profile = db
    .prepare("SELECT * FROM professional_profiles WHERE user_id = ?")
    .get(req.user!.id) as Record<string, unknown> | undefined;
  if (!profile) {
    res.status(404).json({ detail: "Perfil profesional no encontrado." });
    return;
  }
  const benefitId = String(req.body?.benefit_id || "").trim();
  if (!benefitId) {
    res.status(400).json({ benefit_id: "Selecciona un beneficio." });
    return;
  }
  const catalog = (settings.sections?.benefit_catalog || {}) as { items?: Array<Record<string, unknown>> };
  const items = Array.isArray(catalog.items) ? catalog.items : [];
  const benefit = items.find((item) => String(item.id || "") === benefitId);
  if (!benefit) {
    res.status(404).json({ detail: "El beneficio ya no está disponible." });
    return;
  }
  const points = Number(benefit.points || 0);
  const rechargeAmount = Number(benefit.recharge_amount || 0);
  const title = String(benefit.title || "").trim();
  if (!Number.isInteger(points) || points <= 0 || !Number.isFinite(rechargeAmount) || rechargeAmount < 0 || !title) {
    res.status(400).json({ benefit_id: "La configuración del beneficio no es válida." });
    return;
  }
  const currentPoints = Number(profile.points || 0);
  if (currentPoints < points) {
    res.status(400).json({ detail: "No tienes puntos suficientes para este beneficio." });
    return;
  }
  const remainingPoints = currentPoints - points;
  const nextWallet = Number(profile.wallet_balance || 0) + rechargeAmount;
  db.prepare("UPDATE professional_profiles SET points = ?, wallet_balance = ? WHERE id = ?").run(
    remainingPoints,
    nextWallet.toFixed(2),
    profile.id as number
  );
  const createdAt = nowIso();
  const ins = db
    .prepare(
      "INSERT INTO benefit_redemptions (profile_id, benefit_id, title, points, recharge_amount, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)"
    )
    .run(profile.id as number, benefitId, title.slice(0, 180), points, rechargeAmount.toFixed(2), createdAt);
  addNotification({
    userId: req.user!.id,
    title: "Beneficio canjeado",
    text: `Canjeaste "${title}" por ${points} puntos.`,
    type: "sistema",
  });
  res.status(201).json({
    id: Number(ins.lastInsertRowid),
    benefit_id: benefitId,
    title: title.slice(0, 180),
    points,
    recharge_amount: rechargeAmount.toFixed(2),
    status: "pending",
    created_at: createdAt,
    remaining_points: remainingPoints,
  });
});

// ── Professionals Public Search & Detail ─────────────────────────────────────

function loadActiveProfessionals() {
  return db
    .prepare("SELECT * FROM professional_profiles WHERE is_active = 1 ORDER BY is_verified DESC, CAST(rating_avg AS REAL) DESC, id ASC")
    .all() as Array<Record<string, unknown>>;
}

router.get("/professionals/", (req: AuthedRequest, res: Response) => {
  const category = req.query.category ? String(req.query.category).trim() : "";
  const service = req.query.service ? String(req.query.service).trim() : "";
  const priceMinRaw = req.query.price_min ? String(req.query.price_min).trim() : "";
  const priceMaxRaw = req.query.price_max ? String(req.query.price_max).trim() : "";
  const acceptsUrgent = ["1", "true", "True"].includes(String(req.query.accepts_urgent || ""));
  const search = req.query.search ? String(req.query.search).trim().toLowerCase() : "";
  const latParam = req.query.lat !== undefined && req.query.lat !== "" ? Number(req.query.lat) : null;
  const lngParam = req.query.lng !== undefined && req.query.lng !== "" ? Number(req.query.lng) : null;
  const radiusParam =
    req.query.radius_km !== undefined && req.query.radius_km !== "" ? Number(req.query.radius_km) : null;

  const pMin = priceMinRaw ? Number(priceMinRaw) : null;
  const pMax = priceMaxRaw ? Number(priceMaxRaw) : null;
  if (pMin !== null && !Number.isFinite(pMin)) {
    res.status(400).json({ price_min: "Debe ser un numero decimal." });
    return;
  }
  if (pMax !== null && !Number.isFinite(pMax)) {
    res.status(400).json({ price_max: "Debe ser un numero decimal." });
    return;
  }
  if (pMin !== null && pMax !== null && pMin > pMax) {
    res.status(400).json({ price_max: "El precio maximo debe ser mayor o igual al minimo." });
    return;
  }

  let rows = loadActiveProfessionals();

  // Exclude viewer's own profile from search results
  if (req.user) {
    rows = rows.filter((p) => Number(p.user_id) !== req.user!.id);
  }

  // Exclude professionals with unpaid completed orders (payment hold) for non-staff viewers
  if (!isStaffUser(req.user)) {
    const heldIds = new Set(
      (
        db
          .prepare(
            "SELECT DISTINCT professional_id FROM orders WHERE status = 'completed' AND payment_status = 'pending'"
          )
          .all() as Array<{ professional_id: number }>
      ).map((r) => r.professional_id)
    );
    rows = rows.filter((p) => !heldIds.has(Number(p.id)));
  }

  if (acceptsUrgent) {
    rows = rows.filter((p) => Boolean(p.accepts_urgent));
  }

  if (search) {
    rows = rows.filter((p) =>
      [p.display_name, p.headline, p.bio, p.neighborhood, p.specialty_label]
        .map((v) => String(v || "").toLowerCase())
        .some((txt) => txt.includes(search))
    );
  }

  if (category || service || pMin !== null || pMax !== null) {
    rows = rows.filter((p) => {
      const offerings = db
        .prepare(
          `SELECT ps.*, s.slug AS srv_slug, c.slug AS cat_slug
           FROM professional_services ps
           JOIN services s ON s.id = ps.service_id
           JOIN service_categories c ON c.id = s.category_id
           WHERE ps.profile_id = ? AND s.is_active = 1 AND c.is_active = 1`
        )
        .all(p.id as number) as Array<Record<string, unknown>>;

      return offerings.some((off) => {
        if (category && String(off.cat_slug) !== category) return false;
        if (service) {
          if (/^\d+$/.test(service)) {
            if (Number(off.service_id) !== Number(service)) return false;
          } else if (String(off.srv_slug) !== service) {
            return false;
          }
        }
        if (pMin !== null || pMax !== null) {
          if (off.price_min === null && off.price_max === null) return false;
          if (pMax !== null && off.price_min !== null && Number(off.price_min) > pMax) return false;
          if (pMin !== null && off.price_max !== null && Number(off.price_max) < pMin) return false;
        }
        return true;
      });
    });
  }

  const hasGeo =
    latParam !== null &&
    lngParam !== null &&
    Number.isFinite(latParam) &&
    Number.isFinite(lngParam);
  const settings = loadPlatformSettings();
  const defaultRadius = Number(settings.sections?.app_params?.default_radius_km || 15) || 15;
  const radiusKm = radiusParam !== null && Number.isFinite(radiusParam) ? radiusParam : defaultRadius;

  const enriched = rows
    .map((p) => {
      const dist = hasGeo
        ? haversineKm(
            latParam,
            lngParam,
            p.latitude !== null ? Number(p.latitude) : null,
            p.longitude !== null ? Number(p.longitude) : null
          )
        : null;
      return { prof: p, dist };
    })
    .filter((entry) => {
      if (!hasGeo) return true;
      return entry.dist !== null && entry.dist <= radiusKm;
    });

  if (hasGeo) {
    enriched.sort((a, b) => (a.dist ?? 99999) - (b.dist ?? 99999));
  }

  const serialized = enriched.map((entry) =>
    serializeProfessionalList(entry.prof, {
      viewerUser: req.user,
      serviceParam: service || null,
      distanceKm: entry.dist ?? undefined,
    })
  );

  res.json(paginate(serialized, req.query.page, req.query.page_size, req.originalUrl, 50));
});

router.get("/professionals/:lookup/", (req: AuthedRequest, res: Response) => {
  const lookup = String(req.params.lookup || "").trim();
  const rows = loadActiveProfessionals();
  let match: Record<string, unknown> | undefined;

  if (/^\d+$/.test(lookup)) {
    match = rows.find((p) => Number(p.id) === Number(lookup));
  }
  if (!match) {
    match = rows.find((p) => String(p.slug) === lookup);
  }
  if (!match) {
    match = rows.find((p) => {
      const u = db.prepare("SELECT username FROM users WHERE id = ?").get(p.user_id as number) as
        | { username: string }
        | undefined;
      return u?.username === lookup;
    });
  }
  if (!match) {
    match = rows.find((p) => slugify(String(p.display_name || "")) === lookup);
  }
  if (!match) {
    res.status(404).json({ detail: "Profesional no encontrado en la base de datos." });
    return;
  }

  const latParam = req.query.lat !== undefined && req.query.lat !== "" ? Number(req.query.lat) : null;
  const lngParam = req.query.lng !== undefined && req.query.lng !== "" ? Number(req.query.lng) : null;
  const dist =
    latParam !== null && lngParam !== null && Number.isFinite(latParam) && Number.isFinite(lngParam)
      ? haversineKm(
          latParam,
          lngParam,
          match.latitude !== null ? Number(match.latitude) : null,
          match.longitude !== null ? Number(match.longitude) : null
        )
      : undefined;

  res.json(
    serializeProfessionalDetail(match, {
      viewerUser: req.user,
      serviceParam: req.query.service ? String(req.query.service) : null,
      distanceKm: dist ?? undefined,
    })
  );
});

export default router;
