import fs from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { attachUser } from "./server/auth.ts";
import { initSchema, MEDIA_DIR } from "./server/db.ts";
import { seedDatabaseIfEmpty } from "./server/seed.ts";
import accountsRouter from "./server/routes/accounts.ts";
import catalogDiagnosisRouter from "./server/routes/catalogDiagnosis.ts";
import householdsProfessionalsRouter from "./server/routes/householdsProfessionals.ts";
import pqrsRouter from "./server/routes/pqrs.ts";
import requestsOrdersFinanceRouter from "./server/routes/requestsOrdersFinance.ts";

const IS_PROD = process.env.NODE_ENV === "production";
const PORT = IS_PROD
  ? Number(process.env.PORT) || 3000
  : Number(process.env.DEFAULT_APP_PORT) || 3000;

async function proxyRemoteVmRequest(req: Request, res: Response) {
  const headerTarget = req.headers["x-serviprox-target-base"];
  const rawBase =
    (typeof headerTarget === "string" && headerTarget.trim()) ||
    process.env.REMOTE_API_URL ||
    process.env.VITE_API_URL ||
    "";

  if (!rawBase) {
    res.status(503).json({
      status: "error",
      database: "disconnected",
      detail: "No hay un servidor remoto configurado para el proxy.",
    });
    return;
  }

  const normalizedBase = rawBase.trim().replace(/\/+$/, "").replace(/\/health$/i, "");
  const apiBase = normalizedBase.endsWith("/api/v1") ? normalizedBase : `${normalizedBase}/api/v1`;
  const targetUrl = `${apiBase}${req.url.startsWith("/") ? req.url : `/${req.url}`}`;

  try {
    const parsedTarget = new URL(targetUrl);
    const reqHost = req.get("host");
    if (reqHost && parsedTarget.host === reqHost) {
      res.status(502).json({
        status: "error",
        database: "disconnected",
        detail: "El destino del proxy apunta al mismo servidor.",
      });
      return;
    }

    const fwdHeaders = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      const lower = k.toLowerCase();
      if (["host", "connection", "content-length", "x-serviprox-target-base"].includes(lower)) continue;
      if (typeof v === "string") fwdHeaders.set(k, v);
      else if (Array.isArray(v)) fwdHeaders.set(k, v.join(", "));
    }

    const chunks: Buffer[] = [];
    if (!["GET", "HEAD"].includes(req.method.toUpperCase())) {
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    let upstream: globalThis.Response;
    try {
      upstream = await fetch(targetUrl, {
        method: req.method,
        headers: fwdHeaders,
        body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (!["transfer-encoding", "connection", "content-encoding"].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });
    const arrBuf = await upstream.arrayBuffer();
    res.send(Buffer.from(arrBuf));
  } catch (err) {
    res.status(502).json({
      status: "error",
      database: "disconnected",
      detail: err instanceof Error ? err.message : "Error conectando con el servidor remoto.",
    });
  }
}

async function startServer() {
  if (
    !process.env.REMOTE_API_URL &&
    process.env.ENFORCE_PROD_API !== "true" &&
    (process.env.VITE_API_URL || "").trim().replace(/\/+$/, "") === "https://serviprox-pte.duckdns.org/api/v1"
  ) {
    delete process.env.VITE_API_URL;
  }

  initSchema();
  seedDatabaseIfEmpty();

  const app = express();
  app.set("trust proxy", true);
  app.use(cors());

  // Proxy opcional para servidores remotos (antes de parsear el body para preservar multipart/raw)
  app.use("/api/vm/v1", proxyRemoteVmRequest);

  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ extended: true, limit: "15mb" }));

  app.use("/media", express.static(MEDIA_DIR));
  app.use(attachUser);

  app.use("/api/v1", accountsRouter);
  app.use("/api/v1", catalogDiagnosisRouter);
  app.use("/api/v1", householdsProfessionalsRouter);
  app.use("/api/v1", requestsOrdersFinanceRouter);
  app.use("/api/v1", pqrsRouter);

  // Fallback JSON 404 para rutas /api no encontradas
  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ detail: "Recurso no encontrado." });
  });

  // Manejador de errores de Express para API
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    const reqUrl = req.originalUrl || req.path || "";
    if (reqUrl.startsWith("/api")) {
      const msg = err instanceof Error ? err.message : "Error interno del servidor.";
      res.status(500).json({ detail: msg });
      return;
    }
    next(err);
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.use((_req: Request, res: Response) => {
      const indexFile = path.join(distDir, "index.html");
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send("Build not found");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Serviprox unified server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start Serviprox server:", err);
  process.exit(1);
});
