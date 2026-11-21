import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router, type Response } from "express";
import multer from "multer";
import { findUserById, isStaffUser, requireAuth, type AuthedRequest } from "../auth.ts";
import { addNotification, db, loadPlatformSettings, MEDIA_DIR, nowIso, paginate } from "../db.ts";
import { serializeAppProblem, serializePqrMessage, serializePqrReport } from "../serializers.ts";

const router = Router();

const problemUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

const CLOSED_PQR_STATUSES = new Set([
  "resuelto",
  "resuelta",
  "cerrado",
  "cerrada",
  "sancionado",
  "sancionada",
  "rechazado",
  "cancelado",
]);

function saveAttachmentFile(origName: string, buffer: Buffer): string {
  const dir = path.join(MEDIA_DIR, "app_problems");
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(origName || "").toLowerCase() || ".bin";
  const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `app_problems/${filename}`;
}

function resolvePqrRow(rawId: string): Record<string, unknown> | undefined {
  const clean = String(rawId || "").trim();
  const numeric = clean.startsWith("pqr-") ? clean.slice(4) : clean;
  if (/^\d+$/.test(numeric)) {
    return db.prepare("SELECT * FROM pqr_reports WHERE id = ?").get(Number(numeric)) as
      | Record<string, unknown>
      | undefined;
  }
  return db.prepare("SELECT * FROM pqr_reports WHERE radicado_number = ?").get(clean) as
    | Record<string, unknown>
    | undefined;
}

function canViewPqr(pqr: Record<string, unknown>, req: AuthedRequest): boolean {
  if (isStaffUser(req.user)) return true;
  if (!req.user) return false;
  if (pqr.client_id && Number(pqr.client_id) === req.user.id) return true;
  if (
    pqr.client_email &&
    String(pqr.client_email).toLowerCase() === req.user.email.toLowerCase()
  ) {
    return true;
  }
  return false;
}

type TranscriptInput = {
  sender?: string;
  senderName?: string;
  text?: string;
};

function parseChatTranscript(raw: unknown): Array<{ sender: string; senderName: string; text: string }> {
  let list: unknown = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, 40)
    .map((item) => {
      const rec = (item && typeof item === "object" ? item : {}) as TranscriptInput;
      return {
        sender: String(rec.sender || "user").trim().toLowerCase(),
        senderName: String(rec.senderName || "").trim(),
        text: String(rec.text || "").trim(),
      };
    })
    .filter((m) => m.text.length > 0);
}

function serializeSupportChatMessage(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    chatId: Number(row.chat_id),
    sender: String(row.sender || "user"),
    senderName: String(row.sender_name || ""),
    text: String(row.text || ""),
    createdAt: String(row.created_at || ""),
  };
}

function serializeSupportChat(row: Record<string, unknown>) {
  const msgs = db
    .prepare("SELECT * FROM support_chat_messages WHERE chat_id = ? ORDER BY id ASC")
    .all(Number(row.id)) as Array<Record<string, unknown>>;
  const serializedMsgs = msgs.map(serializeSupportChatMessage);
  const last = serializedMsgs[serializedMsgs.length - 1];
  return {
    id: Number(row.id),
    userId: row.user_id !== null && row.user_id !== undefined ? Number(row.user_id) : null,
    userName: String(row.user_name || ""),
    userEmail: String(row.user_email || ""),
    title: String(row.title || "Chat de soporte"),
    topic: String(row.topic || "soporte"),
    relatedPqrId: row.related_pqr_id !== null && row.related_pqr_id !== undefined ? Number(row.related_pqr_id) : null,
    relatedRadicado: String(row.related_radicado || ""),
    status: String(row.status || "abierto"),
    messagesCount: serializedMsgs.length,
    lastMessage: last ? last.text : "",
    messages: serializedMsgs,
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

function createLinkedSupportChat(params: {
  userId: number | null;
  userName: string;
  userEmail: string;
  title: string;
  topic: string;
  relatedPqrId?: number | null;
  relatedRadicado?: string;
  transcript: Array<{ sender: string; senderName: string; text: string }>;
  fallbackUserMessage: string;
  systemConfirmation: string;
  ts: string;
}): number {
  const insChat = db
    .prepare(
      `INSERT INTO support_chats (
        user_id, user_name, user_email, title, topic, related_pqr_id, related_radicado, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'abierto', ?, ?)`
    )
    .run(
      params.userId,
      params.userName || "Usuario",
      params.userEmail || "",
      params.title.slice(0, 160),
      params.topic,
      params.relatedPqrId ?? null,
      params.relatedRadicado || "",
      params.ts,
      params.ts
    );
  const chatId = Number(insChat.lastInsertRowid);
  const insertMsg = db.prepare(
    "INSERT INTO support_chat_messages (chat_id, sender, sender_name, text, created_at) VALUES (?, ?, ?, ?, ?)"
  );

  if (params.transcript.length > 0) {
    for (const item of params.transcript) {
      const normalizedSender =
        item.sender === "agent" || item.sender === "support_agent"
          ? "agent"
          : item.sender === "admin"
            ? "admin"
            : item.sender === "system"
              ? "system"
              : "user";
      const senderName =
        item.senderName ||
        (normalizedSender === "agent"
          ? "Sofía • Soporte Serviprox"
          : normalizedSender === "system"
            ? "Serviprox"
            : params.userName || "Usuario");
      insertMsg.run(chatId, normalizedSender, senderName, item.text, params.ts);
    }
  } else if (params.fallbackUserMessage) {
    insertMsg.run(chatId, "user", params.userName || "Usuario", params.fallbackUserMessage, params.ts);
  }

  insertMsg.run(chatId, "system", "Serviprox", params.systemConfirmation, params.ts);
  return chatId;
}

// ── PQR Reports ──────────────────────────────────────────────────────────────

router.get("/pqrs/", (req: AuthedRequest, res: Response) => {
  const email = req.query.email ? String(req.query.email).trim() : "";
  const rawSubjectFilter = String(req.query.subject_type ?? req.query.subjectType ?? "").toLowerCase().trim();
  const subjectFilter: "servicio" | "producto" | "" =
    rawSubjectFilter === "producto" ? "producto" : rawSubjectFilter === "servicio" ? "servicio" : "";
  const user = req.user;

  let rows: Array<Record<string, unknown>> = [];
  if (email) {
    if (isStaffUser(user) || (user && user.email.toLowerCase() === email.toLowerCase())) {
      rows = db
        .prepare(
          `SELECT p.* FROM pqr_reports p
           LEFT JOIN users u ON u.id = p.client_id
           WHERE LOWER(p.client_email) = LOWER(?) OR LOWER(u.email) = LOWER(?)
           ORDER BY p.created_at DESC, p.id DESC`
        )
        .all(email, email) as Array<Record<string, unknown>>;
    }
  } else if (isStaffUser(user)) {
    rows = db.prepare("SELECT * FROM pqr_reports ORDER BY created_at DESC, id DESC").all() as Array<
      Record<string, unknown>
    >;
  } else if (user) {
    rows = db
      .prepare(
        "SELECT * FROM pqr_reports WHERE client_id = ? OR LOWER(client_email) = LOWER(?) ORDER BY created_at DESC, id DESC"
      )
      .all(user.id, user.email) as Array<Record<string, unknown>>;
  }

  let serialized = rows.map(serializePqrReport);
  if (subjectFilter) {
    serialized = serialized.filter((item) => item.subjectType === subjectFilter);
  }

  res.json(
    paginate(serialized, req.query.page, req.query.page_size, req.originalUrl, 50)
  );
});

router.post("/pqrs/", (req: AuthedRequest, res: Response) => {
  const settings = loadPlatformSettings();
  if (!isStaffUser(req.user) && settings.features?.pqr === false) {
    res.status(403).json({ detail: "Los PQR están deshabilitados temporalmente." });
    return;
  }

  const d = (req.body || {}) as Record<string, unknown>;
  const rawSubject = String(d.subjectType ?? d.subject_type ?? "").toLowerCase().trim();
  const rawProductId = d.productId ?? d.product_id;
  const parsedProductId =
    rawProductId !== null && rawProductId !== undefined && /^\d+$/.test(String(rawProductId).trim())
      ? Number.parseInt(String(rawProductId).trim(), 10)
      : null;
  let productName = String(d.productName ?? d.product_name ?? "").trim();
  let relatedTo = String(d.relatedTo ?? d.related_to ?? "").trim();

  const subjectType: "servicio" | "producto" =
    rawSubject === "producto" ||
    parsedProductId !== null ||
    Boolean(productName) ||
    relatedTo.toLowerCase().startsWith("producto #")
      ? "producto"
      : "servicio";

  const year = new Date().getFullYear();
  const radicadoPrefix = subjectType === "producto" ? "PQR-PROD" : "PQR-SERV";
  let radicado = String(d.radicadoNumber || d.radicado_number || "").trim();
  if (!radicado) {
    radicado = `${radicadoPrefix}-${year}-${crypto.randomInt(1000, 9999)}`;
    while (db.prepare("SELECT id FROM pqr_reports WHERE radicado_number = ?").get(radicado)) {
      radicado = `${radicadoPrefix}-${year}-${crypto.randomInt(1000, 9999)}`;
    }
  }

  let clientId: number | null = null;
  let clientName = String(d.clientName ?? d.client_name ?? "").trim();
  let clientPhone = String(d.clientPhone ?? d.client_phone ?? "").trim();
  let clientEmail = String(d.clientEmail ?? d.client_email ?? "").trim();
  let clientDoc = String(d.clientDocumentId ?? d.client_document_id ?? "").trim();
  let clientAddress = String(d.clientAddress ?? d.client_address ?? "").trim();

  if (!req.user || isStaffUser(req.user)) {
    let found: Record<string, unknown> | undefined;
    if (clientEmail) {
      found = db
        .prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)")
        .get(clientEmail) as Record<string, unknown> | undefined;
    } else if (clientName) {
      found = db
        .prepare(
          "SELECT * FROM users WHERE LOWER(TRIM(first_name || ' ' || last_name)) = LOWER(?) OR LOWER(username) = LOWER(?) LIMIT 1"
        )
        .get(clientName, clientName) as Record<string, unknown> | undefined;
    }
    if (found) {
      clientId = Number(found.id);
      if (!clientEmail && found.email) clientEmail = String(found.email);
      if (!clientName) clientName = `${found.first_name || ""} ${found.last_name || ""}`.trim();
      if (!clientPhone && found.phone) clientPhone = String(found.phone);
      if (!clientDoc && found.document_id) clientDoc = String(found.document_id);
      if (!clientAddress && found.address) clientAddress = String(found.address);
    }
  }

  if (req.user && !isStaffUser(req.user)) {
    clientId = req.user.id;
    const full = `${req.user.first_name} ${req.user.last_name}`.trim();
    if (!clientName && full) clientName = full;
    if (!clientPhone && req.user.phone) clientPhone = req.user.phone;
    if (!clientEmail && req.user.email) clientEmail = req.user.email;
    if (!clientDoc && req.user.document_id) clientDoc = req.user.document_id;
    if (!clientAddress && req.user.address) clientAddress = req.user.address;
  }

  const contractorRef = String(d.contractorId ?? d.contractor_id_ref ?? "").trim();
  let contractorName = String(d.contractorName ?? d.contractor_name ?? "").trim();
  let contractorCompany = String(d.contractorCompany ?? d.contractor_company ?? "").trim();
  let contractorSpecialty = String(d.contractorSpecialty ?? d.contractor_specialty ?? "").trim();
  let contractorAvatar = String(d.contractorAvatar ?? d.contractor_avatar ?? "").trim();
  let contractorId: number | null = null;
  let productId: number | null = null;

  if (subjectType === "producto") {
    let prod: Record<string, unknown> | undefined;
    if (parsedProductId !== null) {
      prod = db.prepare("SELECT * FROM store_products WHERE id = ?").get(parsedProductId) as
        | Record<string, unknown>
        | undefined;
    } else if (productName) {
      prod = db
        .prepare("SELECT * FROM store_products WHERE LOWER(title) LIKE LOWER(?) LIMIT 1")
        .get(`%${productName}%`) as Record<string, unknown> | undefined;
    }
    if (prod) {
      productId = Number(prod.id);
      if (!productName) productName = String(prod.title || "");
      if (!contractorName && prod.seller_name) contractorName = String(prod.seller_name);
      if (!contractorCompany) contractorCompany = `Meko Shop · ${String(prod.seller_name || "Vendedor")}`;
      if (!contractorSpecialty && prod.category) contractorSpecialty = String(prod.category);
      if (!contractorAvatar && prod.image_url) contractorAvatar = String(prod.image_url);
      if (!relatedTo) relatedTo = `Producto #${productId}: ${productName}`;
    } else {
      if (!productName && relatedTo) productName = relatedTo;
      if (!relatedTo && productName) relatedTo = `Producto: ${productName}`;
      if (!contractorCompany) contractorCompany = "Meko Shop · Producto";
      if (!contractorSpecialty) contractorSpecialty = "Producto de Tienda";
    }
  } else if (contractorRef) {
    let prof: Record<string, unknown> | undefined;
    if (/^\d+$/.test(contractorRef)) {
      prof = db.prepare("SELECT * FROM professional_profiles WHERE id = ?").get(Number(contractorRef)) as
        | Record<string, unknown>
        | undefined;
    }
    if (!prof) {
      prof = db.prepare("SELECT * FROM professional_profiles WHERE slug = ?").get(contractorRef) as
        | Record<string, unknown>
        | undefined;
    }
    if (!prof && contractorName) {
      prof = db
        .prepare("SELECT * FROM professional_profiles WHERE LOWER(display_name) LIKE LOWER(?) LIMIT 1")
        .get(`%${contractorName}%`) as Record<string, unknown> | undefined;
    }
    if (prof) {
      contractorId = Number(prof.id);
      if (!contractorName) contractorName = String(prof.display_name || "");
      if (!contractorCompany && prof.headline) contractorCompany = String(prof.headline);
      if (!contractorSpecialty && prof.specialty_label) contractorSpecialty = String(prof.specialty_label);
      if (!contractorAvatar && prof.avatar_url) contractorAvatar = String(prof.avatar_url);
    }
  }

  if (subjectType === "servicio" && !relatedTo) {
    const svcTitle = String(d.serviceTitle ?? d.service_title ?? "").trim();
    relatedTo = svcTitle || contractorCompany || contractorName || "Servicio Serviprox";
  }

  const incidentDate =
    String(d.incidentDate ?? d.incident_date ?? "").trim() || new Date().toISOString().slice(0, 10);
  const rawAmt = d.amountDisputed ?? d.amount_disputed;
  const amountDisputed =
    rawAmt === "" || rawAmt === null || rawAmt === undefined || rawAmt === "null" ? null : String(rawAmt);
  const evidenceFiles = Array.isArray(d.evidenceFiles ?? d.evidence_files)
    ? JSON.stringify(d.evidenceFiles ?? d.evidence_files)
    : "[]";
  const ts = nowIso();
  const pqrType = String(d.type ?? d.pqr_type ?? "queja");

  const ins = db
    .prepare(
      `INSERT INTO pqr_reports (
        radicado_number, client_id, client_name, client_phone, client_email, client_document_id, client_address,
        contractor_id, contractor_id_ref, contractor_name, contractor_company, contractor_specialty, contractor_avatar,
        pqr_type, subject_type, product_id, product_name, reason, status, priority, assigned_to, related_to,
        incident_date, amount_disputed, description, desired_resolution, evidence_files, admin_resolution_notes,
        estimated_response_days, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      radicado,
      clientId,
      clientName,
      clientPhone,
      clientEmail,
      clientDoc,
      clientAddress,
      contractorId,
      contractorRef,
      contractorName,
      contractorCompany,
      contractorSpecialty,
      contractorAvatar,
      pqrType,
      subjectType,
      productId,
      productName,
      String(d.reason || ""),
      String(d.status || "radicado"),
      String(d.priority || "Media"),
      String(d.assignedTo ?? d.assigned_to ?? ""),
      relatedTo,
      incidentDate,
      amountDisputed,
      String(d.description || ""),
      String(d.desiredResolution ?? d.desired_resolution ?? ""),
      evidenceFiles,
      String(d.adminResolutionNotes ?? d.admin_resolution_notes ?? ""),
      Number(d.estimatedResponseDays ?? d.estimated_response_days ?? 3) || 3,
      ts,
      ts
    );

  const pqrId = Number(ins.lastInsertRowid);
  const scopeLabel = subjectType === "producto" ? "Producto" : "Servicio";
  const insertPqrMsg = db.prepare(
    "INSERT INTO pqr_messages (pqr_id, sender, sender_name, sender_role, text, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
  );
  insertPqrMsg.run(
    pqrId,
    "system",
    "Serviprox",
    "Sistema",
    `Solicitud ${radicado} (${scopeLabel}) registrada en Serviprox.`,
    ts
  );

  const descriptionText = String(d.description || "").trim();
  const transcript = parseChatTranscript(d.chatTranscript ?? d.chat_transcript);
  if (transcript.length > 0) {
    for (const item of transcript) {
      const pqrSender =
        item.sender === "agent" || item.sender === "support_agent"
          ? "support_agent"
          : item.sender === "system"
            ? "system"
            : "client";
      const sName =
        item.senderName ||
        (pqrSender === "support_agent"
          ? "Sofía • Defensoría y Soporte"
          : pqrSender === "system"
            ? "Serviprox"
            : clientName || "Cliente");
      const sRole =
        pqrSender === "support_agent"
          ? "Soporte"
          : pqrSender === "system"
            ? "Sistema"
            : "Cliente";
      insertPqrMsg.run(pqrId, pqrSender, sName, sRole, item.text, ts);
    }
  } else if (descriptionText) {
    insertPqrMsg.run(pqrId, "client", clientName || "Cliente", "Cliente", descriptionText, ts);
  }

  let linkedChatId: number | null = null;
  if (clientId || clientEmail) {
    linkedChatId = createLinkedSupportChat({
      userId: clientId,
      userName: clientName || "Cliente",
      userEmail: clientEmail,
      title: `Reporte ${radicado} · ${relatedTo || scopeLabel}`,
      topic: subjectType === "producto" ? "pqr_producto" : "pqr_servicio",
      relatedPqrId: pqrId,
      relatedRadicado: radicado,
      transcript,
      fallbackUserMessage: descriptionText || `Nuevo PQR de ${scopeLabel} sobre ${relatedTo || scopeLabel}`,
      systemConfirmation: `Reporte ${radicado} (${scopeLabel}) y chat sincronizados con soporte y administración.`,
      ts,
    });
  }

  addNotification({
    userId: null,
    title: `Nuevo PQR de ${scopeLabel}: ${radicado}`,
    text: `${clientName || "Cliente"} registró una solicitud (${pqrType}) sobre ${relatedTo || scopeLabel}.`,
    type: "pqr",
    link: "pqr",
    targetId: radicado,
  });

  const created = db.prepare("SELECT * FROM pqr_reports WHERE id = ?").get(pqrId) as Record<string, unknown>;
  res.status(201).json({
    ...serializePqrReport(created),
    ...(linkedChatId ? { chatId: linkedChatId } : {}),
  });
});

router.get("/pqrs/:id/", (req: AuthedRequest, res: Response) => {
  const row = resolvePqrRow(String(req.params.id));
  if (!row || !canViewPqr(row, req)) {
    res.status(404).json({ detail: "No encontrado." });
    return;
  }
  res.json(serializePqrReport(row));
});

router.patch("/pqrs/:id/", (req: AuthedRequest, res: Response) => {
  const row = resolvePqrRow(String(req.params.id));
  if (!row || !canViewPqr(row, req)) {
    res.status(404).json({ detail: "No encontrado." });
    return;
  }
  const d = (req.body || {}) as Record<string, unknown>;
  const fields: string[] = [];
  const vals: Array<string | number | null> = [];
  const mapping: Array<[string[], string]> = [
    [["status"], "status"],
    [["priority"], "priority"],
    [["assignedTo", "assigned_to"], "assigned_to"],
    [["adminResolutionNotes", "admin_resolution_notes"], "admin_resolution_notes"],
    [["desiredResolution", "desired_resolution"], "desired_resolution"],
    [["description"], "description"],
    [["reason"], "reason"],
    [["relatedTo", "related_to"], "related_to"],
  ];
  for (const [keys, col] of mapping) {
    const val = keys.map((k) => d[k]).find((v) => v !== undefined);
    if (val !== undefined) {
      fields.push(`${col} = ?`);
      vals.push(String(val));
    }
  }
  fields.push("updated_at = ?");
  vals.push(nowIso());
  vals.push(Number(row.id));
  db.prepare(`UPDATE pqr_reports SET ${fields.join(", ")} WHERE id = ?`).run(...vals);
  const updated = db.prepare("SELECT * FROM pqr_reports WHERE id = ?").get(Number(row.id)) as Record<
    string,
    unknown
  >;
  res.json(serializePqrReport(updated));
});

router.delete("/pqrs/:id/", (req: AuthedRequest, res: Response) => {
  const row = resolvePqrRow(String(req.params.id));
  if (!row || !canViewPqr(row, req)) {
    res.status(404).json({ detail: "No encontrado." });
    return;
  }
  db.prepare("DELETE FROM pqr_reports WHERE id = ?").run(Number(row.id));
  res.status(200).json({ ok: true, detail: "PQR eliminada." });
});

router.post("/pqrs/:id/messages/", (req: AuthedRequest, res: Response) => {
  const settings = loadPlatformSettings();
  if (!isStaffUser(req.user) && settings.features?.pqr === false) {
    res.status(403).json({ detail: "Los PQR están deshabilitados temporalmente." });
    return;
  }
  const row = resolvePqrRow(String(req.params.id));
  if (!row) {
    res.status(404).json({ detail: "PQR no encontrado." });
    return;
  }
  const statusStr = String(row.status || "").toLowerCase().trim();
  if (CLOSED_PQR_STATUSES.has(statusStr)) {
    res.status(400).json({
      error: `Este caso PQR se encuentra ${row.status}. No es posible enviar más mensajes o respuestas a un trámite cerrado.`,
    });
    return;
  }
  const text = String(req.body?.text || "").trim();
  if (!text) {
    res.status(400).json({ error: "El mensaje no puede estar vacío." });
    return;
  }
  const sender = String(req.body?.sender || (isStaffUser(req.user) ? "admin" : "client"));
  const defaultSender = req.user
    ? `${req.user.first_name} ${req.user.last_name}`.trim() || req.user.username
    : String(row.client_name || "Cliente");
  const senderName = String(req.body?.senderName ?? req.body?.sender_name ?? defaultSender);
  const senderRole = String(
    req.body?.senderRole ?? req.body?.sender_role ?? (isStaffUser(req.user) ? "Administrador" : "Cliente")
  );
  const ts = nowIso();
  const ins = db
    .prepare(
      "INSERT INTO pqr_messages (pqr_id, sender, sender_name, sender_role, text, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(Number(row.id), sender, senderName, senderRole, text, ts);
  db.prepare("UPDATE pqr_reports SET updated_at = ? WHERE id = ?").run(ts, Number(row.id));
  const msg = db.prepare("SELECT * FROM pqr_messages WHERE id = ?").get(ins.lastInsertRowid) as Record<
    string,
    unknown
  >;
  res.status(201).json(serializePqrMessage(msg));
});

router.post("/pqrs/:id/cancel/", (req: AuthedRequest, res: Response) => {
  const row = resolvePqrRow(String(req.params.id));
  if (!row || !canViewPqr(row, req)) {
    res.status(404).json({ detail: "PQR no encontrado." });
    return;
  }
  db.prepare(
    "UPDATE pqr_reports SET status = 'resuelto', admin_resolution_notes = 'Desistimiento voluntario por parte del usuario.', updated_at = ? WHERE id = ?"
  ).run(nowIso(), Number(row.id));
  const updated = db.prepare("SELECT * FROM pqr_reports WHERE id = ?").get(Number(row.id)) as Record<
    string,
    unknown
  >;
  res.json(serializePqrReport(updated));
});

// ── App Problem Reports ──────────────────────────────────────────────────────

function resolveProblemRow(rawId: string): Record<string, unknown> | undefined {
  const clean = String(rawId || "").trim();
  const numeric = clean.startsWith("prob-") ? clean.slice(5) : clean;
  if (/^\d+$/.test(numeric)) {
    return db.prepare("SELECT * FROM app_problem_reports WHERE id = ?").get(Number(numeric)) as
      | Record<string, unknown>
      | undefined;
  }
  return db.prepare("SELECT * FROM app_problem_reports WHERE ticket_number = ?").get(clean) as
    | Record<string, unknown>
    | undefined;
}

router.get("/app-problems/", (req: AuthedRequest, res: Response) => {
  const email = req.query.email ? String(req.query.email).trim() : "";
  const all = req.query.all === "true";
  const user = req.user;

  let rows: Array<Record<string, unknown>> = [];
  if (all && isStaffUser(user)) {
    rows = db.prepare("SELECT * FROM app_problem_reports ORDER BY created_at DESC, id DESC").all() as Array<
      Record<string, unknown>
    >;
  } else if (email) {
    if (isStaffUser(user) || (user && user.email.toLowerCase() === email.toLowerCase())) {
      rows = db
        .prepare(
          `SELECT r.* FROM app_problem_reports r
           LEFT JOIN users u ON u.id = r.user_id
           WHERE LOWER(r.user_email) = LOWER(?) OR LOWER(u.email) = LOWER(?)
           ORDER BY r.created_at DESC, r.id DESC`
        )
        .all(email, email) as Array<Record<string, unknown>>;
    }
  } else if (isStaffUser(user)) {
    rows = db.prepare("SELECT * FROM app_problem_reports ORDER BY created_at DESC, id DESC").all() as Array<
      Record<string, unknown>
    >;
  } else if (user) {
    rows = db
      .prepare(
        "SELECT * FROM app_problem_reports WHERE user_id = ? OR LOWER(user_email) = LOWER(?) ORDER BY created_at DESC, id DESC"
      )
      .all(user.id, user.email) as Array<Record<string, unknown>>;
  }

  res.json(
    paginate(
      rows.map((r) => serializeAppProblem(r, req)),
      req.query.page,
      req.query.page_size,
      req.originalUrl,
      50
    )
  );
});

router.post(
  "/app-problems/",
  problemUpload.array("attachments", 5),
  (req: AuthedRequest, res: Response) => {
    const settings = loadPlatformSettings();
    if (!isStaffUser(req.user) && settings.features?.pqr === false) {
      res.status(403).json({ detail: "Los reportes de problemas están deshabilitados temporalmente." });
      return;
    }

    const d = (req.body || {}) as Record<string, unknown>;
    const year = new Date().getFullYear();
    let ticket = String(d.ticketNumber ?? d.ticket_number ?? "").trim();
    if (!ticket) {
      ticket = `APP-BUG-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
      while (db.prepare("SELECT id FROM app_problem_reports WHERE ticket_number = ?").get(ticket)) {
        ticket = `APP-BUG-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
      }
    }

    let userId: number | null = req.user ? req.user.id : null;
    let userEmail = String(d.userEmail ?? d.user_email ?? "");
    let reportedBy = String(d.reportedBy ?? d.reported_by ?? "");

    if (!userId && userEmail) {
      const found = db
        .prepare("SELECT * FROM users WHERE LOWER(email) = LOWER(?)")
        .get(userEmail) as Record<string, unknown> | undefined;
      if (found) {
        userId = Number(found.id);
        if (!reportedBy) {
          reportedBy = `${found.first_name || ""} ${found.last_name || ""}`.trim() || String(found.username);
        }
      }
    }
    if (req.user) {
      if (!userEmail && req.user.email) userEmail = req.user.email;
      const full = `${req.user.first_name} ${req.user.last_name}`.trim() || req.user.username;
      if (!reportedBy && full) reportedBy = full;
    }

    const ts = nowIso();
    const ins = db
      .prepare(
        `INSERT INTO app_problem_reports (
          ticket_number, user_id, title, user_email, category, category_label, description,
          device_info, version, reported_by, status, priority, assigned_to, response_notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        ticket,
        userId,
        String(d.title || ""),
        userEmail,
        String(d.category || "error_mapa"),
        String(d.categoryLabel ?? d.category_label ?? "Falla Técnica"),
        String(d.description || "Reporte de problema técnico."),
        String(d.deviceInfo ?? d.device_info ?? "Android / Web"),
        String(d.version || ""),
        reportedBy,
        String(d.status || "recibido"),
        String(d.priority || ""),
        String(d.assignedTo ?? d.assigned_to ?? ""),
        String(d.responseNotes ?? d.response_notes ?? ""),
        ts
      );
    const problemId = Number(ins.lastInsertRowid);

    const files = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];
    for (const file of files) {
      const rel = saveAttachmentFile(file.originalname || "adjunto.bin", file.buffer);
      db.prepare(
        "INSERT INTO app_problem_attachments (problem_id, file_path, original_name, content_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(problemId, rel, file.originalname || "adjunto", file.mimetype || "", file.size || file.buffer.length, ts);
    }

    const problemDescription = String(d.description || "Reporte de problema técnico.").trim();
    const problemCatLabel = String(d.categoryLabel ?? d.category_label ?? "Falla Técnica");
    const transcript = parseChatTranscript(d.chatTranscript ?? d.chat_transcript);

    // También registrar un PQR formal asociado con su número de radicado oficial
    let pqrRadicado = `PQR-APP-${year}-${crypto.randomInt(1000, 9999)}`;
    while (db.prepare("SELECT id FROM pqr_reports WHERE radicado_number = ?").get(pqrRadicado)) {
      pqrRadicado = `PQR-APP-${year}-${crypto.randomInt(1000, 9999)}`;
    }
    const insPqr = db
      .prepare(
        `INSERT INTO pqr_reports (
          radicado_number, client_id, client_name, client_phone, client_email, client_document_id, client_address,
          contractor_id, contractor_id_ref, contractor_name, contractor_company, contractor_specialty, contractor_avatar,
          pqr_type, subject_type, product_id, product_name, reason, status, priority, assigned_to, related_to,
          incident_date, amount_disputed, description, desired_resolution, evidence_files, admin_resolution_notes,
          estimated_response_days, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'soporte-tecnico-app', 'Soporte Técnico Serviprox', 'Plataforma Serviprox · App', ?, '', 'reclamo', 'servicio', NULL, '', ?, 'radicado', ?, '', ?, ?, NULL, ?, 'Revisión técnica y corrección de la falla reportada.', '[]', '', 2, ?, ?)`
      )
      .run(
        pqrRadicado,
        userId,
        reportedBy || "Usuario",
        req.user?.phone || "",
        userEmail,
        req.user?.document_id || "",
        req.user?.address || "",
        problemCatLabel,
        String(d.category || "otro_tecnico"),
        String(d.priority || "Media"),
        `${problemCatLabel} (${ticket})`,
        ts.slice(0, 10),
        problemDescription,
        ts,
        ts
      );
    const linkedPqrId = Number(insPqr.lastInsertRowid);
    const insertPqrMsg = db.prepare(
      "INSERT INTO pqr_messages (pqr_id, sender, sender_name, sender_role, text, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
    );
    insertPqrMsg.run(
      linkedPqrId,
      "system",
      "Serviprox",
      "Sistema",
      `PQR ${pqrRadicado} (Ticket técnico ${ticket} · ${problemCatLabel}) registrada en Serviprox.`,
      ts
    );
    if (transcript.length > 0) {
      for (const item of transcript) {
        const pqrSender =
          item.sender === "agent" || item.sender === "support_agent"
            ? "support_agent"
            : item.sender === "system"
              ? "system"
              : "client";
        insertPqrMsg.run(
          linkedPqrId,
          pqrSender,
          item.senderName || (pqrSender === "support_agent" ? "Sofía • Soporte Serviprox" : reportedBy || "Usuario"),
          pqrSender === "support_agent" ? "Soporte" : pqrSender === "system" ? "Sistema" : "Cliente",
          item.text,
          ts
        );
      }
    } else if (problemDescription) {
      insertPqrMsg.run(linkedPqrId, "client", reportedBy || "Usuario", "Cliente", problemDescription, ts);
    }

    let linkedChatId: number | null = null;
    if (userId || userEmail) {
      linkedChatId = createLinkedSupportChat({
        userId,
        userName: reportedBy || "Usuario",
        userEmail,
        title: `PQR ${pqrRadicado} · ${problemCatLabel}`,
        topic: "problema_app",
        relatedPqrId: linkedPqrId,
        relatedRadicado: pqrRadicado,
        transcript,
        fallbackUserMessage: problemDescription,
        systemConfirmation: `PQR ${pqrRadicado} (Ticket ${ticket} · ${problemCatLabel}) y chat registrados en Serviprox.`,
        ts,
      });
    }

    addNotification({
      userId: null,
      title: `Nuevo PQR técnico: ${pqrRadicado}`,
      text: `${reportedBy || "Usuario"} reportó "${problemCatLabel}" (${ticket}): ${problemDescription.slice(0, 120)}`,
      type: "pqr",
      link: "pqr",
      targetId: pqrRadicado,
    });

    const created = db.prepare("SELECT * FROM app_problem_reports WHERE id = ?").get(problemId) as Record<
      string,
      unknown
    >;
    res.status(201).json({
      ...serializeAppProblem(created, req),
      pqrId: String(linkedPqrId),
      radicadoNumber: pqrRadicado,
      ...(linkedChatId ? { chatId: linkedChatId } : {}),
    });
  }
);

router.get("/app-problems/:id/", (req: AuthedRequest, res: Response) => {
  const row = resolveProblemRow(String(req.params.id));
  if (!row) {
    res.status(404).json({ detail: "Reporte no encontrado." });
    return;
  }
  const owner = row.user_id ? findUserById(Number(row.user_id)) : undefined;
  const allowed =
    isStaffUser(req.user) ||
    (req.user &&
      ((row.user_id && Number(row.user_id) === req.user.id) ||
        String(row.user_email || owner?.email || "").toLowerCase() === req.user.email.toLowerCase()));
  if (!allowed) {
    res.status(404).json({ detail: "Reporte no encontrado." });
    return;
  }
  res.json(serializeAppProblem(row, req));
});

router.patch("/app-problems/:id/", (req: AuthedRequest, res: Response) => {
  const row = resolveProblemRow(String(req.params.id));
  if (!row || (!isStaffUser(req.user) && (!req.user || Number(row.user_id) !== req.user.id))) {
    res.status(404).json({ detail: "Reporte no encontrado." });
    return;
  }
  const d = (req.body || {}) as Record<string, unknown>;
  const fields: string[] = [];
  const vals: Array<string | number> = [];
  const mapping: Array<[string[], string]> = [
    [["status"], "status"],
    [["priority"], "priority"],
    [["assignedTo", "assigned_to"], "assigned_to"],
    [["responseNotes", "response_notes"], "response_notes"],
  ];
  for (const [keys, col] of mapping) {
    const val = keys.map((k) => d[k]).find((v) => v !== undefined);
    if (val !== undefined) {
      fields.push(`${col} = ?`);
      vals.push(String(val));
    }
  }
  if (fields.length > 0) {
    vals.push(Number(row.id));
    db.prepare(`UPDATE app_problem_reports SET ${fields.join(", ")} WHERE id = ?`).run(...vals);
  }
  const updated = db.prepare("SELECT * FROM app_problem_reports WHERE id = ?").get(Number(row.id)) as Record<
    string,
    unknown
  >;
  res.json(serializeAppProblem(updated, req));
});

router.delete("/app-problems/:id/", (req: AuthedRequest, res: Response) => {
  const row = resolveProblemRow(String(req.params.id));
  if (!row || (!isStaffUser(req.user) && (!req.user || Number(row.user_id) !== req.user.id))) {
    res.status(404).json({ detail: "Reporte no encontrado." });
    return;
  }
  db.prepare("DELETE FROM app_problem_reports WHERE id = ?").run(Number(row.id));
  res.status(200).json({ ok: true, detail: "Reporte eliminado." });
});

// ── Support Chats (Crear chat y seguimiento persistente) ─────────────────────

function canAccessSupportChat(chat: Record<string, unknown>, req: AuthedRequest): boolean {
  if (isStaffUser(req.user)) return true;
  if (!req.user) return false;
  if (chat.user_id !== null && chat.user_id !== undefined && Number(chat.user_id) === req.user.id) {
    return true;
  }
  if (chat.user_email && String(chat.user_email).toLowerCase() === req.user.email.toLowerCase()) {
    return true;
  }
  return false;
}

router.get("/support-chats/", requireAuth, (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  const rows = isStaffUser(user)
    ? (db.prepare("SELECT * FROM support_chats ORDER BY updated_at DESC, id DESC").all() as Array<
        Record<string, unknown>
      >)
    : (db
        .prepare(
          "SELECT * FROM support_chats WHERE user_id = ? OR LOWER(user_email) = LOWER(?) ORDER BY updated_at DESC, id DESC"
        )
        .all(user.id, user.email) as Array<Record<string, unknown>>);

  res.json(
    paginate(rows.map(serializeSupportChat), req.query.page, req.query.page_size, req.originalUrl, 50)
  );
});

router.post("/support-chats/", requireAuth, (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  const settings = loadPlatformSettings();
  if (!isStaffUser(user) && settings.features?.chat === false) {
    res.status(403).json({ detail: "El chat de soporte está deshabilitado temporalmente." });
    return;
  }

  const d = (req.body || {}) as Record<string, unknown>;
  const title = String(d.title || "").trim().slice(0, 160) || "Chat de soporte Serviprox";
  const topic = String(d.topic || "soporte").trim().slice(0, 60) || "soporte";
  const initialMessage = String(d.initialMessage ?? d.initial_message ?? "").trim();
  const relatedRadicado = String(d.relatedRadicado ?? d.related_radicado ?? "").trim().slice(0, 60);
  const rawPqrId = d.relatedPqrId ?? d.related_pqr_id;
  const relatedPqrId =
    rawPqrId !== undefined && rawPqrId !== null && /^\d+$/.test(String(rawPqrId).replace(/^pqr-/, ""))
      ? Number(String(rawPqrId).replace(/^pqr-/, ""))
      : null;
  const transcript = parseChatTranscript(d.messages);

  const userName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username;
  const ts = nowIso();
  const ins = db
    .prepare(
      `INSERT INTO support_chats (
        user_id, user_name, user_email, title, topic, related_pqr_id, related_radicado, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'abierto', ?, ?)`
    )
    .run(user.id, userName, user.email, title, topic, relatedPqrId, relatedRadicado, ts, ts);
  const chatId = Number(ins.lastInsertRowid);

  const insertMsg = db.prepare(
    "INSERT INTO support_chat_messages (chat_id, sender, sender_name, text, created_at) VALUES (?, ?, ?, ?, ?)"
  );
  if (transcript.length > 0) {
    for (const item of transcript) {
      const sender =
        item.sender === "agent" || item.sender === "support_agent"
          ? "agent"
          : item.sender === "admin"
            ? "admin"
            : item.sender === "system"
              ? "system"
              : "user";
      const sName =
        item.senderName ||
        (sender === "agent"
          ? "Sofía • Soporte Serviprox"
          : sender === "system"
            ? "Serviprox"
            : userName);
      insertMsg.run(chatId, sender, sName, item.text, ts);
    }
  } else if (initialMessage) {
    insertMsg.run(chatId, isStaffUser(user) ? "admin" : "user", userName, initialMessage, ts);
    insertMsg.run(
      chatId,
      "agent",
      "Sofía • Soporte Serviprox",
      "¡Chat registrado! Hemos recibido tu mensaje y nuestro equipo le hará seguimiento desde aquí.",
      ts
    );
  } else {
    insertMsg.run(
      chatId,
      "agent",
      "Sofía • Soporte Serviprox",
      "¡Hola! Tu chat de soporte quedó creado. Escribe aquí cualquier duda, seguimiento o novedad.",
      ts
    );
  }

  addNotification({
    userId: null,
    title: `Nuevo chat de soporte: ${title}`,
    text: `${userName} abrió un chat (${topic})${initialMessage ? `: ${initialMessage.slice(0, 120)}` : "."}`,
    type: "sistema",
    link: "pqr",
    targetId: `chat-${chatId}`,
  });

  const created = db.prepare("SELECT * FROM support_chats WHERE id = ?").get(chatId) as Record<
    string,
    unknown
  >;
  res.status(201).json(serializeSupportChat(created));
});

router.get("/support-chats/:id/", requireAuth, (req: AuthedRequest, res: Response) => {
  const idNum = Number.parseInt(String(req.params.id || ""), 10);
  if (!Number.isFinite(idNum)) {
    res.status(404).json({ detail: "Chat no encontrado." });
    return;
  }
  const chat = db.prepare("SELECT * FROM support_chats WHERE id = ?").get(idNum) as
    | Record<string, unknown>
    | undefined;
  if (!chat || !canAccessSupportChat(chat, req)) {
    res.status(404).json({ detail: "Chat no encontrado." });
    return;
  }
  res.json(serializeSupportChat(chat));
});

router.post("/support-chats/:id/messages/", requireAuth, (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  const idNum = Number.parseInt(String(req.params.id || ""), 10);
  if (!Number.isFinite(idNum)) {
    res.status(404).json({ detail: "Chat no encontrado." });
    return;
  }
  const chat = db.prepare("SELECT * FROM support_chats WHERE id = ?").get(idNum) as
    | Record<string, unknown>
    | undefined;
  if (!chat || !canAccessSupportChat(chat, req)) {
    res.status(404).json({ detail: "Chat no encontrado." });
    return;
  }
  const text = String(req.body?.text || "").trim();
  if (!text) {
    res.status(400).json({ detail: "El mensaje no puede estar vacío." });
    return;
  }
  const ts = nowIso();
  const sender = isStaffUser(user) ? "admin" : "user";
  const senderName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username;
  const ins = db
    .prepare(
      "INSERT INTO support_chat_messages (chat_id, sender, sender_name, text, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(idNum, sender, senderName, text, ts);
  db.prepare("UPDATE support_chats SET updated_at = ? WHERE id = ?").run(ts, idNum);

  if (!isStaffUser(user)) {
    addNotification({
      userId: null,
      title: `Nuevo mensaje en chat #${idNum}`,
      text: `${senderName}: ${text.slice(0, 120)}`,
      type: "sistema",
      link: "pqr",
      targetId: `chat-${idNum}`,
    });
  } else if (chat.user_id) {
    addNotification({
      userId: Number(chat.user_id),
      title: `Respuesta en tu chat de soporte`,
      text: `${senderName}: ${text.slice(0, 120)}`,
      type: "sistema",
      link: "pqr",
      targetId: `chat-${idNum}`,
    });
  }

  const created = db
    .prepare("SELECT * FROM support_chat_messages WHERE id = ?")
    .get(ins.lastInsertRowid) as Record<string, unknown>;
  res.status(201).json(serializeSupportChatMessage(created));
});

export default router;
