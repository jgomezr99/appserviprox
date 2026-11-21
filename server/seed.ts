import fs from "node:fs";
import path from "node:path";
import { db, mergePlatformSettings, nowIso } from "./db.ts";

interface FixtureRecord {
  model: string;
  pk?: number;
  fields: Record<string, unknown>;
}

const DEFAULT_SEED_PATH = path.resolve(process.cwd(), "backend", "full_seed.json");

function resolveUserFk(val: unknown, emailMap: Map<string, number>): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val;
  if (Array.isArray(val) && val.length > 0) {
    const key = String(val[0]).trim().toLowerCase();
    return emailMap.get(key) ?? null;
  }
  if (typeof val === "string") {
    return emailMap.get(val.trim().toLowerCase()) ?? null;
  }
  return null;
}

function asIntBool(val: unknown, fallback = 0): number {
  if (val === null || val === undefined) return fallback;
  return val ? 1 : 0;
}

function asStr(val: unknown, fallback = ""): string {
  if (val === null || val === undefined) return fallback;
  return String(val);
}

function asJsonStr(val: unknown, fallback = "[]"): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") return val;
  return JSON.stringify(val);
}

export function importFixtureRecords(records: FixtureRecord[]): Record<string, number> {
  const emailToId = new Map<string, number>();
  const existingUsers = db.prepare("SELECT id, email FROM users").all() as Array<{ id: number; email: string }>;
  for (const u of existingUsers) {
    emailToId.set(u.email.trim().toLowerCase(), u.id);
  }

  const counts: Record<string, number> = {};
  const bump = (k: string) => {
    counts[k] = (counts[k] || 0) + 1;
  };

  const byModel = new Map<string, FixtureRecord[]>();
  for (const rec of records) {
    const list = byModel.get(rec.model) || [];
    list.push(rec);
    byModel.set(rec.model, list);
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    // 1. accounts.user (no explicit pk in fixture; natural-keyed by [email])
    const insertUser = db.prepare(`
      INSERT INTO users (
        email, username, password, first_name, last_name, role, phone, city,
        document_id, address, avatar_url, is_identity_verified, onboarding_completed,
        is_active, is_staff, is_superuser, is_blocked, block_type, block_duration_days,
        block_reason, blocked_until, blocked_at, last_login, date_joined, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        username = excluded.username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        role = excluded.role,
        phone = excluded.phone,
        city = excluded.city
    `);
    for (const rec of byModel.get("accounts.user") || []) {
      const f = rec.fields;
      const email = asStr(f.email).trim().toLowerCase();
      if (!email) continue;
      if (typeof rec.pk === "number") {
        db.prepare(`
          INSERT OR REPLACE INTO users (
            id, email, username, password, first_name, last_name, role, phone, city,
            document_id, address, avatar_url, is_identity_verified, onboarding_completed,
            is_active, is_staff, is_superuser, is_blocked, block_type, block_duration_days,
            block_reason, blocked_until, blocked_at, last_login, date_joined, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          rec.pk,
          email,
          asStr(f.username, email.split("@")[0]),
          asStr(f.password),
          asStr(f.first_name),
          asStr(f.last_name),
          asStr(f.role, "client"),
          asStr(f.phone),
          asStr(f.city, "Bogota"),
          asStr(f.document_id),
          asStr(f.address),
          asStr(f.avatar_url),
          asIntBool(f.is_identity_verified),
          asIntBool(f.onboarding_completed),
          asIntBool(f.is_active, 1),
          asIntBool(f.is_staff),
          asIntBool(f.is_superuser),
          asIntBool(f.is_blocked),
          asStr(f.block_type),
          Number(f.block_duration_days || 0),
          asStr(f.block_reason),
          f.blocked_until ? asStr(f.blocked_until) : null,
          f.blocked_at ? asStr(f.blocked_at) : null,
          f.last_login ? asStr(f.last_login) : null,
          asStr(f.date_joined, nowIso()),
          asStr(f.created_at, nowIso())
        );
        emailToId.set(email, rec.pk);
      } else {
        insertUser.run(
          email,
          asStr(f.username, email.split("@")[0]),
          asStr(f.password),
          asStr(f.first_name),
          asStr(f.last_name),
          asStr(f.role, "client"),
          asStr(f.phone),
          asStr(f.city, "Bogota"),
          asStr(f.document_id),
          asStr(f.address),
          asStr(f.avatar_url),
          asIntBool(f.is_identity_verified),
          asIntBool(f.onboarding_completed),
          asIntBool(f.is_active, 1),
          asIntBool(f.is_staff),
          asIntBool(f.is_superuser),
          asIntBool(f.is_blocked),
          asStr(f.block_type),
          Number(f.block_duration_days || 0),
          asStr(f.block_reason),
          f.blocked_until ? asStr(f.blocked_until) : null,
          f.blocked_at ? asStr(f.blocked_at) : null,
          f.last_login ? asStr(f.last_login) : null,
          asStr(f.date_joined, nowIso()),
          asStr(f.created_at, nowIso())
        );
        const row = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: number };
        emailToId.set(email, row.id);
      }
      bump("users");
    }

    // 2. accounts.platformsettings
    for (const rec of byModel.get("accounts.platformsettings") || []) {
      const f = rec.fields;
      const merged = mergePlatformSettings(
        typeof f.data === "object" && f.data !== null ? (f.data as Record<string, unknown>) : {}
      );
      db.prepare("INSERT OR REPLACE INTO platform_settings (id, data, updated_at) VALUES (?, ?, ?)").run(
        rec.pk || 1,
        JSON.stringify(merged),
        asStr(f.updated_at, nowIso())
      );
      bump("platform_settings");
    }

    // 3. accounts.clientprofile
    for (const rec of byModel.get("accounts.clientprofile") || []) {
      const f = rec.fields;
      const userId = resolveUserFk(f.user, emailToId);
      if (!userId) continue;
      db.prepare(`
        INSERT OR REPLACE INTO client_profiles (
          id, user_id, emergency_contact_name, emergency_contact_phone,
          preferred_payment_method, service_notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        rec.pk ?? null,
        userId,
        asStr(f.emergency_contact_name),
        asStr(f.emergency_contact_phone),
        asStr(f.preferred_payment_method, "Transferencia / Efectivo"),
        asStr(f.service_notes),
        asStr(f.created_at, nowIso()),
        asStr(f.updated_at, nowIso())
      );
      bump("client_profiles");
    }

    // 4. accounts.passwordresetcode
    for (const rec of byModel.get("accounts.passwordresetcode") || []) {
      const f = rec.fields;
      const userId = resolveUserFk(f.user, emailToId);
      if (!userId) continue;
      db.prepare(`
        INSERT OR REPLACE INTO password_reset_codes (id, user_id, code_hash, expires_at, used_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        rec.pk ?? null,
        userId,
        asStr(f.code_hash),
        asStr(f.expires_at, nowIso()),
        f.used_at ? asStr(f.used_at) : null,
        asStr(f.created_at, nowIso())
      );
      bump("password_reset_codes");
    }

    // 5. accounts.adminauditlog
    for (const rec of byModel.get("accounts.adminauditlog") || []) {
      const f = rec.fields;
      const adminUserId = resolveUserFk(f.admin_user, emailToId);
      db.prepare(`
        INSERT OR REPLACE INTO admin_audit_logs (id, admin_user_id, admin_name, action, target, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        rec.pk ?? null,
        adminUserId,
        asStr(f.admin_name, "Superadministrador"),
        asStr(f.action),
        asStr(f.target),
        asStr(f.reason),
        asStr(f.created_at, nowIso())
      );
      bump("admin_audit_logs");
    }

    // 6. accounts.notification
    for (const rec of byModel.get("accounts.notification") || []) {
      const f = rec.fields;
      const userId = resolveUserFk(f.user, emailToId);
      db.prepare(`
        INSERT OR REPLACE INTO notifications (id, user_id, title, text, notification_type, link, target_id, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        rec.pk ?? null,
        userId,
        asStr(f.title),
        asStr(f.text),
        asStr(f.notification_type, "sistema"),
        asStr(f.link),
        asStr(f.target_id),
        asIntBool(f.is_read),
        asStr(f.created_at, nowIso())
      );
      bump("notifications");
    }

    // 7. households.household
    for (const rec of byModel.get("households.household") || []) {
      const f = rec.fields;
      const ownerId = resolveUserFk(f.owner, emailToId);
      if (!ownerId) continue;
      db.prepare(`
        INSERT OR REPLACE INTO households (
          id, owner_id, label, property_type, address_line, neighborhood, city, country,
          latitude, longitude, area_m2, build_year, notes, is_default, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        rec.pk ?? null,
        ownerId,
        asStr(f.label, "Mi hogar"),
        asStr(f.property_type, "apartment"),
        asStr(f.address_line, "Bogotá"),
        asStr(f.neighborhood),
        asStr(f.city, "Bogota"),
        asStr(f.country, "Colombia"),
        f.latitude !== null && f.latitude !== undefined ? Number(f.latitude) : null,
        f.longitude !== null && f.longitude !== undefined ? Number(f.longitude) : null,
        f.area_m2 !== null && f.area_m2 !== undefined ? Number(f.area_m2) : null,
        f.build_year !== null && f.build_year !== undefined ? Number(f.build_year) : null,
        asStr(f.notes),
        asIntBool(f.is_default),
        asStr(f.created_at, nowIso())
      );
      bump("households");
    }

    // 8. catalog.servicecategory
    for (const rec of byModel.get("catalog.servicecategory") || []) {
      const f = rec.fields;
      db.prepare(`
        INSERT OR REPLACE INTO service_categories (id, name, slug, description, icon_key, keywords, sort_order, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        rec.pk ?? null,
        asStr(f.name),
        asStr(f.slug),
        asStr(f.description),
        asStr(f.icon_key, "construct"),
        asJsonStr(f.keywords, "[]"),
        Number(f.sort_order || 0),
        asIntBool(f.is_active, 1)
      );
      bump("service_categories");
    }

    // 9. catalog.service
    for (const rec of byModel.get("catalog.service") || []) {
      const f = rec.fields;
      db.prepare(`
        INSERT OR REPLACE INTO services (
          id, category_id, name, slug, description, keywords, price_min, price_max, estimated_hours, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        rec.pk ?? null,
        Number(f.category),
        asStr(f.name),
        asStr(f.slug),
        asStr(f.description),
        asJsonStr(f.keywords, "[]"),
        f.price_min !== null && f.price_min !== undefined ? asStr(f.price_min) : null,
        f.price_max !== null && f.price_max !== undefined ? asStr(f.price_max) : null,
        f.estimated_hours !== null && f.estimated_hours !== undefined ? asStr(f.estimated_hours) : null,
        asIntBool(f.is_active, 1)
      );
      bump("services");
    }

    // 10. catalog.storeproduct
    for (const rec of byModel.get("catalog.storeproduct") || []) {
      const f = rec.fields;
      const ownerId = resolveUserFk(f.owner, emailToId) || 1;
      const ownerUser = db.prepare("SELECT email, username FROM users WHERE id = ?").get(ownerId) as
        | { email: string; username: string }
        | undefined;
      const createdAt = asStr(f.created_at, nowIso());
      const img = asStr(f.image);
      const imgs = img ? [img] : [];
      db.prepare(`
        INSERT OR REPLACE INTO store_products (
          id, owner_id, title, category, price, stock, condition, description,
          seller_name, seller_email, seller_username, seller_role, seller_blocked,
          phone, city, image, images, is_active, review_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        rec.pk ?? null,
        ownerId,
        asStr(f.title),
        asStr(f.category, "Otros"),
        Number(f.price || 0),
        Number(f.stock ?? 1),
        asStr(f.condition, "Nuevo"),
        asStr(f.description),
        asStr(f.seller_name, "Usuario"),
        asStr(f.seller_email, ownerUser?.email || ""),
        asStr(f.seller_username, ownerUser?.username || ""),
        asStr(f.seller_role, "Cliente"),
        asIntBool(f.seller_blocked),
        asStr(f.phone),
        asStr(f.city, "Bogotá"),
        img,
        asJsonStr(f.images ?? imgs, "[]"),
        asIntBool(f.is_active, 1),
        asStr(f.review_status, "aprobado"),
        createdAt,
        asStr(f.updated_at, createdAt)
      );
      bump("store_products");
    }

    // 11. diagnosis.diagnosticquestion & option
    for (const rec of byModel.get("diagnosis.diagnosticquestion") || []) {
      const f = rec.fields;
      db.prepare(`
        INSERT OR REPLACE INTO diagnostic_questions (id, code, text, help_text, sort_order, is_required, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        rec.pk ?? null,
        asStr(f.code),
        asStr(f.text),
        asStr(f.help_text),
        Number(f.order ?? f.sort_order ?? 0),
        asIntBool(f.is_required, 1),
        asIntBool(f.is_active, 1)
      );
      bump("diagnostic_questions");
    }

    for (const rec of byModel.get("diagnosis.diagnosticoption") || []) {
      const f = rec.fields;
      db.prepare(`
        INSERT OR REPLACE INTO diagnostic_options (id, question_id, value, label, sort_order, weights)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        rec.pk ?? null,
        Number(f.question),
        asStr(f.value),
        asStr(f.label),
        Number(f.order ?? f.sort_order ?? 0),
        asJsonStr(f.weights, "{}")
      );
      bump("diagnostic_options");
    }

    // 12. professionals.*
    for (const rec of byModel.get("professionals.professionalprofile") || []) {
      const f = rec.fields;
      const userId = resolveUserFk(f.user, emailToId);
      if (!userId) continue;
      db.prepare(`
        INSERT OR REPLACE INTO professional_profiles (
          id, user_id, display_name, headline, slug, avatar_url, specialty_label, bio,
          latitude, longitude, neighborhood, city, coverage_radius_km, rating_avg,
          jobs_completed, response_time_minutes, is_verified, certificate_profession,
          certificate_file, certificate_uploaded_at, is_active, accepts_urgent,
          points, wallet_balance, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        rec.pk ?? null,
        userId,
        asStr(f.display_name),
        asStr(f.headline),
        asStr(f.slug),
        asStr(f.avatar_url),
        asStr(f.specialty_label),
        asStr(f.bio),
        f.latitude !== null && f.latitude !== undefined ? Number(f.latitude) : null,
        f.longitude !== null && f.longitude !== undefined ? Number(f.longitude) : null,
        asStr(f.neighborhood),
        asStr(f.city, "Bogota"),
        Number(f.coverage_radius_km || 10),
        asStr(f.rating_avg, "0.00"),
        Number(f.jobs_completed || 0),
        Number(f.response_time_minutes || 60),
        asIntBool(f.is_verified),
        asStr(f.certificate_profession),
        asStr(f.certificate_file),
        f.certificate_uploaded_at ? asStr(f.certificate_uploaded_at) : null,
        asIntBool(f.is_active, 1),
        asIntBool(f.accepts_urgent),
        Number(f.points || 0),
        asStr(f.wallet_balance, "0.00"),
        asStr(f.created_at, nowIso())
      );
      bump("professional_profiles");
    }

    for (const rec of byModel.get("professionals.professionalservice") || []) {
      const f = rec.fields;
      db.prepare(`
        INSERT OR REPLACE INTO professional_services (id, profile_id, service_id, price_min, price_max, observations, years_experience)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        rec.pk ?? null,
        Number(f.profile),
        Number(f.service),
        f.price_min !== null && f.price_min !== undefined ? asStr(f.price_min) : null,
        f.price_max !== null && f.price_max !== undefined ? asStr(f.price_max) : null,
        asStr(f.observations),
        Number(f.years_experience || 0)
      );
      bump("professional_services");
    }

    for (const rec of byModel.get("professionals.availabilityslot") || []) {
      const f = rec.fields;
      db.prepare(`
        INSERT OR REPLACE INTO availability_slots (id, profile_id, weekday, start_time, end_time)
        VALUES (?, ?, ?, ?, ?)
      `).run(rec.pk ?? null, Number(f.profile), Number(f.weekday), asStr(f.start_time), asStr(f.end_time));
      bump("availability_slots");
    }

    for (const rec of byModel.get("professionals.portfolioitem") || []) {
      const f = rec.fields;
      db.prepare(`
        INSERT OR REPLACE INTO portfolio_items (id, profile_id, image_url, caption, sort_order)
        VALUES (?, ?, ?, ?, ?)
      `).run(rec.pk ?? null, Number(f.profile), asStr(f.image_url), asStr(f.caption), Number(f.sort_order || 0));
      bump("portfolio_items");
    }

    // 13. service_requests.servicerequest
    for (const rec of byModel.get("service_requests.servicerequest") || []) {
      const f = rec.fields;
      const clientId = resolveUserFk(f.client, emailToId);
      if (!clientId) continue;
      db.prepare(`
        INSERT OR REPLACE INTO service_requests (
          id, client_id, household_id, diagnostic_session_id, suggested_category_id,
          selected_category_id, selected_service_id, professional_id, description,
          urgency, search_radius_km, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        rec.pk ?? null,
        clientId,
        Number(f.household),
        f.diagnostic_session ? Number(f.diagnostic_session) : null,
        f.suggested_category ? Number(f.suggested_category) : null,
        Number(f.selected_category),
        f.selected_service ? Number(f.selected_service) : null,
        f.professional ? Number(f.professional) : null,
        asStr(f.description),
        asStr(f.urgency, "this_week"),
        Number(f.search_radius_km || 10),
        asStr(f.status, "open"),
        asStr(f.created_at, nowIso()),
        asStr(f.updated_at, nowIso())
      );
      bump("service_requests");
    }

    // 14. orders.order & orderevent
    for (const rec of byModel.get("orders.order") || []) {
      const f = rec.fields;
      const clientId = resolveUserFk(f.client, emailToId);
      if (!clientId) continue;
      db.prepare(`
        INSERT OR REPLACE INTO orders (
          id, service_request_id, professional_id, client_id, status, payment_status,
          payment_confirmed_at, payment_reference, commission_rate, commission_amount,
          professional_amount, payout_status, payout_settled_at, scheduled_for,
          estimate_min, estimate_max, final_price, client_notes, arrival_code,
          professional_latitude, professional_longitude, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        rec.pk ?? null,
        Number(f.service_request),
        Number(f.professional),
        clientId,
        asStr(f.status, "requested"),
        asStr(f.payment_status, "pending"),
        f.payment_confirmed_at ? asStr(f.payment_confirmed_at) : null,
        asStr(f.payment_reference),
        f.commission_rate !== null && f.commission_rate !== undefined ? asStr(f.commission_rate) : null,
        f.commission_amount !== null && f.commission_amount !== undefined ? asStr(f.commission_amount) : null,
        f.professional_amount !== null && f.professional_amount !== undefined ? asStr(f.professional_amount) : null,
        asStr(f.payout_status, "pending"),
        f.payout_settled_at ? asStr(f.payout_settled_at) : null,
        f.scheduled_for ? asStr(f.scheduled_for) : null,
        f.estimate_min !== null && f.estimate_min !== undefined ? asStr(f.estimate_min) : null,
        f.estimate_max !== null && f.estimate_max !== undefined ? asStr(f.estimate_max) : null,
        f.final_price !== null && f.final_price !== undefined ? asStr(f.final_price) : null,
        asStr(f.client_notes),
        asStr(f.arrival_code, "0000"),
        f.professional_latitude !== null && f.professional_latitude !== undefined ? Number(f.professional_latitude) : null,
        f.professional_longitude !== null && f.professional_longitude !== undefined ? Number(f.professional_longitude) : null,
        asStr(f.created_at, nowIso()),
        asStr(f.updated_at, nowIso())
      );
      bump("orders");
    }

    for (const rec of byModel.get("orders.orderevent") || []) {
      const f = rec.fields;
      const createdById = resolveUserFk(f.created_by, emailToId);
      db.prepare(`
        INSERT OR REPLACE INTO order_events (id, order_id, status, note, created_by_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        rec.pk ?? null,
        Number(f.order),
        asStr(f.status),
        asStr(f.note),
        createdById,
        asStr(f.created_at, nowIso())
      );
      bump("order_events");
    }

    // 15. pqrs.*
    for (const rec of byModel.get("pqrs.pqrreport") || []) {
      const f = rec.fields;
      const clientId = resolveUserFk(f.client, emailToId);
      db.prepare(`
        INSERT OR REPLACE INTO pqr_reports (
          id, radicado_number, client_id, client_name, client_phone, client_email,
          client_document_id, client_address, contractor_id, contractor_id_ref,
          contractor_name, contractor_company, contractor_specialty, contractor_avatar,
          pqr_type, reason, status, priority, assigned_to, related_to, incident_date,
          amount_disputed, description, desired_resolution, evidence_files,
          admin_resolution_notes, estimated_response_days, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        rec.pk ?? null,
        asStr(f.radicado_number),
        clientId,
        asStr(f.client_name),
        asStr(f.client_phone),
        asStr(f.client_email),
        asStr(f.client_document_id),
        asStr(f.client_address),
        f.contractor ? Number(f.contractor) : null,
        asStr(f.contractor_id_ref),
        asStr(f.contractor_name),
        asStr(f.contractor_company),
        asStr(f.contractor_specialty),
        asStr(f.contractor_avatar),
        asStr(f.pqr_type, "queja"),
        asStr(f.reason),
        asStr(f.status, "radicado"),
        asStr(f.priority),
        asStr(f.assigned_to),
        asStr(f.related_to),
        asStr(f.incident_date, nowIso().slice(0, 10)),
        f.amount_disputed !== null && f.amount_disputed !== undefined ? asStr(f.amount_disputed) : null,
        asStr(f.description),
        asStr(f.desired_resolution),
        asJsonStr(f.evidence_files, "[]"),
        asStr(f.admin_resolution_notes),
        Number(f.estimated_response_days || 3),
        asStr(f.created_at, nowIso()),
        asStr(f.updated_at, nowIso())
      );
      bump("pqr_reports");
    }

    for (const rec of byModel.get("pqrs.pqrmessage") || []) {
      const f = rec.fields;
      db.prepare(`
        INSERT OR REPLACE INTO pqr_messages (id, pqr_id, sender, sender_name, sender_role, text, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        rec.pk ?? null,
        Number(f.pqr),
        asStr(f.sender, "system"),
        asStr(f.sender_name),
        asStr(f.sender_role),
        asStr(f.text),
        asStr(f.timestamp, nowIso())
      );
      bump("pqr_messages");
    }

    for (const rec of byModel.get("pqrs.appproblemreport") || []) {
      const f = rec.fields;
      const userId = resolveUserFk(f.user, emailToId);
      db.prepare(`
        INSERT OR REPLACE INTO app_problem_reports (
          id, ticket_number, user_id, title, user_email, category, category_label,
          description, device_info, version, reported_by, status, priority,
          assigned_to, response_notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        rec.pk ?? null,
        asStr(f.ticket_number),
        userId,
        asStr(f.title),
        asStr(f.user_email),
        asStr(f.category, "error_mapa"),
        asStr(f.category_label, "Falla Técnica"),
        asStr(f.description),
        asStr(f.device_info, "Web"),
        asStr(f.version),
        asStr(f.reported_by),
        asStr(f.status, "recibido"),
        asStr(f.priority),
        asStr(f.assigned_to),
        asStr(f.response_notes),
        asStr(f.created_at, nowIso())
      );
      bump("app_problem_reports");
    }

    db.exec("COMMIT");
    return counts;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function seedDatabaseIfEmpty(seedPath = DEFAULT_SEED_PATH): { seeded: boolean; counts?: Record<string, number> } {
  const row = db.prepare("SELECT COUNT(*) AS cnt FROM users").get() as { cnt: number };
  if (row.cnt > 0) {
    return { seeded: false };
  }
  if (!fs.existsSync(seedPath)) {
    return { seeded: false };
  }
  const raw = fs.readFileSync(seedPath, "utf8");
  const records = JSON.parse(raw) as FixtureRecord[];
  const counts = importFixtureRecords(records);
  return { seeded: true, counts };
}

export function exportFullBackup(): FixtureRecord[] {
  const records: FixtureRecord[] = [];
  const users = db.prepare("SELECT * FROM users ORDER BY id ASC").all() as Array<Record<string, unknown>>;
  const userEmailById = new Map<number, string>();
  for (const u of users) {
    userEmailById.set(Number(u.id), String(u.email));
    records.push({
      model: "accounts.user",
      pk: Number(u.id),
      fields: {
        password: u.password,
        last_login: u.last_login,
        is_superuser: Boolean(u.is_superuser),
        username: u.username,
        first_name: u.first_name,
        last_name: u.last_name,
        is_staff: Boolean(u.is_staff),
        is_active: Boolean(u.is_active),
        date_joined: u.date_joined,
        email: u.email,
        role: u.role,
        phone: u.phone,
        city: u.city,
        document_id: u.document_id,
        address: u.address,
        avatar_url: u.avatar_url,
        is_identity_verified: Boolean(u.is_identity_verified),
        is_blocked: Boolean(u.is_blocked),
        block_type: u.block_type,
        block_duration_days: u.block_duration_days,
        block_reason: u.block_reason,
        blocked_until: u.blocked_until,
        blocked_at: u.blocked_at,
        onboarding_completed: Boolean(u.onboarding_completed),
        created_at: u.created_at,
      },
    });
  }

  const fkUser = (id: unknown) => (id ? [userEmailById.get(Number(id)) || ""] : null);

  for (const row of db.prepare("SELECT * FROM platform_settings ORDER BY id ASC").all() as Array<Record<string, unknown>>) {
    records.push({
      model: "accounts.platformsettings",
      pk: Number(row.id),
      fields: { data: JSON.parse(String(row.data || "{}")), updated_at: row.updated_at },
    });
  }
  for (const row of db.prepare("SELECT * FROM client_profiles ORDER BY id ASC").all() as Array<Record<string, unknown>>) {
    records.push({
      model: "accounts.clientprofile",
      pk: Number(row.id),
      fields: { ...row, user: fkUser(row.user_id) },
    });
  }
  for (const row of db.prepare("SELECT * FROM households ORDER BY id ASC").all() as Array<Record<string, unknown>>) {
    records.push({
      model: "households.household",
      pk: Number(row.id),
      fields: { ...row, owner: fkUser(row.owner_id), is_default: Boolean(row.is_default) },
    });
  }
  for (const row of db.prepare("SELECT * FROM service_categories ORDER BY id ASC").all() as Array<Record<string, unknown>>) {
    records.push({
      model: "catalog.servicecategory",
      pk: Number(row.id),
      fields: { ...row, keywords: JSON.parse(String(row.keywords || "[]")), is_active: Boolean(row.is_active) },
    });
  }
  for (const row of db.prepare("SELECT * FROM services ORDER BY id ASC").all() as Array<Record<string, unknown>>) {
    records.push({
      model: "catalog.service",
      pk: Number(row.id),
      fields: { ...row, category: row.category_id, keywords: JSON.parse(String(row.keywords || "[]")), is_active: Boolean(row.is_active) },
    });
  }
  for (const row of db.prepare("SELECT * FROM store_products ORDER BY id ASC").all() as Array<Record<string, unknown>>) {
    records.push({
      model: "catalog.storeproduct",
      pk: Number(row.id),
      fields: { ...row, owner: fkUser(row.owner_id), is_active: Boolean(row.is_active) },
    });
  }
  for (const row of db.prepare("SELECT * FROM professional_profiles ORDER BY id ASC").all() as Array<Record<string, unknown>>) {
    records.push({
      model: "professionals.professionalprofile",
      pk: Number(row.id),
      fields: {
        ...row,
        user: fkUser(row.user_id),
        is_verified: Boolean(row.is_verified),
        is_active: Boolean(row.is_active),
        accepts_urgent: Boolean(row.accepts_urgent),
      },
    });
  }
  for (const row of db.prepare("SELECT * FROM professional_services ORDER BY id ASC").all() as Array<Record<string, unknown>>) {
    records.push({
      model: "professionals.professionalservice",
      pk: Number(row.id),
      fields: { ...row, profile: row.profile_id, service: row.service_id },
    });
  }
  for (const row of db.prepare("SELECT * FROM availability_slots ORDER BY id ASC").all() as Array<Record<string, unknown>>) {
    records.push({
      model: "professionals.availabilityslot",
      pk: Number(row.id),
      fields: { ...row, profile: row.profile_id },
    });
  }
  for (const row of db.prepare("SELECT * FROM portfolio_items ORDER BY id ASC").all() as Array<Record<string, unknown>>) {
    records.push({
      model: "professionals.portfolioitem",
      pk: Number(row.id),
      fields: { ...row, profile: row.profile_id },
    });
  }
  for (const row of db.prepare("SELECT * FROM service_requests ORDER BY id ASC").all() as Array<Record<string, unknown>>) {
    records.push({
      model: "service_requests.servicerequest",
      pk: Number(row.id),
      fields: {
        ...row,
        client: fkUser(row.client_id),
        household: row.household_id,
        diagnostic_session: row.diagnostic_session_id,
        suggested_category: row.suggested_category_id,
        selected_category: row.selected_category_id,
        selected_service: row.selected_service_id,
        professional: row.professional_id,
      },
    });
  }
  for (const row of db.prepare("SELECT * FROM orders ORDER BY id ASC").all() as Array<Record<string, unknown>>) {
    records.push({
      model: "orders.order",
      pk: Number(row.id),
      fields: {
        ...row,
        service_request: row.service_request_id,
        professional: row.professional_id,
        client: fkUser(row.client_id),
      },
    });
  }
  for (const row of db.prepare("SELECT * FROM order_events ORDER BY id ASC").all() as Array<Record<string, unknown>>) {
    records.push({
      model: "orders.orderevent",
      pk: Number(row.id),
      fields: { ...row, order: row.order_id, created_by: fkUser(row.created_by_id) },
    });
  }
  for (const row of db.prepare("SELECT * FROM pqr_reports ORDER BY id ASC").all() as Array<Record<string, unknown>>) {
    records.push({
      model: "pqrs.pqrreport",
      pk: Number(row.id),
      fields: { ...row, client: fkUser(row.client_id), contractor: row.contractor_id },
    });
  }
  for (const row of db.prepare("SELECT * FROM pqr_messages ORDER BY id ASC").all() as Array<Record<string, unknown>>) {
    records.push({
      model: "pqrs.pqrmessage",
      pk: Number(row.id),
      fields: { ...row, pqr: row.pqr_id },
    });
  }
  for (const row of db.prepare("SELECT * FROM app_problem_reports ORDER BY id ASC").all() as Array<Record<string, unknown>>) {
    records.push({
      model: "pqrs.appproblemreport",
      pk: Number(row.id),
      fields: { ...row, user: fkUser(row.user_id) },
    });
  }
  for (const row of db.prepare("SELECT * FROM notifications ORDER BY id ASC").all() as Array<Record<string, unknown>>) {
    records.push({
      model: "accounts.notification",
      pk: Number(row.id),
      fields: { ...row, user: fkUser(row.user_id), is_read: Boolean(row.is_read) },
    });
  }
  for (const row of db.prepare("SELECT * FROM admin_audit_logs ORDER BY id ASC").all() as Array<Record<string, unknown>>) {
    records.push({
      model: "accounts.adminauditlog",
      pk: Number(row.id),
      fields: { ...row, admin_user: fkUser(row.admin_user_id) },
    });
  }
  return records;
}
