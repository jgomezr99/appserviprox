import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { isStaffUser, requireAuth, requireFeatureEnabled, requireStaff, type AuthedRequest } from "../auth.ts";
import { MEDIA_DIR, addAuditLog, addNotification, db, nowIso, paginate, safeJsonParse, slugify } from "../db.ts";
import {
  serializeService,
  serializeServiceCategoryDetail,
  serializeServiceCategoryList,
  serializeStoreProduct,
} from "../serializers.ts";

const router = Router();

const storeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 6 },
});

function saveProductImage(origName: string, buffer: Buffer): string {
  const dir = path.join(MEDIA_DIR, "products");
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(origName || "").toLowerCase() || ".jpg";
  const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `products/${filename}`;
}

// ── Diagnosis Engine (1:1 port of backend/apps/diagnosis/engine.py) ──────────

const STOP_WORDS = new Set([
  "a", "al", "algo", "como", "con", "de", "del", "el", "en", "es", "esta",
  "la", "las", "lo", "los", "mi", "me", "necesito", "para", "por", "que",
  "se", "un", "una", "unos", "unas", "y",
]);

function normalizeText(text: string): string {
  return (text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

function tokenize(text: string): Set<string> {
  const matches = normalizeText(text).match(/[a-z0-9]+/g) || [];
  return new Set(matches.filter((t) => !STOP_WORDS.has(t)));
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsPhrase(query: string, term: string): boolean {
  const normTerm = normalizeText(term);
  if (!normTerm) return false;
  return new RegExp(`(?<!\\w)${escapeRegExp(normTerm)}(?!\\w)`).test(query);
}

function scoreService(query: string, serviceRow: Record<string, unknown>): { score: number; matchedTerms: string[] } {
  let score = 0;
  const matchedTerms: string[] = [];
  const queryTokens = tokenize(query);
  const keywords = safeJsonParse<string[]>(serviceRow.keywords, []);

  for (const kw of keywords) {
    if (typeof kw !== "string" || !kw.trim()) continue;
    if (containsPhrase(query, kw)) {
      score += 6;
      matchedTerms.push(kw);
    } else {
      const kwTokens = tokenize(kw);
      let overlap = 0;
      for (const t of queryTokens) {
        if (kwTokens.has(t)) overlap += 1;
      }
      if (overlap > 0) {
        score += 1.5 * overlap;
        matchedTerms.push(kw);
      }
    }
  }

  const name = String(serviceRow.name || "");
  if (containsPhrase(query, name)) {
    score += 5;
    matchedTerms.push(name);
  } else {
    const nameTokens = tokenize(name);
    let overlap = 0;
    for (const t of queryTokens) {
      if (nameTokens.has(t)) overlap += 1;
    }
    if (overlap > 0) {
      score += 1.25 * overlap;
      matchedTerms.push(name);
    }
  }

  const descTokens = tokenize(String(serviceRow.description || ""));
  let descOverlap = 0;
  for (const t of queryTokens) {
    if (descTokens.has(t)) descOverlap += 1;
  }
  score += 0.35 * descOverlap;

  return { score, matchedTerms: Array.from(new Set(matchedTerms)) };
}

function suggestServices(description: string, optionIds: number[] = []) {
  const query = normalizeText(description);
  const queryTokens = tokenize(query);

  const categories = db
    .prepare("SELECT * FROM service_categories WHERE is_active = 1 ORDER BY sort_order ASC, name ASC")
    .all() as Array<Record<string, unknown>>;
  const catById = new Map<number, Record<string, unknown>>();
  const catBySlug = new Map<string, Record<string, unknown>>();
  const catScores = new Map<number, number>();
  const catReasons = new Map<number, string[]>();

  for (const c of categories) {
    const cid = Number(c.id);
    catById.set(cid, c);
    catBySlug.set(String(c.slug), c);
    catScores.set(cid, 0);
    catReasons.set(cid, []);
  }

  for (const c of categories) {
    const cid = Number(c.id);
    const kws = safeJsonParse<string[]>(c.keywords, []);
    for (const kw of kws) {
      if (typeof kw !== "string" || !kw.trim()) continue;
      if (containsPhrase(query, kw)) {
        catScores.set(cid, (catScores.get(cid) || 0) + 2.5);
        catReasons.get(cid)!.push(kw);
      } else {
        const kwTokens = tokenize(kw);
        let overlap = 0;
        for (const t of queryTokens) {
          if (kwTokens.has(t)) overlap += 1;
        }
        if (overlap > 0) {
          catScores.set(cid, (catScores.get(cid) || 0) + 0.75 * overlap);
          catReasons.get(cid)!.push(kw);
        }
      }
    }
    if (containsPhrase(query, String(c.name || ""))) {
      catScores.set(cid, (catScores.get(cid) || 0) + 2);
      catReasons.get(cid)!.push(String(c.name));
    } else {
      const descTokens = tokenize(String(c.description || ""));
      let descOverlap = 0;
      for (const t of queryTokens) {
        if (descTokens.has(t)) descOverlap += 1;
      }
      catScores.set(cid, (catScores.get(cid) || 0) + 0.4 * descOverlap);
    }
  }

  if (optionIds.length > 0) {
    const placeholders = optionIds.map(() => "?").join(",");
    const opts = db
      .prepare(`SELECT * FROM diagnostic_options WHERE id IN (${placeholders})`)
      .all(...optionIds) as Array<Record<string, unknown>>;
    for (const opt of opts) {
      const weights = safeJsonParse<Record<string, number>>(opt.weights, {});
      for (const [slug, weight] of Object.entries(weights)) {
        const c = catBySlug.get(slug);
        if (c) {
          const cid = Number(c.id);
          catScores.set(cid, (catScores.get(cid) || 0) + Number(weight || 0));
          catReasons.get(cid)!.push(String(opt.label || "").toLowerCase());
        }
      }
    }
  }

  const activeServices = db
    .prepare(
      `SELECT s.* FROM services s
       JOIN service_categories c ON c.id = s.category_id
       WHERE s.is_active = 1 AND c.is_active = 1
       ORDER BY c.sort_order ASC, s.name ASC, s.id ASC`
    )
    .all() as Array<Record<string, unknown>>;

  const serviceResults: Array<{ service: Record<string, unknown>; score: number; matchedTerms: string[]; sortOrder: number }> = [];
  for (const s of activeServices) {
    const { score, matchedTerms } = scoreService(query, s);
    if (score < 1.5) continue;
    const cat = catById.get(Number(s.category_id));
    serviceResults.push({
      service: s,
      score,
      matchedTerms,
      sortOrder: Number(cat?.sort_order || 0),
    });
    const cid = Number(s.category_id);
    catScores.set(cid, Math.max(catScores.get(cid) || 0, score));
    catReasons.get(cid)!.push(...matchedTerms);
  }

  serviceResults.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const cmp = String(a.service.name).localeCompare(String(b.service.name), "es");
    return cmp !== 0 ? cmp : Number(a.service.id) - Number(b.service.id);
  });

  const serviceRanking = serviceResults.slice(0, 5).map((r) => {
    const cat = catById.get(Number(r.service.category_id));
    return {
      id: Number(r.service.id),
      name: String(r.service.name),
      category: {
        id: Number(r.service.category_id),
        name: String(cat?.name || ""),
        slug: String(cat?.slug || ""),
        description: String(cat?.description || ""),
        icon_key: String(cat?.icon_key || "construct"),
        professionals_count: 0,
      },
      score: Math.round(r.score * 100) / 100,
      matched_terms: r.matchedTerms,
    };
  });

  const ranking = categories
    .map((c) => ({
      slug: String(c.slug),
      name: String(c.name),
      score: Math.round((catScores.get(Number(c.id)) || 0) * 100) / 100,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ca = Number(catBySlug.get(a.slug)?.sort_order || 0);
      const cb = Number(catBySlug.get(b.slug)?.sort_order || 0);
      if (ca !== cb) return ca - cb;
      return a.name.localeCompare(b.name, "es");
    });

  if (!ranking.length || ranking[0].score <= 0) {
    return {
      category: null,
      service: null,
      confidence: 0,
      rationale: "No encontramos una coincidencia clara. Prueba con otros términos o elige una categoría.",
      ranking,
      serviceRanking: [],
    };
  }

  const topService = serviceResults[0]?.service || null;
  const bestCat = catBySlug.get(ranking[0].slug) || null;
  const chosenCategory =
    topService && serviceResults[0].score >= ranking[0].score
      ? catById.get(Number(topService.category_id)) || bestCat
      : bestCat;

  const totalScore = ranking.reduce((acc, r) => acc + r.score, 0);
  const confidence = totalScore ? Math.round((ranking[0].score / totalScore) * 100) / 100 : 0;
  let matchedTerms = serviceResults[0]?.matchedTerms || [];
  if (!matchedTerms.length && chosenCategory) {
    matchedTerms = catReasons.get(Number(chosenCategory.id)) || [];
  }
  const uniqueMatched = Array.from(new Set(matchedTerms)).slice(0, 4);
  const rationale = uniqueMatched.length
    ? `Coincidencia con: ${uniqueMatched.join(", ")}.`
    : `Sugerimos ${chosenCategory ? chosenCategory.name : "una categoría"} por la descripción.`;

  return {
    category: chosenCategory,
    service: topService,
    confidence,
    rationale: rationale.slice(0, 300),
    ranking,
    serviceRanking,
  };
}

function serializeDiagnosticSession(row: Record<string, unknown>) {
  const cat = row.suggested_category_id
    ? (db.prepare("SELECT * FROM service_categories WHERE id = ?").get(row.suggested_category_id as number) as
        | Record<string, unknown>
        | undefined)
    : undefined;
  const srv = row.suggested_service_id
    ? (db.prepare("SELECT * FROM services WHERE id = ?").get(row.suggested_service_id as number) as
        | Record<string, unknown>
        | undefined)
    : undefined;
  return {
    id: Number(row.id),
    description: String(row.description),
    status: String(row.status),
    suggested_category: cat ? serializeServiceCategoryList(cat) : null,
    suggested_service: srv ? serializeService(srv) : null,
    confidence: Number(row.confidence || 0),
    rationale: String(row.rationale || ""),
    ranking: safeJsonParse<unknown[]>(row.ranking, []),
    service_ranking: safeJsonParse<unknown[]>(row.service_ranking, []),
    created_at: String(row.created_at),
  };
}

// ── Public Catalog ───────────────────────────────────────────────────────────

router.get("/categories/", (req: Request, res: Response) => {
  const search = String(req.query.search || "").trim().toLowerCase();
  let rows = db.prepare("SELECT * FROM service_categories WHERE is_active = 1 ORDER BY sort_order ASC, name ASC").all() as Array<
    Record<string, unknown>
  >;
  if (search) {
    rows = rows.filter(
      (r) =>
        String(r.name).toLowerCase().includes(search) ||
        String(r.description).toLowerCase().includes(search) ||
        String(r.keywords).toLowerCase().includes(search)
    );
  }
  const items = rows.map(serializeServiceCategoryList);
  res.json(paginate(items, req.query.page, req.query.page_size, req.originalUrl));
});

router.get("/categories/:slug/", (req: Request, res: Response) => {
  const row = db.prepare("SELECT * FROM service_categories WHERE slug = ? AND is_active = 1").get(String(req.params.slug)) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    res.status(404).json({ detail: "Categoría no encontrada." });
    return;
  }
  res.json(serializeServiceCategoryDetail(row));
});

router.get("/services/", (req: Request, res: Response) => {
  const catId = req.query.category ? Number.parseInt(String(req.query.category), 10) : null;
  const catSlug = String(req.query.category__slug || "").trim();
  const search = String(req.query.search || "").trim().toLowerCase();

  let rows = db
    .prepare(
      `SELECT s.*, c.slug AS cat_slug
       FROM services s
       JOIN service_categories c ON c.id = s.category_id
       WHERE s.is_active = 1 AND c.is_active = 1
       ORDER BY c.sort_order ASC, s.name ASC, s.id ASC`
    )
    .all() as Array<Record<string, unknown>>;

  if (catId && Number.isFinite(catId)) {
    rows = rows.filter((r) => Number(r.category_id) === catId);
  }
  if (catSlug) {
    rows = rows.filter((r) => String(r.cat_slug) === catSlug);
  }
  if (search) {
    rows = rows.filter(
      (r) => String(r.name).toLowerCase().includes(search) || String(r.description).toLowerCase().includes(search)
    );
  }

  res.json(paginate(rows.map(serializeService), req.query.page, req.query.page_size, req.originalUrl));
});

router.get("/services/:id/", (req: Request, res: Response) => {
  const id = Number.parseInt(String(req.params.id), 10);
  const row = Number.isFinite(id)
    ? (db
        .prepare(
          `SELECT s.* FROM services s JOIN service_categories c ON c.id = s.category_id
           WHERE s.id = ? AND s.is_active = 1 AND c.is_active = 1`
        )
        .get(id) as Record<string, unknown> | undefined)
    : undefined;
  if (!row) {
    res.status(404).json({ detail: "Servicio no encontrado." });
    return;
  }
  res.json(serializeService(row));
});

// ── Meko Shop Store Products ─────────────────────────────────────────────────

router.get("/store/products/", (req: AuthedRequest, res: Response) => {
  const includeAll = req.query.include_all === "true" || req.query.include_all === "1";
  const category = String(req.query.category || "").trim();
  const city = String(req.query.city || "").trim();
  const search = String(req.query.search || "").trim().toLowerCase();

  let rows = (
    includeAll
      ? db.prepare("SELECT * FROM store_products ORDER BY id DESC").all()
      : db.prepare("SELECT * FROM store_products WHERE is_active = 1 ORDER BY id DESC").all()
  ) as Array<Record<string, unknown>>;

  if (category) rows = rows.filter((r) => String(r.category).toLowerCase() === category.toLowerCase());
  if (city) rows = rows.filter((r) => String(r.city).toLowerCase() === city.toLowerCase());
  if (search) {
    rows = rows.filter(
      (r) =>
        String(r.title).toLowerCase().includes(search) ||
        String(r.description).toLowerCase().includes(search) ||
        String(r.seller_name).toLowerCase().includes(search) ||
        String(r.city).toLowerCase().includes(search)
    );
  }

  const viewerId = req.user?.id;
  res.json(
    rows.map((r) => ({
      ...serializeStoreProduct(r, req),
      is_owner: Boolean(viewerId && Number(r.owner_id) === viewerId),
    }))
  );
});

router.get("/store/products/:id/", (req: AuthedRequest, res: Response) => {
  const id = Number.parseInt(String(req.params.id), 10);
  const row = Number.isFinite(id)
    ? (db.prepare("SELECT * FROM store_products WHERE id = ?").get(id) as Record<string, unknown> | undefined)
    : undefined;
  if (!row) {
    res.status(404).json({ detail: "Producto no encontrado." });
    return;
  }
  res.json({
    ...serializeStoreProduct(row, req),
    is_owner: Boolean(req.user && Number(row.owner_id) === req.user.id),
  });
});

router.get("/store/products/:id/image/", (req: Request, res: Response) => {
  const id = Number.parseInt(String(req.params.id), 10);
  const row = Number.isFinite(id)
    ? (db.prepare("SELECT image FROM store_products WHERE id = ?").get(id) as { image: string } | undefined)
    : undefined;
  if (!row || !row.image) {
    res.status(404).json({ detail: "Imagen no encontrada." });
    return;
  }
  if (row.image.startsWith("data:") || /^https?:\/\//i.test(row.image)) {
    res.redirect(row.image);
    return;
  }
  const fullPath = path.join(MEDIA_DIR, row.image.replace(/^\/?media\//, ""));
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ detail: "Archivo de imagen no encontrado." });
    return;
  }
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.sendFile(fullPath);
});

router.post("/store/products/", requireAuth, storeUpload.array("image", 6), (req: AuthedRequest, res: Response) => {
  const featErr = requireFeatureEnabled("products", "La tienda de productos está deshabilitada temporalmente.");
  if (featErr) {
    res.status(403).json({ detail: featErr });
    return;
  }
  const user = req.user!;
  const body = req.body || {};
  const title = String(body.title || "").trim();
  if (!title) {
    res.status(400).json({ detail: "El título del producto es obligatorio." });
    return;
  }

  const files = (req.files as Express.Multer.File[]) || [];
  const uploadedPaths = files.map((f) => `/media/${saveProductImage(f.originalname, f.buffer)}`);
  const bodyImages = safeJsonParse<string[]>(body.images, []);
  const imageUrlBody = String(body.image_url || "").trim();

  const allImages = Array.from(
    new Set([
      ...(imageUrlBody ? [imageUrlBody] : []),
      ...bodyImages.filter((u) => typeof u === "string" && u.trim()),
      ...uploadedPaths,
    ])
  ).slice(0, 6);

  const primaryImage = allImages[0] || "";
  const fullName = `${user.first_name} ${user.last_name}`.trim();
  const sellerRoleDefault = user.role === "staff" ? "Administrador" : user.role === "professional" ? "Contratista" : "Cliente";
  const sellerName =
    String(body.seller_name || "").trim() ||
    (user.role === "staff" ? "Administrador Serviprox" : fullName || user.email);

  const ts = nowIso();
  const resIns = db
    .prepare(
      `INSERT INTO store_products (
        owner_id, title, category, price, stock, condition, description,
        seller_name, seller_email, seller_username, seller_role, seller_blocked,
        phone, city, image, images, is_active, review_status, review_notes,
        reviewed_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      user.id,
      title,
      String(body.category || "Otros").trim(),
      Math.max(0, Math.round(Number(body.price || 0))),
      Math.max(0, Math.round(Number(body.stock ?? 1))),
      String(body.condition || "Nuevo").trim(),
      String(body.description || "").trim(),
      sellerName,
      String(body.seller_email || user.email).trim(),
      String(body.seller_username || user.username).trim(),
      String(body.seller_role || sellerRoleDefault).trim(),
      String(body.phone || user.phone || "").trim(),
      String(body.city || user.city || "Bogotá").trim(),
      primaryImage,
      JSON.stringify(allImages),
      body.is_active === "false" || body.is_active === false ? 0 : 1,
      String(body.review_status || "aprobado"),
      String(body.review_notes || ""),
      String(body.reviewed_by || ""),
      ts,
      ts
    );

  const created = db.prepare("SELECT * FROM store_products WHERE id = ?").get(Number(resIns.lastInsertRowid)) as Record<
    string,
    unknown
  >;
  res.status(201).json({ ...serializeStoreProduct(created, req), is_owner: true });
});

router.patch("/store/products/:id/", requireAuth, storeUpload.array("image", 6), (req: AuthedRequest, res: Response) => {
  const id = Number.parseInt(String(req.params.id), 10);
  const existing = Number.isFinite(id)
    ? (db.prepare("SELECT * FROM store_products WHERE id = ?").get(id) as Record<string, unknown> | undefined)
    : undefined;
  if (!existing) {
    res.status(404).json({ detail: "Producto no encontrado." });
    return;
  }
  if (Number(existing.owner_id) !== req.user!.id && !isStaffUser(req.user)) {
    res.status(403).json({ detail: "Solo el autor o administrador puede editar esta publicación." });
    return;
  }

  const body = req.body || {};
  const updates: string[] = [];
  const vals: Array<string | number | null> = [];

  for (const field of ["title", "category", "condition", "description", "phone", "city", "review_status", "review_notes", "reviewed_by"]) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      vals.push(String(body[field]));
    }
  }
  if (body.price !== undefined) {
    updates.push("price = ?");
    vals.push(Math.max(0, Math.round(Number(body.price || 0))));
  }
  if (body.stock !== undefined) {
    updates.push("stock = ?");
    vals.push(Math.max(0, Math.round(Number(body.stock || 0))));
  }
  if (body.is_active !== undefined) {
    updates.push("is_active = ?");
    vals.push(body.is_active === false || body.is_active === "false" ? 0 : 1);
  }
  if (body.review_status !== undefined) {
    updates.push("reviewed_at = ?");
    vals.push(nowIso());
  }

  const files = (req.files as Express.Multer.File[]) || [];
  const uploadedPaths = files.map((f) => `/media/${saveProductImage(f.originalname, f.buffer)}`);
  if (body.image_url !== undefined || body.images !== undefined || uploadedPaths.length > 0) {
    const bodyImages = safeJsonParse<string[]>(body.images, []);
    const primaryCandidate = String(body.image_url || "").trim();
    const combined = Array.from(
      new Set([...(primaryCandidate ? [primaryCandidate] : []), ...bodyImages, ...uploadedPaths].filter(Boolean))
    ).slice(0, 6);
    updates.push("image = ?", "images = ?");
    vals.push(combined[0] || primaryCandidate || String(existing.image || ""), JSON.stringify(combined));
  }

  updates.push("updated_at = ?");
  vals.push(nowIso(), id);

  db.prepare(`UPDATE store_products SET ${updates.join(", ")} WHERE id = ?`).run(...vals);
  const updated = db.prepare("SELECT * FROM store_products WHERE id = ?").get(id) as Record<string, unknown>;
  res.json({
    ...serializeStoreProduct(updated, req),
    is_owner: Number(updated.owner_id) === req.user!.id,
  });
});

router.post("/store/products/:id/report/", requireAuth, (req: AuthedRequest, res: Response) => {
  const id = Number.parseInt(String(req.params.id), 10);
  const existing = Number.isFinite(id)
    ? (db.prepare("SELECT * FROM store_products WHERE id = ?").get(id) as Record<string, unknown> | undefined)
    : undefined;
  if (!existing) {
    res.status(404).json({ detail: "Producto no encontrado." });
    return;
  }

  const body = req.body || {};
  const reason = String(body.reason || "Reporte de publicación").trim();
  const description = String(body.description || reason).trim();
  const hideProduct = Boolean(body.hide_product ?? body.hideProduct);
  const blockPublisher = Boolean(body.block_publisher ?? body.blockPublisher);
  const ts = nowIso();

  const nextReports = Number(existing.reports_count || 0) + 1;
  db.prepare(
    `UPDATE store_products SET reports_count = ?, last_report_reason = ?,
     is_active = ?, review_status = ?, seller_blocked = ?, updated_at = ? WHERE id = ?`
  ).run(
    nextReports,
    reason,
    hideProduct ? 0 : Number(existing.is_active),
    hideProduct ? "observado" : String(existing.review_status || "aprobado"),
    blockPublisher ? 1 : Number(existing.seller_blocked),
    ts,
    id
  );

  if (blockPublisher && existing.owner_id) {
    db.prepare("UPDATE users SET is_blocked = 1, is_active = 0, block_reason = ?, blocked_at = ? WHERE id = ?").run(
      `Bloqueo por reporte en tienda: ${reason}`,
      ts,
      Number(existing.owner_id)
    );
  }

  const year = new Date().getFullYear();
  let radicado = `PQR-PROD-${year}-${String(crypto.randomInt(1000, 9999))}`;
  while (db.prepare("SELECT id FROM pqr_reports WHERE radicado_number = ?").get(radicado)) {
    radicado = `PQR-PROD-${year}-${String(crypto.randomInt(1000, 9999))}`;
  }
  const reporterName = String(
    body.reporter_name || `${req.user!.first_name} ${req.user!.last_name}`.trim() || req.user!.username
  );
  const reporterEmail = String(body.reporter_email || req.user!.email);
  const productTitle = String(existing.title || "");
  const sellerName = String(existing.seller_name || "");
  const relatedLabel = `Producto #${id}: ${productTitle}`;

  const pqrInsert = db.prepare(
    `INSERT INTO pqr_reports (
      radicado_number, client_id, client_name, client_phone, client_email, client_document_id, client_address,
      contractor_name, contractor_company, contractor_specialty, contractor_avatar,
      pqr_type, subject_type, product_id, product_name, reason, status, priority, related_to,
      incident_date, description, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queja', 'producto', ?, ?, ?, 'radicado', ?, ?, ?, ?, ?, ?)`
  ).run(
    radicado,
    req.user!.id,
    reporterName,
    String(req.user!.phone || ""),
    reporterEmail,
    String(req.user!.document_id || ""),
    String(req.user!.address || ""),
    sellerName,
    `Meko Shop · ${sellerName || "Vendedor"}`,
    String(existing.category || "Producto Meko Shop"),
    String(existing.image_url || ""),
    id,
    productTitle,
    reason,
    String(body.priority || "Media"),
    relatedLabel,
    ts.slice(0, 10),
    description,
    ts,
    ts
  );

  const pqrId = Number(pqrInsert.lastInsertRowid);
  db.prepare(
    "INSERT INTO pqr_messages (pqr_id, sender, sender_name, sender_role, text, timestamp) VALUES (?, 'system', 'Serviprox', 'Sistema', ?, ?)"
  ).run(pqrId, `Reporte de producto ${radicado} registrado en Serviprox.`, ts);

  addNotification({
    userId: null,
    title: `Nuevo PQR de Producto: ${radicado}`,
    text: `${reporterName} reportó el producto "${productTitle}" (${reason}).`,
    type: "pqr",
    link: "pqr",
    targetId: radicado,
  });

  const updated = db.prepare("SELECT * FROM store_products WHERE id = ?").get(id) as Record<string, unknown>;
  res.json({
    ok: true,
    message: `Reporte ${radicado} generado contra ${sellerName || "publicador"}.`,
    publisher_blocked: blockPublisher,
    radicado_number: radicado,
    product: serializeStoreProduct(updated, req),
  });
});

router.delete("/store/products/:id/", requireAuth, (req: AuthedRequest, res: Response) => {
  const id = Number.parseInt(String(req.params.id), 10);
  const existing = Number.isFinite(id)
    ? (db.prepare("SELECT * FROM store_products WHERE id = ?").get(id) as Record<string, unknown> | undefined)
    : undefined;
  if (!existing) {
    res.status(404).json({ detail: "Producto no encontrado." });
    return;
  }
  if (Number(existing.owner_id) !== req.user!.id && !isStaffUser(req.user)) {
    res.status(403).json({ detail: "Solo el autor puede eliminar esta publicación." });
    return;
  }
  db.prepare("DELETE FROM store_products WHERE id = ?").run(id);
  res.status(200).json({ ok: true, detail: "Producto eliminado." });
});

// ── Admin Catalog ────────────────────────────────────────────────────────────

function serializeAdminCategory(cat: Record<string, unknown>) {
  const cnt = (db.prepare("SELECT COUNT(*) AS cnt FROM services WHERE category_id = ?").get(cat.id as number) as { cnt: number }).cnt;
  return {
    id: Number(cat.id),
    name: String(cat.name),
    slug: String(cat.slug),
    description: String(cat.description || ""),
    icon_key: String(cat.icon_key || "construct"),
    keywords: safeJsonParse<string[]>(cat.keywords, []),
    sort_order: Number(cat.sort_order || 0),
    is_active: Boolean(cat.is_active),
    services_count: cnt,
  };
}

function serializeAdminService(srv: Record<string, unknown>) {
  const cat = db.prepare("SELECT id, name, is_active FROM service_categories WHERE id = ?").get(srv.category_id as number) as
    | { id: number; name: string; is_active: number }
    | undefined;
  const prosCnt = (
    db
      .prepare(
        "SELECT COUNT(DISTINCT profile_id) AS cnt FROM professional_services ps JOIN professional_profiles pp ON pp.id = ps.profile_id WHERE ps.service_id = ? AND pp.is_active = 1"
      )
      .get(srv.id as number) as { cnt: number }
  ).cnt;
  return {
    id: Number(srv.id),
    category: Number(srv.category_id),
    category_name: cat?.name || "",
    category_active: Boolean(cat?.is_active ?? true),
    name: String(srv.name),
    slug: String(srv.slug),
    description: String(srv.description || ""),
    keywords: safeJsonParse<string[]>(srv.keywords, []),
    price_min: srv.price_min !== null && srv.price_min !== undefined ? String(srv.price_min) : null,
    price_max: srv.price_max !== null && srv.price_max !== undefined ? String(srv.price_max) : null,
    estimated_hours: srv.estimated_hours !== null && srv.estimated_hours !== undefined ? String(srv.estimated_hours) : null,
    is_active: Boolean(srv.is_active),
    professionals_count: prosCnt,
  };
}

router.get("/admin/catalog/categories/", requireStaff, (req: AuthedRequest, res: Response) => {
  const rows = db.prepare("SELECT * FROM service_categories ORDER BY sort_order ASC, name ASC").all() as Array<
    Record<string, unknown>
  >;
  res.json(paginate(rows.map(serializeAdminCategory), req.query.page, req.query.page_size, req.originalUrl, 100));
});

router.post("/admin/catalog/categories/", requireStaff, (req: AuthedRequest, res: Response) => {
  const body = req.body || {};
  const name = String(body.name || "").trim();
  if (!name) {
    res.status(400).json({ name: ["El nombre es obligatorio."] });
    return;
  }
  let slug = slugify(String(body.slug || name));
  let suffix = 1;
  while (db.prepare("SELECT id FROM service_categories WHERE slug = ?").get(slug)) {
    slug = `${slugify(name)}-${suffix}`;
    suffix += 1;
  }
  const resIns = db
    .prepare(
      "INSERT INTO service_categories (name, slug, description, icon_key, keywords, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      name,
      slug,
      String(body.description || ""),
      String(body.icon_key || "construct"),
      JSON.stringify(Array.isArray(body.keywords) ? body.keywords : []),
      Number(body.sort_order || 0),
      body.is_active === false ? 0 : 1
    );
  const created = db.prepare("SELECT * FROM service_categories WHERE id = ?").get(Number(resIns.lastInsertRowid)) as Record<
    string,
    unknown
  >;
  addAuditLog(req.user!.email, "Categoría creada", name, "", req.user!.id);
  res.status(201).json(serializeAdminCategory(created));
});

router.patch("/admin/catalog/categories/:id/", requireStaff, (req: AuthedRequest, res: Response) => {
  const id = Number.parseInt(String(req.params.id), 10);
  const existing = db.prepare("SELECT * FROM service_categories WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!existing) {
    res.status(404).json({ detail: "Categoría no encontrada." });
    return;
  }
  const body = req.body || {};
  const name = body.name !== undefined ? String(body.name).trim() : String(existing.name);
  db.prepare(
    "UPDATE service_categories SET name = ?, description = ?, icon_key = ?, keywords = ?, sort_order = ?, is_active = ? WHERE id = ?"
  ).run(
    name,
    body.description !== undefined ? String(body.description) : String(existing.description),
    body.icon_key !== undefined ? String(body.icon_key) : String(existing.icon_key),
    body.keywords !== undefined ? JSON.stringify(body.keywords) : String(existing.keywords),
    body.sort_order !== undefined ? Number(body.sort_order) : Number(existing.sort_order),
    body.is_active !== undefined ? (body.is_active ? 1 : 0) : Number(existing.is_active),
    id
  );
  const updated = db.prepare("SELECT * FROM service_categories WHERE id = ?").get(id) as Record<string, unknown>;
  res.json(serializeAdminCategory(updated));
});

router.delete("/admin/catalog/categories/:id/", requireStaff, (req: AuthedRequest, res: Response) => {
  const id = Number.parseInt(String(req.params.id), 10);
  const existing = db.prepare("SELECT * FROM service_categories WHERE id = ?").get(id);
  if (!existing) {
    res.status(404).json({ detail: "Categoría no encontrada." });
    return;
  }
  db.prepare("DELETE FROM service_categories WHERE id = ?").run(id);
  res.status(200).json({ ok: true, detail: "Categoría eliminada." });
});

router.get("/admin/catalog/services/", requireStaff, (req: AuthedRequest, res: Response) => {
  const rows = db
    .prepare(
      `SELECT s.* FROM services s JOIN service_categories c ON c.id = s.category_id
       ORDER BY c.sort_order ASC, s.name ASC, s.id ASC`
    )
    .all() as Array<Record<string, unknown>>;
  res.json(paginate(rows.map(serializeAdminService), req.query.page, req.query.page_size, req.originalUrl, 100));
});

router.post("/admin/catalog/services/", requireStaff, (req: AuthedRequest, res: Response) => {
  const body = req.body || {};
  const categoryId = Number(body.category);
  const name = String(body.name || "").trim();
  if (!Number.isFinite(categoryId) || !db.prepare("SELECT id FROM service_categories WHERE id = ?").get(categoryId)) {
    res.status(400).json({ category: ["Categoría inválida."] });
    return;
  }
  if (!name) {
    res.status(400).json({ name: ["El nombre es obligatorio."] });
    return;
  }
  let slug = slugify(String(body.slug || name));
  let suffix = 1;
  while (db.prepare("SELECT id FROM services WHERE category_id = ? AND slug = ?").get(categoryId, slug)) {
    slug = `${slugify(name)}-${suffix}`;
    suffix += 1;
  }
  const resIns = db
    .prepare(
      `INSERT INTO services (category_id, name, slug, description, keywords, price_min, price_max, estimated_hours, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      categoryId,
      name,
      slug,
      String(body.description || ""),
      JSON.stringify(Array.isArray(body.keywords) ? body.keywords : []),
      body.price_min !== undefined && body.price_min !== null && body.price_min !== "" ? String(body.price_min) : null,
      body.price_max !== undefined && body.price_max !== null && body.price_max !== "" ? String(body.price_max) : null,
      body.estimated_hours !== undefined && body.estimated_hours !== null && body.estimated_hours !== ""
        ? String(body.estimated_hours)
        : null,
      body.is_active === false ? 0 : 1
    );
  const created = db.prepare("SELECT * FROM services WHERE id = ?").get(Number(resIns.lastInsertRowid)) as Record<string, unknown>;
  addAuditLog(req.user!.email, "Servicio creado", name, "", req.user!.id);
  res.status(201).json(serializeAdminService(created));
});

router.patch("/admin/catalog/services/:id/", requireStaff, (req: AuthedRequest, res: Response) => {
  const id = Number.parseInt(String(req.params.id), 10);
  const existing = db.prepare("SELECT * FROM services WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ detail: "Servicio no encontrado." });
    return;
  }
  const body = req.body || {};
  db.prepare(
    `UPDATE services SET category_id = ?, name = ?, description = ?, keywords = ?,
     price_min = ?, price_max = ?, estimated_hours = ?, is_active = ? WHERE id = ?`
  ).run(
    body.category !== undefined ? Number(body.category) : Number(existing.category_id),
    body.name !== undefined ? String(body.name).trim() : String(existing.name),
    body.description !== undefined ? String(body.description) : String(existing.description),
    body.keywords !== undefined ? JSON.stringify(body.keywords) : String(existing.keywords),
    body.price_min !== undefined ? (body.price_min === "" || body.price_min === null ? null : String(body.price_min)) : (existing.price_min as string | null),
    body.price_max !== undefined ? (body.price_max === "" || body.price_max === null ? null : String(body.price_max)) : (existing.price_max as string | null),
    body.estimated_hours !== undefined ? (body.estimated_hours === "" || body.estimated_hours === null ? null : String(body.estimated_hours)) : (existing.estimated_hours as string | null),
    body.is_active !== undefined ? (body.is_active ? 1 : 0) : Number(existing.is_active),
    id
  );
  const updated = db.prepare("SELECT * FROM services WHERE id = ?").get(id) as Record<string, unknown>;
  res.json(serializeAdminService(updated));
});

router.delete("/admin/catalog/services/:id/", requireStaff, (req: AuthedRequest, res: Response) => {
  const id = Number.parseInt(String(req.params.id), 10);
  if (!db.prepare("SELECT id FROM services WHERE id = ?").get(id)) {
    res.status(404).json({ detail: "Servicio no encontrado." });
    return;
  }
  db.prepare("DELETE FROM services WHERE id = ?").run(id);
  res.status(200).json({ ok: true, detail: "Servicio eliminado." });
});

router.post("/admin/catalog/suggestions/preview/", requireStaff, (req: AuthedRequest, res: Response) => {
  const description = String(req.body?.description || "").trim();
  const s = suggestServices(description);
  res.json({
    suggested_category: s.category ? serializeServiceCategoryList(s.category) : null,
    suggested_service: s.service ? serializeService(s.service) : null,
    confidence: s.confidence,
    rationale: s.rationale,
    ranking: s.ranking,
    service_ranking: s.serviceRanking,
  });
});

// ── Diagnosis ────────────────────────────────────────────────────────────────

router.get("/diagnosis/questions/", (_req: Request, res: Response) => {
  const questions = db
    .prepare("SELECT * FROM diagnostic_questions WHERE is_active = 1 ORDER BY sort_order ASC, id ASC")
    .all() as Array<Record<string, unknown>>;
  const payload = questions.map((q) => {
    const options = db
      .prepare("SELECT id, value, label, sort_order FROM diagnostic_options WHERE question_id = ? ORDER BY sort_order ASC, id ASC")
      .all(q.id as number) as Array<Record<string, unknown>>;
    return {
      id: Number(q.id),
      code: String(q.code),
      text: String(q.text),
      help_text: String(q.help_text || ""),
      order: Number(q.sort_order || 0),
      is_required: Boolean(q.is_required),
      options: options.map((o) => ({
        id: Number(o.id),
        value: String(o.value),
        label: String(o.label),
        order: Number(o.sort_order || 0),
      })),
    };
  });
  res.json(payload);
});

router.get("/diagnosis/sessions/", requireAuth, (req: AuthedRequest, res: Response) => {
  const rows = db
    .prepare("SELECT * FROM diagnostic_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50")
    .all(req.user!.id) as Array<Record<string, unknown>>;
  res.json(rows.map(serializeDiagnosticSession));
});

router.get("/diagnosis/sessions/:id/", (req: AuthedRequest, res: Response) => {
  const id = Number.parseInt(String(req.params.id), 10);
  const row = Number.isFinite(id)
    ? (db.prepare("SELECT * FROM diagnostic_sessions WHERE id = ?").get(id) as Record<string, unknown> | undefined)
    : undefined;
  if (!row || (row.user_id && req.user && Number(row.user_id) !== req.user.id && !isStaffUser(req.user))) {
    res.status(404).json({ detail: "Sesión no encontrada." });
    return;
  }
  res.json(serializeDiagnosticSession(row));
});

router.post("/diagnosis/sessions/", (req: AuthedRequest, res: Response) => {
  const description = String(req.body?.description || "").trim();
  if (!description) {
    res.status(400).json({ description: ["Describe el problema que necesitas resolver."] });
    return;
  }
  const answers = Array.isArray(req.body?.answers) ? (req.body.answers as Array<{ question?: number; option?: number }>) : [];
  const optionIds = answers.map((a) => Number(a.option)).filter((n) => Number.isFinite(n));
  const suggestion = suggestServices(description, optionIds);

  const ts = nowIso();
  const resIns = db
    .prepare(
      `INSERT INTO diagnostic_sessions (
        user_id, description, status, suggested_category_id, suggested_service_id,
        confidence, rationale, ranking, service_ranking, created_at
      ) VALUES (?, ?, 'suggested', ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user?.id ?? null,
      description,
      suggestion.category ? Number(suggestion.category.id) : null,
      suggestion.service ? Number(suggestion.service.id) : null,
      suggestion.confidence,
      suggestion.rationale,
      JSON.stringify(suggestion.ranking),
      JSON.stringify(suggestion.serviceRanking),
      ts
    );
  const sessionId = Number(resIns.lastInsertRowid);
  for (const a of answers) {
    if (a.question && a.option) {
      db.prepare("INSERT INTO diagnostic_answers (session_id, question_id, option_id) VALUES (?, ?, ?)").run(
        sessionId,
        Number(a.question),
        Number(a.option)
      );
    }
  }
  const created = db.prepare("SELECT * FROM diagnostic_sessions WHERE id = ?").get(sessionId) as Record<string, unknown>;
  res.status(201).json(serializeDiagnosticSession(created));
});

router.patch("/diagnosis/sessions/:id/", (req: AuthedRequest, res: Response) => {
  const id = Number.parseInt(String(req.params.id), 10);
  const row = Number.isFinite(id)
    ? (db.prepare("SELECT * FROM diagnostic_sessions WHERE id = ?").get(id) as Record<string, unknown> | undefined)
    : undefined;
  if (!row) {
    res.status(404).json({ detail: "Sesión no encontrada." });
    return;
  }
  const statusVal = String(req.body?.status || row.status);
  db.prepare("UPDATE diagnostic_sessions SET status = ? WHERE id = ?").run(statusVal, id);
  const updated = db.prepare("SELECT * FROM diagnostic_sessions WHERE id = ?").get(id) as Record<string, unknown>;
  res.json(serializeDiagnosticSession(updated));
});

export default router;
