import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import path from "node:path";
import { env } from "./lib/env.js";
import { templatesRoutes } from "./modules/templates/templates.routes.js";

export function buildApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: env.maxUploadBytes,
  });

  app.register(cors, {
    origin: true,
  });

  app.register(multipart, {
    limits: {
      fileSize: env.maxUploadBytes,
      files: 1,
    },
  });

  app.register(fastifyStatic, {
    root: path.resolve(process.cwd(), env.localTemplateStorageDir),
    prefix: "/templates-preview/",
    decorateReply: false,
    serveDotFiles: false,
  });

  app.get("/health", async () => ({
    status: "ok",
  }));

  app.register(templatesRoutes, {
    prefix: "/api",
  });

  return app;
}
