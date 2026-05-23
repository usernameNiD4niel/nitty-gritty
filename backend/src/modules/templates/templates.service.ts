import type { Template } from "@prisma/client";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../../lib/env.js";
import { prisma } from "../../lib/prisma.js";
import { prepareTemplatePreview } from "./template-preview.js";
import {
  createModifiedTemplateCopy,
  normalizeStoredReplacements,
  applyReplacementsToBuiltAssets,
  ReplacementValidationError,
  textExistsInReplaceableFiles,
  type TemplateReplacements,
  validateReplacementPayload,
  zipDirectory,
} from "./template-replacements.js";
import { extractTemplateZip, scanTemplateDirectory } from "./template-scanner.js";

type TextReplacement = {
  from: string;
  to: string;
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
    const previewDir = path.join(templateDir, "preview");

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
      const previewEntry = await prepareTemplatePreview(sourceDir, previewDir);

      return prisma.template.update({
        where: {
          id,
        },
        data: {
          status: "READY",
          originalZipUrl: originalZipPath,
          previewUrl: previewEntry ? `/templates-preview/${id}/preview/${previewEntry}` : null,
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
        text.value.trim().toLowerCase().includes(normalizedFrom),
    );
    const existsInFiles = await textExistsInReplaceableFiles(getTemplatePaths(id).sourceDir, from);

    return {
      found: Boolean(match) || existsInFiles,
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
    const replacements = normalizeStoredReplacements(template.replacements);
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

  async saveReplacements(id: string, payload: unknown) {
    const template = await this.getTemplate(id);
    const replacements = validateReplacementPayload(payload);
    const detectedTexts = Array.isArray(template.detectedTexts) ? template.detectedTexts : [];
    const paths = getTemplatePaths(id);

    for (const replacement of replacements.texts) {
      const existsInDetectedTexts = detectedTexts.some(
        (text) =>
          isDetectedText(text) &&
          text.value.trim().toLowerCase().includes(replacement.from.trim().toLowerCase()),
      );
      const existsInFiles = await textExistsInReplaceableFiles(paths.sourceDir, replacement.from);

      if (!existsInDetectedTexts && !existsInFiles) {
        throw new TemplateValidationError(`Text replacement not found: ${replacement.from}`);
      }
    }

    return prisma.template.update({
      where: {
        id,
      },
      data: {
        replacements,
      },
    });
  }

  async createPreview(id: string) {
    const template = await this.getTemplate(id);
    const replacements = normalizeStoredReplacements(template.replacements);
    const paths = getTemplatePaths(id);

    await assertSourceExists(paths.sourceDir);

    const previewEntry = await prepareTemplatePreview(paths.sourceDir, paths.previewDir);
    await applyReplacementsToBuiltAssets(paths.previewDir, replacements);
    const previewUrl = previewEntry ? `/templates-preview/${id}/preview/${previewEntry}` : null;

    const updatedTemplate = await prisma.template.update({
      where: {
        id,
      },
      data: {
        previewUrl,
      },
    });

    return {
      previewUrl,
      template: updatedTemplate,
    };
  }

  async generateTemplate(id: string) {
    const template = await this.getTemplate(id);
    const replacements = normalizeStoredReplacements(template.replacements);
    const hasReplacements = replacements.texts.length > 0 || replacements.colors.length > 0;

    if (!template.originalZipUrl) {
      throw new TemplateValidationError("Original template zip is missing.");
    }

    if (!hasReplacements) {
      throw new TemplateValidationError("At least one replacement is required before generating code.");
    }

    const paths = getTemplatePaths(id);
    await assertSourceExists(paths.sourceDir);
    await createModifiedTemplateCopy(paths.sourceDir, paths.generatedSourceDir, replacements);
    await zipDirectory(paths.generatedSourceDir, paths.generatedZipPath);

    await prisma.template.update({
      where: {
        id,
      },
      data: {
        status: "GENERATED",
        generatedZipUrl: paths.generatedZipPath,
      },
    });

    return {
      id,
      status: "GENERATED",
      downloadUrl: `/api/templates/${id}/download`,
    };
  }

  async getGeneratedZipStream(id: string) {
    const template = await this.getTemplate(id);

    if (!template.generatedZipUrl) {
      throw new TemplateNotFoundError("Generated zip not found.");
    }

    try {
      await stat(template.generatedZipUrl);
    } catch {
      throw new TemplateNotFoundError("Generated zip not found.");
    }

    return {
      fileName: `${template.name.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}-generated.zip`,
      stream: createReadStream(template.generatedZipUrl),
    };
  }
}

export class TemplateValidationError extends Error {
  statusCode = 400;
}

export class TemplateNotFoundError extends Error {
  statusCode = 404;

  constructor(message = "Template not found.") {
    super(message);
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

function getTemplatePaths(templateId: string) {
  const templateDir = getTemplateStoragePath(templateId);

  return {
    templateDir,
    sourceDir: path.join(templateDir, "source"),
    previewDir: path.join(templateDir, "preview"),
    modifiedDir: path.join(templateDir, "modified"),
    generatedSourceDir: path.join(templateDir, "generated-source"),
    generatedZipPath: path.join(templateDir, "generated.zip"),
  };
}

function isDetectedText(value: unknown): value is { id: string; value: string; occurrences: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "value" in value &&
    typeof value.value === "string"
  );
}

async function assertSourceExists(sourceDir: string) {
  try {
    const sourceStats = await stat(sourceDir);

    if (!sourceStats.isDirectory()) {
      throw new Error("Template source directory is not available.");
    }
  } catch {
    throw new TemplateValidationError("Template source directory is not available.");
  }
}

export { ReplacementValidationError };
