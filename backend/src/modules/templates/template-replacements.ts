import AdmZip from "adm-zip";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import ignore from "ignore";

export type TextReplacement = {
  from: string;
  to: string;
};

export type ColorReplacement = {
  from: string;
  to: string;
};

export type TemplateReplacements = {
  texts: TextReplacement[];
  colors: ColorReplacement[];
};

const REPLACE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".html", ".css", ".scss", ".json", ".md"]);
const DENYLIST_NAMES = new Set([
  "node_modules",
  ".git",
  ".env",
  ".env.local",
  ".env.production",
  "dist",
  "build",
  ".next",
  ".vercel",
  ".ssh",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);
const DENYLIST_EXTENSIONS = new Set([".pem", ".key", ".exe", ".dll", ".so"]);

export async function createModifiedTemplateCopy(
  sourceDir: string,
  targetDir: string,
  replacements: TemplateReplacements,
) {
  await rm(targetDir, {
    recursive: true,
    force: true,
  });
  await mkdir(targetDir, {
    recursive: true,
  });
  await cp(sourceDir, targetDir, {
    recursive: true,
  });
  await applyReplacements(targetDir, replacements);
}

export async function zipDirectory(sourceDir: string, zipPath: string) {
  const zip = new AdmZip();
  const files = await collectFiles(sourceDir, sourceDir, ignore());

  for (const filePath of files) {
    const relativePath = path.relative(sourceDir, filePath).replace(/\\/g, "/");
    zip.addLocalFile(filePath, path.dirname(relativePath) === "." ? "" : path.dirname(relativePath));
  }

  await mkdir(path.dirname(zipPath), {
    recursive: true,
  });
  zip.writeZip(zipPath);
}

export async function textExistsInReplaceableFiles(sourceDir: string, text: string) {
  const needle = text.trim();

  if (!needle) {
    return false;
  }

  const gitIgnore = await loadGitIgnore(sourceDir);
  const files = await collectFiles(sourceDir, sourceDir, gitIgnore);

  for (const filePath of files) {
    if (!REPLACE_EXTENSIONS.has(path.extname(filePath))) {
      continue;
    }

    const content = await readFile(filePath, "utf8");

    if (content.includes(needle)) {
      return true;
    }
  }

  return false;
}

export function validateReplacementPayload(value: unknown): TemplateReplacements {
  if (!value || typeof value !== "object") {
    return {
      texts: [],
      colors: [],
    };
  }

  const payload = value as {
    texts?: unknown;
    colors?: unknown;
  };
  const texts = validateTextReplacements(payload.texts);
  const colors = validateColorReplacements(payload.colors);

  return {
    texts,
    colors,
  };
}

export function normalizeStoredReplacements(value: unknown): TemplateReplacements {
  return validateReplacementPayload(value);
}

async function applyReplacements(rootDir: string, replacements: TemplateReplacements) {
  const gitIgnore = await loadGitIgnore(rootDir);
  const files = await collectFiles(rootDir, rootDir, gitIgnore);

  for (const filePath of files) {
    if (!REPLACE_EXTENSIONS.has(path.extname(filePath))) {
      continue;
    }

    let content = await readFile(filePath, "utf8");

    content = applyTextReplacements(content, path.extname(filePath), replacements.texts);

    for (const replacement of replacements.colors) {
      content = content.replaceAll(replacement.from, replacement.to);
    }

    await writeFile(filePath, content);
  }
}

function applyTextReplacements(content: string, extension: string, replacements: TextReplacement[]) {
  if (extension === ".md") {
    return applyPlainTextReplacements(content, replacements);
  }

  let updated = content.replace(/(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g, (match, quote: string, value: string) => {
    if (!isUserFacingReplacementTarget(value)) {
      return match;
    }

    const nextValue = applyPlainTextReplacements(value, replacements);
    return `${quote}${nextValue}${quote}`;
  });

  if (extension === ".html" || extension === ".tsx" || extension === ".jsx") {
    updated = updated.replace(/>\s*([^<>{}][^<>{}]*)\s*</g, (match, value: string) => {
      if (!isUserFacingReplacementTarget(value)) {
        return match;
      }

      return `>${applyPlainTextReplacements(value, replacements)}<`;
    });
  }

  return updated;
}

function applyPlainTextReplacements(content: string, replacements: TextReplacement[]) {
  return replacements.reduce(
    (currentContent, replacement) => currentContent.replaceAll(replacement.from, replacement.to),
    content,
  );
}

function isUserFacingReplacementTarget(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length < 3) {
    return false;
  }

  if (/^https?:\/\//i.test(normalized) || /^(\/|\.\.?\/|@\/)/.test(normalized)) {
    return false;
  }

  if (/^[A-Z0-9_]+$/.test(normalized)) {
    return false;
  }

  if (/^[a-z0-9@/_-]+(?:\.[a-z0-9/_-]+)+$/i.test(normalized)) {
    return false;
  }

  return /[a-zA-Z]/.test(normalized);
}

async function loadGitIgnore(rootDir: string) {
  const gitIgnore = ignore();

  try {
    gitIgnore.add(await readFile(path.join(rootDir, ".gitignore"), "utf8"));
  } catch {
    return gitIgnore;
  }

  return gitIgnore;
}

async function collectFiles(rootDir: string, currentDir: string, gitIgnore: ReturnType<typeof ignore>) {
  const entries = await readdir(currentDir, {
    withFileTypes: true,
  });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, "/");

    if (shouldAlwaysIgnore(relativePath) || gitIgnore.ignores(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(rootDir, fullPath, gitIgnore)));
      continue;
    }

    if (entry.isFile() && (await stat(fullPath)).isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function validateTextReplacements(value: unknown) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ReplacementValidationError("texts must be an array.");
  }

  return value.map((item) => {
    if (!isReplacementLike(item)) {
      throw new ReplacementValidationError("Every text replacement must have from and to values.");
    }

    const from = item.from.trim();
    const to = item.to.trim();

    if (!from) {
      throw new ReplacementValidationError("Text replacement from value is required.");
    }

    return {
      from,
      to,
    };
  });
}

function validateColorReplacements(value: unknown) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ReplacementValidationError("colors must be an array.");
  }

  return value.map((item) => {
    if (!isReplacementLike(item)) {
      throw new ReplacementValidationError("Every color replacement must have from and to values.");
    }

    const from = item.from.trim();
    const to = item.to.trim();

    if (!from || !isSupportedCssColor(from) || !isSupportedCssColor(to)) {
      throw new ReplacementValidationError("Color replacements must use supported CSS color values.");
    }

    return {
      from: normalizeColor(from),
      to: normalizeColor(to),
    };
  });
}

function isReplacementLike(value: unknown): value is { from: string; to: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "from" in value &&
    "to" in value &&
    typeof value.from === "string" &&
    typeof value.to === "string"
  );
}

function isSupportedCssColor(value: string) {
  return (
    /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(value) ||
    /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(value) ||
    /^hsl\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*\)$/.test(value)
  );
}

function normalizeColor(value: string) {
  return value.startsWith("#") ? value.toLowerCase() : value;
}

function shouldAlwaysIgnore(relativePath: string) {
  const parts = relativePath.split("/");
  const fileName = parts.at(-1) ?? "";

  return (
    parts.some((part) => DENYLIST_NAMES.has(part)) ||
    DENYLIST_EXTENSIONS.has(path.extname(fileName).toLowerCase())
  );
}

export class ReplacementValidationError extends Error {
  statusCode = 400;
}
