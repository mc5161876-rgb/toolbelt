import { draftToSite, recentDesignSeed } from "./demoData";
import type { SavedSite, SiteDraft, ToolbeltApi } from "./types";

const DEMO_KEY = "toolbelt-demo-library-v5";

function loadDemo(): SavedSite[] {
  try {
    const value = localStorage.getItem(DEMO_KEY);
    return value ? (JSON.parse(value) as SavedSite[]) : [recentDesignSeed];
  } catch {
    return [recentDesignSeed];
  }
}

function saveDemo(sites: SavedSite[]) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(sites));
  window.dispatchEvent(new Event("toolbelt:changed"));
}

const demoApi: ToolbeltApi = {
  listSites: async () => loadDemo(),
  saveSite: async (draft: SiteDraft) => {
    const sites = loadDemo();
    const canonical = new URL(draft.url);
    const canonicalUrl = canonical.protocol === "file:"
      ? canonical.toString()
      : `${canonical.origin}${canonical.pathname.replace(/\/$/, "") || "/"}`;
    const current = sites.find((site) => site.id === draft.id || site.canonicalUrl === canonicalUrl);
    const site = draftToSite(draft, current);
    saveDemo(current ? sites.map((item) => (item.id === current.id ? site : item)) : [site, ...sites]);
    return site;
  },
  toggleFavorite: async (id) => {
    const sites = loadDemo().map((site) => (site.id === id ? { ...site, favorite: !site.favorite } : site));
    saveDemo(sites);
    return sites;
  },
  archiveSite: async (id) => {
    const sites = loadDemo().map((site) =>
      site.id === id ? { ...site, archivedAt: new Date().toISOString() } : site,
    );
    saveDemo(sites);
    return sites;
  },
  restoreSite: async (id) => {
    const sites = loadDemo().map((site) => (site.id === id ? { ...site, archivedAt: undefined } : site));
    saveDemo(sites);
    return sites;
  },
  markOpened: async (id) => {
    const sites = loadDemo().map((site) =>
      site.id === id
        ? { ...site, lastOpenedAt: new Date().toISOString(), openCount: site.openCount + 1 }
        : site,
    );
    saveDemo(sites);
    return sites;
  },
  openExternal: async (url) => {
    window.open(url, "_blank", "noopener,noreferrer");
  },
  exportLibrary: async () => {
    const blob = new Blob([JSON.stringify(loadDemo(), null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `toolbelt-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    return link.download;
  },
  onLibraryChanged: (listener) => {
    window.addEventListener("toolbelt:changed", listener);
    return () => window.removeEventListener("toolbelt:changed", listener);
  },
};

export const api: ToolbeltApi = window.toolbelt ?? demoApi;
