import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { createServer } from "node:http";
import { mkdir, readFile, realpath, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAPTURE_PORT = 47321;
const smokeMode = process.env.TOOLBELT_SMOKE === "1";
const VALID_CATEGORIES = new Set([
  "Design & Inspiration",
  "Documents & PDFs",
  "Images & Graphics",
  "Video & Audio",
  "Research & Reference",
  "AI & Automation",
  "Development & Web",
  "Business & Marketing",
  "Construction & Field",
  "Utilities & Converters",
  "Learning & Careers",
  "Other",
]);

let mainWindow;
let captureServer;

function now() {
  return new Date().toISOString();
}

async function normalizeSavedUrl(rawUrl) {
  const parsed = new URL(rawUrl);
  if (["http:", "https:"].includes(parsed.protocol)) {
    parsed.hash = "";
    parsed.search = "";
    const pathname = parsed.pathname.replace(/\/$/, "") || "/";
    return {
      url: new URL(rawUrl).toString(),
      canonicalUrl: `${parsed.origin}${pathname}`,
      domain: parsed.hostname.replace(/^www\./, ""),
      itemKind: "website",
    };
  }
  if (parsed.protocol !== "file:") {
    throw new Error("Save a web URL or a local HTML file.");
  }
  const requestedPath = fileURLToPath(parsed);
  if (![".html", ".htm"].includes(path.extname(requestedPath).toLowerCase())) {
    throw new Error("Only local HTML files (.html or .htm) can be saved.");
  }
  let fileInfo;
  try {
    fileInfo = await stat(requestedPath);
  } catch {
    throw new Error("That local HTML file could not be found.");
  }
  if (!fileInfo.isFile()) throw new Error("That local HTML path is not a file.");
  const resolvedUrl = pathToFileURL(await realpath(requestedPath)).toString();
  return {
    url: resolvedUrl,
    canonicalUrl: resolvedUrl,
    domain: "Local HTML",
    itemKind: "local-html",
  };
}

function cleanText(value, maxLength, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maxLength);
}

function seedSite() {
  const timestamp = now();
  return {
    id: "seed-recent-design",
    url: "https://recent.design/",
    canonicalUrl: "https://recent.design/",
    title: "Recent — Design Inspiration",
    domain: "recent.design",
    description: "A daily curation of exceptional design, websites and tools.",
    category: "Design & Inspiration",
    tags: ["ui", "design", "inspiration", "websites"],
    uses: [
      {
        id: "seed-use-recent-design",
        text: "Use when I’m building a UI and need real design inspiration.",
        createdAt: timestamp,
      },
    ],
    faviconUrl: "https://recent.design/favicon.svg",
    previewImageUrl: "https://recent.design/og.png",
    brandColor: "#e05aa8",
    favorite: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    openCount: 0,
  };
}

function upgradeSiteMetadata(site) {
  const upgraded = { ...site };
  if (site.domain === "recent.design" || site.canonicalUrl === "https://recent.design/") {
    upgraded.faviconUrl = "https://recent.design/favicon.svg";
    upgraded.previewImageUrl ||= "https://recent.design/og.png";
    upgraded.brandColor ||= "#e05aa8";
    if (!upgraded.lastOpenedAt && upgraded.openCount === 1) upgraded.openCount = 0;
  } else if (!upgraded.faviconUrl) {
    try {
      upgraded.faviconUrl = `${new URL(site.url).origin}/favicon.ico`;
    } catch {
      upgraded.faviconUrl = "";
    }
  }
  return upgraded;
}

class LibraryStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.sites = [];
    this.writeQueue = Promise.resolve();
  }

  async init() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8"));
      const loaded = Array.isArray(parsed.sites) ? parsed.sites : [seedSite()];
      this.sites = loaded.map(upgradeSiteMetadata);
      if (JSON.stringify(loaded) !== JSON.stringify(this.sites)) await this.persist();
    } catch (error) {
      if (error?.code !== "ENOENT") {
        const backup = `${this.filePath}.corrupt-${Date.now()}`;
        try {
          await rename(this.filePath, backup);
        } catch {
          // If the damaged file cannot be renamed, preserve it and continue in memory.
        }
      }
      this.sites = [seedSite()];
      await this.persist();
    }
  }

  list() {
    return structuredClone(this.sites);
  }

  async persist() {
    const payload = JSON.stringify({ version: 1, sites: this.sites }, null, 2);
    const temporary = `${this.filePath}.tmp`;
    this.writeQueue = this.writeQueue.then(async () => {
      await writeFile(temporary, payload, "utf8");
      await rename(temporary, this.filePath);
    });
    await this.writeQueue;
  }

  async save(draft) {
    if (!draft || typeof draft !== "object") throw new Error("Invalid item details.");
    const url = cleanText(draft.url, 2048);
    const normalized = await normalizeSavedUrl(url);
    const titleFallback = normalized.itemKind === "local-html"
      ? path.basename(fileURLToPath(normalized.url), path.extname(fileURLToPath(normalized.url)))
      : normalized.domain;
    const title = cleanText(draft.title, 180, titleFallback);
    const purpose = cleanText(draft.purpose, 360);
    if (!purpose) throw new Error("Add a short ‘Use this when…’ reason before saving.");
    const category = VALID_CATEGORIES.has(draft.category) ? draft.category : "Other";
    const timestamp = now();
    const existing = this.sites.find((site) => site.id === draft.id || site.canonicalUrl === normalized.canonicalUrl);
    const tags = Array.isArray(draft.tags)
      ? [...new Set(draft.tags.map((tag) => cleanText(tag, 36).toLowerCase()).filter(Boolean))].slice(0, 12)
      : existing?.tags ?? [];
    const uses = existing?.uses ? [...existing.uses] : [];
    if (!uses.some((item) => item.text.toLowerCase() === purpose.toLowerCase())) {
      uses.push({ id: randomUUID(), text: purpose, createdAt: timestamp });
    }
    const site = {
      id: existing?.id ?? randomUUID(),
      url: normalized.url,
      canonicalUrl: normalized.canonicalUrl,
      title,
      domain: normalized.domain,
      itemKind: normalized.itemKind,
      description: cleanText(draft.description, 600, existing?.description ?? ""),
      category,
      tags,
      uses,
      faviconUrl: cleanText(draft.faviconUrl, 2048, existing?.faviconUrl ?? ""),
      previewImageUrl: cleanText(draft.previewImageUrl, 2048, existing?.previewImageUrl ?? ""),
      brandColor: /^#[0-9a-f]{3,8}$/i.test(cleanText(draft.brandColor, 9))
        ? cleanText(draft.brandColor, 9)
        : existing?.brandColor,
      favorite: existing?.favorite ?? false,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      lastOpenedAt: existing?.lastOpenedAt,
      openCount: existing?.openCount ?? 0,
      archivedAt: undefined,
    };
    this.sites = existing
      ? this.sites.map((item) => (item.id === existing.id ? site : item))
      : [site, ...this.sites];
    await this.persist();
    return structuredClone(site);
  }

  async change(id, transform) {
    let found = false;
    this.sites = this.sites.map((site) => {
      if (site.id !== id) return site;
      found = true;
      return { ...transform(site), updatedAt: now() };
    });
    if (!found) throw new Error("That saved site no longer exists.");
    await this.persist();
    return this.list();
  }
}

let store;

function notifyLibraryChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("library:changed");
}

function registerIpc() {
  ipcMain.handle("library:list", () => store.list());
  ipcMain.handle("library:save", async (_event, draft) => {
    const site = await store.save(draft);
    notifyLibraryChanged();
    return site;
  });
  ipcMain.handle("library:toggle-favorite", async (_event, id) => {
    const sites = await store.change(id, (site) => ({ ...site, favorite: !site.favorite }));
    notifyLibraryChanged();
    return sites;
  });
  ipcMain.handle("library:archive", async (_event, id) => {
    const sites = await store.change(id, (site) => ({ ...site, archivedAt: now() }));
    notifyLibraryChanged();
    return sites;
  });
  ipcMain.handle("library:restore", async (_event, id) => {
    const sites = await store.change(id, (site) => ({ ...site, archivedAt: undefined }));
    notifyLibraryChanged();
    return sites;
  });
  ipcMain.handle("library:mark-opened", async (_event, id) => {
    const sites = await store.change(id, (site) => ({
      ...site,
      lastOpenedAt: now(),
      openCount: site.openCount + 1,
    }));
    notifyLibraryChanged();
    return sites;
  });
  ipcMain.handle("app:open-external", async (_event, rawUrl) => {
    const url = new URL(rawUrl);
    if (["http:", "https:"].includes(url.protocol)) {
      await shell.openExternal(url.toString());
      return;
    }
    if (url.protocol === "file:" && [".html", ".htm"].includes(path.extname(fileURLToPath(url)).toLowerCase())) {
      const error = await shell.openPath(fileURLToPath(url));
      if (error) throw new Error(error);
      return;
    }
    throw new Error("Only web links and local HTML files can be opened.");
  });
  ipcMain.handle("library:export", async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Export Toolbelt library",
      defaultPath: `toolbelt-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON backup", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) return null;
    await writeFile(result.filePath, JSON.stringify({ version: 1, sites: store.list() }, null, 2), "utf8");
    return result.filePath;
  });
}

function setCors(response, origin) {
  if (origin?.startsWith("chrome-extension://")) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Toolbelt-Capture");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function startCaptureServer() {
  captureServer = createServer((request, response) => {
    const origin = request.headers.origin ?? "";
    setCors(response, origin);
    if (request.method === "OPTIONS") {
      response.writeHead(204).end();
      return;
    }
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: true, app: "Toolbelt" }));
      return;
    }
    if (request.method !== "POST" || request.url !== "/captures") {
      response.writeHead(404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: false, error: "Not found" }));
      return;
    }
    if (!origin.startsWith("chrome-extension://") || request.headers["x-toolbelt-capture"] !== "1") {
      response.writeHead(403, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: false, error: "Capture origin not allowed" }));
      return;
    }
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) request.destroy();
    });
    request.on("end", async () => {
      try {
        const saved = await store.save(JSON.parse(body));
        notifyLibraryChanged();
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ ok: true, id: saved.id }));
      } catch (error) {
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ ok: false, error: error.message }));
      }
    });
  });
  captureServer.on("error", (error) => {
    console.error("Toolbelt capture server failed:", error);
  });
  captureServer.listen(CAPTURE_PORT, "127.0.0.1");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1040,
    minHeight: 700,
    backgroundColor: "#09101d",
    title: "Toolbelt",
    icon: path.join(__dirname, "..", "assets", "toolbelt-icon-master.png"),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  mainWindow.once("ready-to-show", () => {
    if (smokeMode) {
      console.log("[toolbelt-smoke] desktop window loaded");
      setTimeout(() => app.quit(), 30_000);
      return;
    }
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (["http:", "https:"].includes(parsed.protocol)) void shell.openExternal(parsed.toString());
    } catch {
      // Ignore malformed links.
    }
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://") && !url.startsWith("http://127.0.0.1:5173")) event.preventDefault();
  });
  if (app.isPackaged) {
    void mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  } else {
    void mainWindow.loadURL("http://127.0.0.1:5173");
  }
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  if (smokeMode) app.setPath("userData", path.join(app.getPath("temp"), "toolbelt-smoke-profile"));
  store = new LibraryStore(path.join(app.getPath("userData"), "toolbelt-library.json"));
  await store.init();
  registerIpc();
  startCaptureServer();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  captureServer?.close();
});
