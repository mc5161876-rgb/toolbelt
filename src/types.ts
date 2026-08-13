export const CATEGORIES = [
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
] as const;

export type Category = (typeof CATEGORIES)[number];

export type UseCase = {
  id: string;
  text: string;
  createdAt: string;
};

export type SavedSite = {
  id: string;
  url: string;
  canonicalUrl: string;
  title: string;
  domain: string;
  itemKind?: "website" | "local-html";
  description: string;
  category: Category;
  tags: string[];
  uses: UseCase[];
  faviconUrl?: string;
  previewImageUrl?: string;
  brandColor?: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
  openCount: number;
  archivedAt?: string;
};

export type SiteDraft = {
  id?: string;
  url: string;
  title: string;
  description?: string;
  category: Category;
  tags?: string[];
  purpose: string;
  faviconUrl?: string;
  previewImageUrl?: string;
  brandColor?: string;
};

export type ToolbeltApi = {
  listSites: () => Promise<SavedSite[]>;
  saveSite: (draft: SiteDraft) => Promise<SavedSite>;
  toggleFavorite: (id: string) => Promise<SavedSite[]>;
  archiveSite: (id: string) => Promise<SavedSite[]>;
  restoreSite: (id: string) => Promise<SavedSite[]>;
  markOpened: (id: string) => Promise<SavedSite[]>;
  openExternal: (url: string) => Promise<void>;
  exportLibrary: () => Promise<string | null>;
  onLibraryChanged: (listener: () => void) => () => void;
};

declare global {
  interface Window {
    toolbelt?: ToolbeltApi;
  }
}
