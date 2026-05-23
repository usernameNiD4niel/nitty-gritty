import type { Template } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../../lib/env.js";
import { prisma } from "../../lib/prisma.js";
import { extractTemplateZip, findPreviewEntry, scanTemplateDirectory } from "./template-scanner.js";

type TextReplacement = {
  from: string;
  to: string;
};

type TemplateReplacements = {
  texts?: TextReplacement[];
  colors?: Array<{ from: string; to: string }>;
};

export class TemplatesService {
  async createTemplate(name: string) {
    const trimmedName = name.trim();

    if (!trimmedName) {
      throw new TemplateValidationError("Template name is required.");
    }

    const template = await prisma.template.create({
      data: {
        name: trimmedName,
      },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    return template;
  }

  async getTemplate(id: string) {
    const template = await prisma.template.findUnique({
      where: {
        id,
      },
    });

    if (!template) {
      throw new TemplateNotFoundError();
    }

    return template;
  }

  async uploadOriginalZip(id: string, fileName: string, fileBuffer: Buffer): Promise<Template> {
    if (!fileName.toLowerCase().endsWith(".zip")) {
      throw new TemplateValidationError("Only .zip files are allowed.");
    }

    const template = await prisma.template.findUnique({
      where: {
        id,
      },
    });

    if (!template) {
      throw new TemplateNotFoundError();
    }

    const templateDir = getTemplateStoragePath(id);
    const originalZipPath = path.join(templateDir, "original.zip");
    const sourceDir = path.join(templateDir, "source");

    await mkdir(templateDir, {
      recursive: true,
    });
    await writeFile(originalZipPath, fileBuffer);

    try {
      await prisma.template.update({
        where: {
          id,
        },
        data: {
          status: "PROCESSING",
          originalZipUrl: originalZipPath,
        },
      });

      await extractTemplateZip(fileBuffer, sourceDir);
      const detectedValues = await scanTemplateDirectory(sourceDir);
      const previewEntry = await findPreviewEntry(sourceDir);

      return prisma.template.update({
        where: {
          id,
        },
        data: {
          status: "READY",
          originalZipUrl: originalZipPath,
          previewUrl: previewEntry ? `/templates-preview/${id}/source/${previewEntry}` : null,
          detectedTexts: detectedValues.texts,
          detectedColors: detectedValues.colors,
        },
      });
    } catch (error) {
      await prisma.template.update({
        where: {
          id,
        },
        data: {
          status: "FAILED",
        },
      });

      throw error;
    }
  }

  async getDetectedValues(id: string) {
    const template = await prisma.template.findUnique({
      where: {
        id,
      },
      select: {
        detectedTexts: true,
        detectedColors: true,
      },
    });

    if (!template) {
      throw new TemplateNotFoundError();
    }

    return {
      texts: template.detectedTexts ?? [],
      colors: template.detectedColors ?? [],
    };
  }

  async validateTextValue(id: string, from: string) {
    const template = await this.getTemplate(id);
    const normalizedFrom = from.trim().toLowerCase();

    if (!normalizedFrom) {
      throw new TemplateValidationError("From value is required.");
    }

    const detectedTexts = Array.isArray(template.detectedTexts) ? template.detectedTexts : [];
    const match = detectedTexts.find(
      (text) =>
        isDetectedText(text) &&
        text.value.trim().toLowerCase() === normalizedFrom,
    );

    return {
      found: Boolean(match),
      text: match ?? null,
    };
  }

  async addTextReplacement(id: string, replacement: TextReplacement) {
    const from = replacement.from.trim();
    const to = replacement.to.trim();

    if (!from || !to) {
      throw new TemplateValidationError("From and To values are required.");
    }

    const validation = await this.validateTextValue(id, from);

    if (!validation.found) {
      throw new TemplateValidationError("From value was not found in the extracted template.");
    }

    const template = await this.getTemplate(id);
    const replacements = normalizeReplacements(template.replacements);
    const nextTexts = [
      ...replacements.texts.filter((existing) => existing.from !== from),
      {
        from,
        to,
      },
    ];

    return prisma.template.update({
      where: {
        id,
      },
      data: {
        replacements: {
          ...replacements,
          texts: nextTexts,
        },
      },
    });
  }
}

export class TemplateValidationError extends Error {
  statusCode = 400;
}

export class TemplateNotFoundError extends Error {
  statusCode = 404;

  constructor() {
    super("Template not found.");
  }
}

export class TemplateStorageError extends Error {
  statusCode = 502;

  constructor(message: string) {
    super(`Supabase upload failed: ${message}`);
  }
}

function getTemplateStoragePath(templateId: string) {
  return path.resolve(process.cwd(), env.localTemplateStorageDir, templateId);
}

function isDetectedText(value: unknown): value is { id: string; value: string; occurrences: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "value" in value &&
    typeof value.value === "string"
  );
}

function normalizeReplacements(value: unknown): Required<TemplateReplacements> {
  if (!value || typeof value !== "object") {
    return {
      texts: [],
      colors: [],
    };
  }

  const replacements = value as TemplateReplacements;

  return {
    texts: Array.isArray(replacements.texts) ? replacements.texts : [],
    colors: Array.isArray(replacements.colors) ? replacements.colors : [],
  };
}
