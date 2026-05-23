import type { FastifyInstance, FastifyReply } from "fastify";
import {
  TemplateNotFoundError,
  TemplatesService,
  TemplateStorageError,
  TemplateValidationError,
} from "./templates.service.js";

type CreateTemplateBody = {
  name?: string;
};

type ValidateTextBody = {
  from?: string;
};

type AddTextReplacementBody = {
  from?: string;
  to?: string;
};

export async function templatesRoutes(app: FastifyInstance) {
  const templatesService = new TemplatesService();

  app.post<{ Body: CreateTemplateBody }>("/templates", async (request, reply) => {
    try {
      if (typeof request.body?.name !== "string") {
        throw new TemplateValidationError("Template name is required.");
      }

      const template = await templatesService.createTemplate(request.body.name);
      return reply.code(201).send(template);
    } catch (error) {
      return sendTemplateError(reply, error);
    }
  });

  app.post<{ Params: { id: string } }>("/templates/:id/upload", async (request, reply) => {
    try {
      const file = await request.file();

      if (!file) {
        throw new TemplateValidationError("Zip file is required.");
      }

      if (file.fieldname !== "file") {
        throw new TemplateValidationError('Zip file field must be named "file".');
      }

      const fileBuffer = await file.toBuffer();
      const template = await templatesService.uploadOriginalZip(
        request.params.id,
        file.filename,
        fileBuffer,
      );

      return reply.send(template);
    } catch (error) {
      return sendTemplateError(reply, error);
    }
  });

  app.get<{ Params: { id: string } }>("/templates/:id", async (request, reply) => {
    try {
      const template = await templatesService.getTemplate(request.params.id);
      return reply.send(template);
    } catch (error) {
      return sendTemplateError(reply, error);
    }
  });

  app.get<{ Params: { id: string } }>("/templates/:id/detected-values", async (request, reply) => {
    try {
      const detectedValues = await templatesService.getDetectedValues(request.params.id);
      return reply.send(detectedValues);
    } catch (error) {
      return sendTemplateError(reply, error);
    }
  });

  app.post<{ Body: ValidateTextBody; Params: { id: string } }>(
    "/templates/:id/texts/validate",
    async (request, reply) => {
      try {
        if (typeof request.body?.from !== "string") {
          throw new TemplateValidationError("From value is required.");
        }

        const result = await templatesService.validateTextValue(request.params.id, request.body.from);
        return reply.send(result);
      } catch (error) {
        return sendTemplateError(reply, error);
      }
    },
  );

  app.post<{ Body: AddTextReplacementBody; Params: { id: string } }>(
    "/templates/:id/replacements/texts",
    async (request, reply) => {
      try {
        if (typeof request.body?.from !== "string" || typeof request.body?.to !== "string") {
          throw new TemplateValidationError("From and To values are required.");
        }

        const template = await templatesService.addTextReplacement(request.params.id, {
          from: request.body.from,
          to: request.body.to,
        });

        return reply.send(template);
      } catch (error) {
        return sendTemplateError(reply, error);
      }
    },
  );
}

function sendTemplateError(reply: FastifyReply, error: unknown) {
  if (
    error instanceof TemplateValidationError ||
    error instanceof TemplateNotFoundError ||
    error instanceof TemplateStorageError
  ) {
    return reply.code(error.statusCode).send({
      error: error.message,
    });
  }

  if (isPayloadTooLargeError(error)) {
    return reply.code(413).send({
      error: "Uploaded zip is larger than the configured upload limit.",
    });
  }

  throw error;
}

function isPayloadTooLargeError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    error.statusCode === 413
  );
}
