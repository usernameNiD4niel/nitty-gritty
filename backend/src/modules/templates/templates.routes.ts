import type { FastifyInstance } from "fastify";
import { TemplatesService } from "./templates.service.js";

export async function templatesRoutes(app: FastifyInstance) {
  const templatesService = new TemplatesService();

  app.get("/templates/status", async () => templatesService.getStatus());
}
