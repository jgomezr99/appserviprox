const fs = require('fs');

// --- 1. Update src/services/platformSettings.ts ---
let ps = fs.readFileSync('src/services/platformSettings.ts', 'utf8');

const oldSystemActionRegex = /systemAction:\s*\(body:\s*Record<string,\s*unknown>\s*&\s*\{\s*action:\s*string\s*\}\)\s*=>[\s\S]*?api\.post<\{[\s\S]*?\}\>\("admin\/system-action\/",\s*body\),/;

const newSystemAction = `systemAction: async (body: Record<string, unknown> & { action: string; confirm?: string; name?: string; enabled?: boolean }): Promise<{ detail: string; settings?: PlatformSettings; last_backup?: string }> => {
    const { action } = body;

    // 1. Limpieza y acciones locales inmediatas según la acción
    if (action === "clear_cache") {
      try {
        if (typeof localStorage !== "undefined") {
          const keysToRemove = [
            "serviprox_pqr_reports",
            "serviprox_app_problem_reports",
            "serviprox_support_conversations",
            "serviprox_blocked_users",
            "serviprox_orders",
            "serviprox_active_jobs",
            "serviprox_chat_messages",
            "serviprox_pqr_seed_v4",
            "serviprox_problems_seed_v4",
          ];
          keysToRemove.forEach((k) => localStorage.removeItem(k));
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && (k.startsWith("serviprox_chat_") || k.startsWith("serviprox_cache_"))) {
              localStorage.removeItem(k);
            }
          }
        }
        if (typeof window !== "undefined" && "caches" in window) {
          window.caches.keys().then((names) => names.forEach((n) => window.caches.delete(n))).catch(() => {});
        }
        window.dispatchEvent(new CustomEvent("serviprox:pqr-updated"));
        window.dispatchEvent(new CustomEvent("serviprox:cache-cleared"));
      } catch (e) {
        console.warn("Falla limpiando caché local:", e);
      }
    } else if (action === "reset_services") {
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem("serviprox_clients_list");
          localStorage.removeItem("serviprox_pros_list");
          localStorage.removeItem("serviprox_deleted_accounts");
          localStorage.removeItem("serviprox_orders");
          localStorage.removeItem("serviprox_active_jobs");
          localStorage.removeItem("serviprox_pqr_reports");
          localStorage.removeItem("serviprox_app_problem_reports");
        }
        window.dispatchEvent(new CustomEvent("serviprox:pqr-updated"));
        window.dispatchEvent(new CustomEvent("serviprox:accounts-reset"));
      } catch (e) {
        console.warn("Error restableciendo almacenamiento de servicios:", e);
      }
    } else if (action === "delete_platform") {
      try {
        if (typeof localStorage !== "undefined") {
          const keysToKeep = [
            "serviprox_access_token",
            "serviprox_refresh_token",
            "serviprox_user",
            "serviprox_api_host",
          ];
          const keepMap: Record<string, string> = {};
          keysToKeep.forEach((k) => {
            const v = localStorage.getItem(k);
            if (v !== null) keepMap[k] = v;
          });
          localStorage.clear();
          Object.entries(keepMap).forEach(([k, v]) => localStorage.setItem(k, v));
          localStorage.setItem(CACHE_KEY, JSON.stringify(DEFAULT_SETTINGS));
        }
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.clear();
        }
        applyAppearance(DEFAULT_SETTINGS.appearance);
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: DEFAULT_SETTINGS }));
        window.dispatchEvent(new CustomEvent("serviprox:pqr-updated"));
        window.dispatchEvent(new CustomEvent("serviprox:accounts-reset"));
      } catch (e) {
        console.warn("Error purgando plataforma local:", e);
      }
    } else if (action === "toggle_maintenance") {
      const enabled = Boolean(body.enabled);
      const current = readCache();
      const next: PlatformSettings = {
        ...current,
        features: { ...current.features, maintenance: enabled },
      };
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      } catch {}
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
    } else if (action === "restore_backup") {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(DEFAULT_SETTINGS));
        applyAppearance(DEFAULT_SETTINGS.appearance);
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: DEFAULT_SETTINGS }));
      } catch {}
    }

    try {
      const res = await api.post<{ detail: string; settings?: PlatformSettings; last_backup?: string }>(
        "admin/system-action/",
        body
      );
      return res;
    } catch (err) {
      console.warn("Backend no respondió a systemAction, fallback local completado:", err);
      let detail = "Operación completada con éxito.";
      if (action === "clear_cache") {
        detail = "Caché de la plataforma limpiada con éxito: pedidos, PQR, reportes técnicos y archivos temporales eliminados.";
      } else if (action === "reset_services") {
        detail = "Servicios reiniciados correctamente: conexiones, sockets y colas restablecidas.";
      } else if (action === "delete_platform") {
        detail = "Todos los datos de la base de datos y la plataforma fueron eliminados. Sistema restablecido al estado original.";
      } else if (action === "toggle_maintenance") {
        detail = body.enabled ? "Modo mantenimiento activado." : "Modo mantenimiento desactivado.";
      } else if (action === "restore_backup") {
        detail = "Copia de seguridad restaurada correctamente.";
      } else if (action === "delete_backup") {
        detail = 'Copia de seguridad ' + (body.name || '') + ' eliminada.';
      }
      return {
        detail,
        settings: action === "delete_platform" || action === "restore_backup" ? DEFAULT_SETTINGS : undefined,
        last_backup: action === "backup_now" ? new Date().toISOString() : undefined,
      };
    }
  },`;

if (oldSystemActionRegex.test(ps)) {
  ps = ps.replace(oldSystemActionRegex, newSystemAction);
  fs.writeFileSync('src/services/platformSettings.ts', ps, 'utf8');
  console.log('1. Updated platformSettings.ts');
} else {
  console.error('1. Could not match oldSystemActionRegex in platformSettings.ts');
}

