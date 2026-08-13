import type { SavedSite, SiteDraft } from "./types";

const now = new Date().toISOString();

export const recentDesignSeed: SavedSite = {
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
      createdAt: now,
    },
  ],
  faviconUrl: "https://recent.design/favicon.svg",
  previewImageUrl: "https://recent.design/og.png",
  brandColor: "#e05aa8",
  favorite: true,
  createdAt: now,
  updatedAt: now,
  openCount: 0,
};

export function draftToSite(draft: SiteDraft, current?: SavedSite): SavedSite {
  const timestamp = new Date().toISOString();
  const url = new URL(draft.url);
  const localHtml = url.protocol === "file:";
  const useExists = current?.uses.some(
    (item) => item.text.toLocaleLowerCase() === draft.purpose.trim().toLocaleLowerCase(),
  );
  return {
    id: current?.id ?? crypto.randomUUID(),
    url: url.toString(),
    canonicalUrl: localHtml ? url.toString() : `${url.origin}${url.pathname.replace(/\/$/, "") || "/"}`,
    title: draft.title.trim(),
    domain: localHtml ? "Local HTML" : url.hostname.replace(/^www\./, ""),
    itemKind: localHtml ? "local-html" : "website",
    description: draft.description?.trim() ?? "",
    category: draft.category,
    tags: [...new Set((draft.tags ?? []).map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean))],
    uses:
      current && useExists
        ? current.uses
        : [
            ...(current?.uses ?? []),
            { id: crypto.randomUUID(), text: draft.purpose.trim(), createdAt: timestamp },
          ],
    faviconUrl: draft.faviconUrl || current?.faviconUrl,
    previewImageUrl: draft.previewImageUrl || current?.previewImageUrl,
    brandColor: draft.brandColor || current?.brandColor,
    favorite: current?.favorite ?? false,
    createdAt: current?.createdAt ?? timestamp,
    updatedAt: timestamp,
    lastOpenedAt: current?.lastOpenedAt,
    openCount: current?.openCount ?? 0,
    archivedAt: undefined,
  };
}
