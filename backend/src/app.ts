import cors from "@fastify/cors";
import Fastify from "fastify";
import { templatesRoutes } from "./modules/templates/templates.routes.js";

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.register(cors, {
    origin: true,
  });

  app.get("/health", async () => ({
    status: "ok",
  }));

  app.register(templatesRoutes, {
    prefix: "/api",
  });

  return app;
}
