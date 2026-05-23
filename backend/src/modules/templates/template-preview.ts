import { spawn } from "node:child_process";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const BUILD_OUTPUT_DIRS = ["dist", "build", "out"];

export async function prepareTemplatePreview(sourceDir: string, previewDir: string) {
  await rm(previewDir, {
    recursive: true,
    force: true,
  });
  await mkdir(previewDir, {
    recursive: true,
  });

  const projectRoot = await findPreviewProjectRoot(sourceDir);

  if (!projectRoot) {
    return null;
  }

  if (await hasBuildScript(projectRoot)) {
    try {
      await runNpm(["install", "--ignore-scripts"], projectRoot, 300_000);
      await runNpm(["run", "build"], projectRoot, 300_000);
    } catch {
      // Some tools can emit a usable build before returning a non-zero status.
    }

    const outputDir = await findBuildOutputDir(projectRoot);

    if (outputDir) {
      await cp(outputDir, previewDir, {
        recursive: true,
      });
      await rewritePreviewAssetUrls(path.join(previewDir, "index.html"));

      return "index.html";
    }
  }

  const indexPath = await findIndexHtml(projectRoot);

  if (!indexPath) {
    return null;
  }

  if (await isBundledAppIndex(indexPath)) {
    return null;
  }

  await cp(path.dirname(indexPath), previewDir, {
    recursive: true,
  });

  return path.relative(projectRoot, indexPath).replace(/\\/g, "/");
}

async function findPreviewProjectRoot(rootDir: string) {
  const packageJsonRoots = await findFiles(rootDir, "package.json");

  for (const packageJsonPath of packageJsonRoots) {
    const projectRoot = path.dirname(packageJsonPath);

    if (await findIndexHtml(projectRoot)) {
      return projectRoot;
    }
  }

  const indexHtml = await findIndexHtml(rootDir);
  return indexHtml ? path.dirname(indexHtml) : null;
}

async function hasBuildScript(projectRoot: string) {
  try {
    const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    return typeof packageJson.scripts?.build === "string";
  } catch {
    return false;
  }
}

async function findBuildOutputDir(projectRoot: string) {
  for (const dirName of BUILD_OUTPUT_DIRS) {
    const outputDir = path.join(projectRoot, dirName);

    try {
      const outputStats = await stat(path.join(outputDir, "index.html"));

      if (outputStats.isFile()) {
        return outputDir;
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function findIndexHtml(rootDir: string) {
  const candidates = ["index.html", "public/index.html", "src/index.html"];

  for (const candidate of candidates) {
    const fullPath = path.join(rootDir, candidate);

    try {
      const fileStats = await stat(fullPath);

      if (fileStats.isFile()) {
        return fullPath;
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function isBundledAppIndex(indexPath: string) {
  const content = await readFile(indexPath, "utf8");
  return /<script[^>]+type=["']module["'][^>]+src=["'][^"']+\.(tsx?|jsx?)["']/i.test(content);
}

async function rewritePreviewAssetUrls(indexPath: string) {
  const content = await readFile(indexPath, "utf8");
  const rewritten = content
    .replaceAll('src="/assets/', 'src="./assets/')
    .replaceAll("src='/assets/", "src='./assets/")
    .replaceAll('href="/assets/', 'href="./assets/')
    .replaceAll("href='/assets/", "href='./assets/");

  await writeFile(indexPath, rewritten);
}

async function findFiles(rootDir: string, fileName: string) {
  const results: string[] = [];
  const entries = await readdir(rootDir, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") {
      continue;
    }

    const fullPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      results.push(...(await findFiles(fullPath, fileName)));
      continue;
    }

    if (entry.isFile() && entry.name === fileName) {
      results.push(fullPath);
    }
  }

  return results;
}

function runCommand(command: string, args: string[], cwd: string, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: "ignore",
    });
    const timeout = windowlessTimeout(() => {
      child.kill();
      reject(new Error(`${command} ${args.join(" ")} timed out.`));
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with code ${code}.`));
      }
    });
  });
}

function runNpm(args: string[], cwd: string, timeoutMs: number) {
  if (process.platform === "win32") {
    return runCommand("cmd.exe", ["/d", "/s", "/c", "npm.cmd", ...args], cwd, timeoutMs);
  }

  return runCommand("npm", args, cwd, timeoutMs);
}

function windowlessTimeout(callback: () => void, timeoutMs: number) {
  return setTimeout(callback, timeoutMs);
}
