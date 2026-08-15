import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getUploadsDirectory } from "../appStorage";
import { getBeachConditions } from "../beachConditions";
import { bootstrapDemoDirectoryIfEmpty, enforceExpiredSubscriptions, syncExistingDemoDirectoryAssets } from "../db";
import { bootstrapLocalDemoAssets } from "../demoAssetBootstrap";
import { getRuntimePort } from "./runtimePort";

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  app.use("/uploads", express.static(getUploadsDirectory(), { fallthrough: false, maxAge: "7d" }));
  app.post("/api/scheduled/refresh-marine", async (req, res) => {
    try {
      const conditions = await getBeachConditions();
      return res.json({ ok: true, lastFetchedAt: conditions.lastFetchedAt, source: conditions.source });
    } catch (error) {
      return res.status(502).json({ error: "marine-refresh-failed", message: error instanceof Error ? error.message : "Unknown error" });
    }
  });
  app.post("/api/scheduled/suspend-expired-subscriptions", async (req, res) => {
    try {
      const result = await enforceExpiredSubscriptions();
      return res.json({ ok: true, suspendedEstablishmentIds: result.suspended });
    } catch (error) {
      return res.status(500).json({ error: "subscription-suspension-failed", message: error instanceof Error ? error.message : "Unknown error" });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const localAssets = await bootstrapLocalDemoAssets();
  if (localAssets.copied) {
    console.log(`[Demo] ${localAssets.copied} visual assets copied to the persistent volume`);
  }

  const demoAssetSync = await syncExistingDemoDirectoryAssets();
  if (demoAssetSync.updated) {
    console.log(`[Demo] ${demoAssetSync.updated} existing demo entries migrated to local asset URLs`);
  }

  const demoBootstrap = await bootstrapDemoDirectoryIfEmpty();
  if (demoBootstrap.seeded) {
    console.log("[Demo] Initial showcase directory created for an empty database");
  }

  const port = getRuntimePort();

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });
}

startServer().catch(console.error);
