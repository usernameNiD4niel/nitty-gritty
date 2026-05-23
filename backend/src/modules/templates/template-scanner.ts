import AdmZip from "adm-zip";
import { mkdir, mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ignore from "ignore";

export type DetectedValue = {
  id: string;
  value: string;
  occurrences: number;
};

const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".html", ".css", ".scss", ".json", ".md"]);
const MAX_SCAN_FILE_SIZE_BYTES = 1024 * 1024;
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
const COLOR_PATTERN =
  /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)|hsl\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*\)/g;

export async function downloadZip(zipUrl: string) {
  const response = await fetch(zipUrl);

  if (!response.ok) {
    throw new Error(`Failed to download uploaded zip: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function scanTemplateZip(zipBuffer: Buffer) {
  const workDir = await mkdtemp(path.join(os.tmpdir(), "nitty-gritty-"));
  const extractDir = path.join(workDir, "project");

  try {
    await extractTemplateZip(zipBuffer, extractDir);
    return scanTemplateDirectory(extractDir);
  } finally {
    await rm(workDir, {
      recursive: true,
      force: true,
    });
  }
}

export async function extractTemplateZip(zipBuffer: Buffer, extractDir: string) {
  await rm(extractDir, {
    recursive: true,
    force: true,
  });
  await mkdir(extractDir, {
    recursive: true,
  });

  const zip = new AdmZip(zipBuffer);

  for (const entry of zip.getEntries()) {
    const entryName = entry.entryName.replace(/\\/g, "/");

    if (entry.isDirectory || isUnsafeArchivePath(entryName) || shouldAlwaysIgnore(entryName)) {
      continue;
    }

    const targetPath = path.resolve(extractDir, entryName);
    const relativeTargetPath = path.relative(extractDir, targetPath);

    if (relativeTargetPath.startsWith("..") || path.isAbsolute(relativeTargetPath)) {
      continue;
    }

    zip.extractEntryTo(entry, extractDir, true, true);
  }
}

export async function scanTemplateDirectory(rootDir: string) {
  const gitIgnore = await loadGitIgnore(rootDir);
  const files = await collectScanFiles(rootDir, rootDir, gitIgnore);
  const textCounts = new Map<string, number>();
  const colorCounts = new Map<string, number>();

  for (const filePath of files) {
    const content = await readFile(filePath, "utf8");

    for (const text of detectTexts(content, path.extname(filePath))) {
      textCounts.set(text, (textCounts.get(text) ?? 0) + 1);
    }

    for (const color of detectColors(content)) {
      colorCounts.set(color, (colorCounts.get(color) ?? 0) + 1);
    }
  }

  return {
    texts: toDetectedValues(textCounts, "text"),
    colors: toDetectedValues(colorCounts, "color"),
  };
}

export async function findPreviewEntry(rootDir: string) {
  const candidates = ["index.html", "public/index.html", "src/index.html"];

  for (const candidate of candidates) {
    const fullPath = path.join(rootDir, candidate);

    try {
      const fileStats = await stat(fullPath);

      if (fileStats.isFile()) {
        return candidate.replace(/\\/g, "/");
      }
    } catch {
      continue;
    }
  }

  return null;
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

async function collectScanFiles(rootDir: string, currentDir: string, gitIgnore: ReturnType<typeof ignore>) {
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
      files.push(...(await collectScanFiles(rootDir, fullPath, gitIgnore)));
      continue;
    }

    if (!entry.isFile() || !ALLOWED_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }

    if ((await stat(fullPath)).size <= MAX_SCAN_FILE_SIZE_BYTES) {
      files.push(fullPath);
    }
  }

  return files;
}

function detectTexts(content: string, extension: string) {
  const candidates = new Set<string>();
  const stringLiteralPattern = /(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let match: RegExpExecArray | null;

  while ((match = stringLiteralPattern.exec(content)) !== null) {
    const value = normalizeText(match[2]);

    if (isUserFacingText(value)) {
      candidates.add(value);
    }
  }

  if (extension === ".html" || extension === ".tsx" || extension === ".jsx") {
    const htmlTextPattern = />\s*([^<>{}][^<>{}]*)\s*</g;

    while ((match = htmlTextPattern.exec(content)) !== null) {
      const value = normalizeText(match[1]);

      if (isUserFacingText(value)) {
        candidates.add(value);
      }
    }
  }

  return [...candidates];
}

function detectColors(content: string) {
  return [...content.matchAll(COLOR_PATTERN)].map((match) => normalizeColor(match[0]));
}

function isUserFacingText(value: string) {
  if (value.length < 3) {
    return false;
  }

  if (/^https?:\/\//i.test(value) || /^(\/|\.\.?\/|@\/)/.test(value)) {
    return false;
  }

  if (/^[A-Z0-9_]+$/.test(value)) {
    return false;
  }

  if (/^[a-z0-9@/_-]+(?:\.[a-z0-9/_-]+)+$/i.test(value)) {
    return false;
  }

  if (isMostlySymbols(value) || isLikelyTailwindClassList(value)) {
    return false;
  }

  return /[a-zA-Z]/.test(value);
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
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

function isUnsafeArchivePath(entryName: string) {
  return entryName.startsWith("/") || entryName.split("/").includes("..");
}

function isMostlySymbols(value: string) {
  const symbols = value.replace(/[a-zA-Z0-9\s]/g, "").length;
  return symbols / value.length > 0.5;
}

function isLikelyTailwindClassList(value: string) {
  const parts = value.split(/\s+/).filter(Boolean);

  if (parts.length < 2) {
    return false;
  }

  const classLikeParts = parts.filter((part) => /^[a-z]+(?:[-:/[\]#.%0-9]+[a-z0-9\]])*$/i.test(part));
  return classLikeParts.length / parts.length > 0.8;
}

function toDetectedValues(values: Map<string, number>, prefix: "text" | "color") {
  return [...values.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([value, occurrences], index) => ({
      id: `${prefix}_${index + 1}`,
      value,
      occurrences,
    }));
}
