import { type CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import {
  Archive,
  ArrowUpRight,
  BookOpen,
  Boxes,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Code2,
  Compass,
  Download,
  FileText,
  FolderOpen,
  Grid2X2,
  Heart,
  Home,
  Image,
  Lightbulb,
  Link2,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Video,
  WandSparkles,
  Wrench,
  X,
} from "lucide-react";
import { api } from "./bridge";
import { CATEGORIES, type Category, type SavedSite, type SiteDraft } from "./types";

type View = "home" | "all" | "favorites" | "archived" | `category:${Category}`;

const categoryIcons: Record<Category, typeof Search> = {
  "Design & Inspiration": Sparkles,
  "Documents & PDFs": FileText,
  "Images & Graphics": Image,
  "Video & Audio": Video,
  "Research & Reference": Compass,
  "AI & Automation": WandSparkles,
  "Development & Web": Code2,
  "Business & Marketing": BriefcaseBusiness,
  "Construction & Field": Wrench,
  "Utilities & Converters": Settings2,
  "Learning & Careers": BookOpen,
  Other: Boxes,
};

const categoryAccent: Record<Category, string> = {
  "Design & Inspiration": "violet",
  "Documents & PDFs": "cyan",
  "Images & Graphics": "magenta",
  "Video & Audio": "red",
  "Research & Reference": "blue",
  "AI & Automation": "indigo",
  "Development & Web": "teal",
  "Business & Marketing": "amber",
  "Construction & Field": "orange",
  "Utilities & Converters": "sky",
  "Learning & Careers": "green",
  Other: "slate",
};

function flattenSite(site: SavedSite) {
  return {
    ...site,
    purposeText: site.uses.map((use) => use.text).join(" "),
    tagsText: site.tags.join(" "),
  };
}

function relativeDate(value?: string) {
  if (!value) return "Not opened yet";
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return "Opened today";
  if (days === 1) return "Opened yesterday";
  if (days < 30) return `Opened ${days} days ago`;
  const months = Math.max(1, Math.floor(days / 30));
  return `Opened ${months} ${months === 1 ? "month" : "months"} ago`;
}

function viewTitle(view: View) {
  if (view === "home") return "Your Toolbelt";
  if (view === "all") return "All websites";
  if (view === "favorites") return "Favorites";
  if (view === "archived") return "Archived";
  return view.slice("category:".length);
}

function App() {
  const [sites, setSites] = useState<SavedSite[]>([]);
  const [view, setView] = useState<View>("home");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SavedSite | null>(null);
  const [editing, setEditing] = useState<SavedSite | null | "new">(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const next = await api.listSites();
    setSites(next);
    setSelected((current) => (current ? next.find((site) => site.id === current.id) ?? null : null));
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
    return api.onLibraryChanged(() => void refresh());
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const activeSites = useMemo(() => sites.filter((site) => !site.archivedAt), [sites]);
  const archivedSites = useMemo(() => sites.filter((site) => site.archivedAt), [sites]);
  const categoryCounts = useMemo(() => {
    const counts = new Map<Category, number>();
    for (const category of CATEGORIES) counts.set(category, 0);
    activeSites.forEach((site) => counts.set(site.category, (counts.get(site.category) ?? 0) + 1));
    return counts;
  }, [activeSites]);
  const populatedCategories = CATEGORIES.filter((category) => (categoryCounts.get(category) ?? 0) > 0);

  const fuse = useMemo(
    () =>
      new Fuse(activeSites.map(flattenSite), {
        includeScore: true,
        threshold: 0.34,
        ignoreLocation: true,
        minMatchCharLength: 2,
        keys: [
          { name: "purposeText", weight: 0.34 },
          { name: "title", weight: 0.25 },
          { name: "tagsText", weight: 0.18 },
          { name: "description", weight: 0.12 },
          { name: "category", weight: 0.08 },
          { name: "domain", weight: 0.03 },
        ],
      }),
    [activeSites],
  );

  const visibleSites = useMemo(() => {
    if (query.trim()) return fuse.search(query.trim()).map((result) => result.item as SavedSite);
    if (view === "archived") return archivedSites;
    if (view === "favorites") return activeSites.filter((site) => site.favorite);
    if (view.startsWith("category:")) return activeSites.filter((site) => site.category === view.slice(9));
    return activeSites;
  }, [activeSites, archivedSites, fuse, query, view]);

  const setAndCloseView = (next: View) => {
    setView(next);
    setQuery("");
    setSidebarOpen(false);
  };

  const openSite = async (site: SavedSite) => {
    await api.markOpened(site.id);
    await api.openExternal(site.url);
    setToast(`Opened ${site.title}`);
    void refresh();
  };

  const toggleFavorite = async (site: SavedSite) => {
    setSites(await api.toggleFavorite(site.id));
    setToast(site.favorite ? "Removed from favorites" : "Added to favorites");
  };

  const archive = async (site: SavedSite) => {
    setSites(await api.archiveSite(site.id));
    setSelected(null);
    setToast("Moved to Archive — it can be restored anytime");
  };

  const restore = async (site: SavedSite) => {
    setSites(await api.restoreSite(site.id));
    setSelected(null);
    setToast("Restored to your Toolbelt");
  };

  const exportLibrary = async () => {
    const exported = await api.exportLibrary();
    if (exported) setToast("Toolbelt backup exported");
  };

  const saveDraft = async (draft: SiteDraft) => {
    const saved = await api.saveSite(draft);
    await refresh();
    setEditing(null);
    setSelected(saved);
    setToast(draft.id ? "Toolbelt item updated" : "Saved to your Toolbelt");
  };

  return (
    <div className="app-shell">
      <button className="mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>
        <Menu size={20} />
      </button>
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand-lockup">
          <img src="/toolbelt-mark.svg" alt="" />
          <div>
            <strong>Toolbelt</strong>
            <span>Useful sites, remembered</span>
          </div>
          <button className="sidebar-close" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="primary-nav" aria-label="Primary navigation">
          <NavButton active={view === "home"} icon={Home} label="Home" onClick={() => setAndCloseView("home")} />
          <NavButton active={view === "all"} icon={Grid2X2} label="All websites" count={activeSites.length} onClick={() => setAndCloseView("all")} />
          <NavButton active={view === "favorites"} icon={Heart} label="Favorites" count={activeSites.filter((site) => site.favorite).length} onClick={() => setAndCloseView("favorites")} />
        </nav>

        <div className="nav-section">
          <div className="nav-label">Categories</div>
          {populatedCategories.map((category) => {
            const Icon = categoryIcons[category];
            return (
              <NavButton
                key={category}
                active={view === `category:${category}`}
                icon={Icon}
                label={category}
                count={categoryCounts.get(category)}
                onClick={() => setAndCloseView(`category:${category}`)}
              />
            );
          })}
        </div>

        <div className="sidebar-bottom">
          <NavButton active={view === "archived"} icon={Archive} label="Archive" count={archivedSites.length} onClick={() => setAndCloseView("archived")} />
          <button className="sidebar-utility" onClick={exportLibrary}>
            <Download size={17} />
            Export backup
          </button>
          <div className="local-badge">
            <span className="status-dot" />
            Private and stored locally
          </div>
        </div>
      </aside>
      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}

      <nav className="mobile-tabbar" aria-label="Primary navigation">
        <button className={view === "home" ? "active" : ""} onClick={() => setAndCloseView("home")}>
          <Home size={22} />
          <span>Home</span>
        </button>
        <button className={view === "all" ? "active" : ""} onClick={() => setAndCloseView("all")}>
          <Grid2X2 size={22} />
          <span>All</span>
        </button>
        <button className={view === "favorites" ? "active" : ""} onClick={() => setAndCloseView("favorites")}>
          <Heart size={22} />
          <span>Favorites</span>
        </button>
        <button className={view === "archived" ? "active" : ""} onClick={() => setAndCloseView("archived")}>
          <Archive size={22} />
          <span>Archive</span>
        </button>
      </nav>
      <button className="mobile-search-fab" aria-label="Search" onClick={() => searchRef.current?.focus()}>
        <Search size={22} />
      </button>

      <main className="main-content">
        <header className="topbar">
          <div className="search-shell">
            <Search size={20} />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="What are you trying to do?"
              aria-label="Search saved websites"
            />
            {query && (
              <button aria-label="Clear search" onClick={() => setQuery("")}>
                <X size={17} />
              </button>
            )}
            <kbd>Ctrl K</kbd>
          </div>
          <button className="add-button" onClick={() => setEditing("new")}>
            <Plus size={18} />
            <span>Add website</span>
          </button>
        </header>

        <div className="content-scroll">
          {view === "home" && !query ? (
            <HomeView
              sites={activeSites}
              categories={populatedCategories}
              counts={categoryCounts}
              onCategory={(category) => setAndCloseView(`category:${category}`)}
              onSelect={setSelected}
              onOpen={openSite}
              onFavorite={toggleFavorite}
              onAdd={() => setEditing("new")}
            />
          ) : (
            <LibraryView
              title={query ? `Results for “${query}”` : viewTitle(view)}
              sites={visibleSites}
              archived={view === "archived"}
              loading={loading}
              onSelect={setSelected}
              onOpen={openSite}
              onFavorite={toggleFavorite}
              onAdd={() => setEditing("new")}
              onRestore={restore}
            />
          )}
        </div>
      </main>

      {selected && (
        <SiteDetail
          site={selected}
          onClose={() => setSelected(null)}
          onOpen={() => void openSite(selected)}
          onFavorite={() => void toggleFavorite(selected)}
          onEdit={() => setEditing(selected)}
          onArchive={() => void archive(selected)}
          onRestore={() => void restore(selected)}
        />
      )}
      {editing && (
        <SiteForm
          site={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={saveDraft}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}

function NavButton({ active, icon: Icon, label, count, onClick }: { active: boolean; icon: typeof Search; label: string; count?: number; onClick: () => void }) {
  return (
    <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>
      <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
      <span>{label}</span>
      {typeof count === "number" && count > 0 && <em>{count}</em>}
    </button>
  );
}

function HomeView({ sites, categories, counts, onCategory, onSelect, onOpen, onFavorite, onAdd }: { sites: SavedSite[]; categories: Category[]; counts: Map<Category, number>; onCategory: (category: Category) => void; onSelect: (site: SavedSite) => void; onOpen: (site: SavedSite) => Promise<void>; onFavorite: (site: SavedSite) => Promise<void>; onAdd: () => void }) {
  const recent = [...sites].sort((a, b) => (b.lastOpenedAt ?? b.updatedAt).localeCompare(a.lastOpenedAt ?? a.updatedAt)).slice(0, 4);
  return (
    <div className="home-view">
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={14} /> Your personal utility library</div>
          <h1>Never lose a useful website again.</h1>
          <p>Save the reason a site matters, then find it by the problem you’re trying to solve.</p>
          <button onClick={onAdd}><Plus size={17} /> Save a website</button>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit-glow" />
          <div className="hero-icon"><img src="/toolbelt-icon-256.png" alt="" /></div>
          <div className="float-chip chip-one"><Link2 size={15} /> {sites.length} saved</div>
          <div className="float-chip chip-two"><FolderOpen size={15} /> {categories.length} categories</div>
        </div>
      </section>

      {sites.length === 0 ? (
        <EmptyLibrary onAdd={onAdd} />
      ) : (
        <>
          <section className="section-block">
            <div className="section-heading">
              <div><span>Pick a shelf</span><h2>Browse by category</h2></div>
            </div>
            <div className="category-grid">
              {categories.map((category) => {
                const Icon = categoryIcons[category];
                const sample = sites.find((site) => site.category === category);
                return (
                  <button key={category} className={`category-tile accent-${categoryAccent[category]}`} onClick={() => onCategory(category)}>
                    <div className="category-icon"><Icon size={22} /></div>
                    <div><strong>{category}</strong><span>{counts.get(category)} {counts.get(category) === 1 ? "website" : "websites"}</span></div>
                    <div className="category-domain">{sample?.domain}</div>
                    <ChevronRight size={17} />
                  </button>
                );
              })}
            </div>
          </section>

          <section className="section-block">
            <div className="section-heading">
              <div><span>Ready when you need them</span><h2>Recently useful</h2></div>
            </div>
            <div className="site-grid">
              {recent.map((site) => <SiteCard key={site.id} site={site} onSelect={onSelect} onOpen={onOpen} onFavorite={onFavorite} />)}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function LibraryView({ title, sites, archived, loading, onSelect, onOpen, onFavorite, onAdd, onRestore }: { title: string; sites: SavedSite[]; archived: boolean; loading: boolean; onSelect: (site: SavedSite) => void; onOpen: (site: SavedSite) => Promise<void>; onFavorite: (site: SavedSite) => Promise<void>; onAdd: () => void; onRestore: (site: SavedSite) => Promise<void> }) {
  return (
    <div className="library-view">
      <div className="page-heading">
        <div><div className="eyebrow">{archived ? "Preserved, not deleted" : "Your saved collection"}</div><h1>{title}</h1><p>{sites.length} {sites.length === 1 ? "website" : "websites"}</p></div>
        {!archived && <button className="secondary-button" onClick={onAdd}><Plus size={17} /> Add website</button>}
      </div>
      {loading ? <div className="loading-grid"><span /><span /><span /></div> : sites.length ? (
        <div className="site-grid">
          {sites.map((site) => archived ? (
            <ArchivedCard key={site.id} site={site} onRestore={onRestore} />
          ) : (
            <SiteCard key={site.id} site={site} onSelect={onSelect} onOpen={onOpen} onFavorite={onFavorite} />
          ))}
        </div>
      ) : <EmptyLibrary onAdd={onAdd} archived={archived} />}
    </div>
  );
}

function SiteCard({ site, onSelect, onOpen, onFavorite }: { site: SavedSite; onSelect: (site: SavedSite) => void; onOpen: (site: SavedSite) => Promise<void>; onFavorite: (site: SavedSite) => Promise<void> }) {
  const Icon = categoryIcons[site.category];
  return (
    <article className="site-card" onClick={() => onSelect(site)}>
      <div className={`site-preview accent-${categoryAccent[site.category]}`} style={site.brandColor ? ({ "--accent": site.brandColor } as CSSProperties) : undefined}>
        {site.previewImageUrl ? <img src={site.previewImageUrl} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}
        <div className="preview-pattern" />
        <div className="preview-domain">{site.domain}</div>
        <div className="preview-mark"><Icon size={30} />{site.faviconUrl ? <img src={site.faviconUrl} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}</div>
        <div className="card-actions">
          <button aria-label={site.favorite ? "Remove from favorites" : "Add to favorites"} className={site.favorite ? "is-favorite" : ""} onClick={(event) => { event.stopPropagation(); void onFavorite(site); }}>
            <Heart size={17} fill={site.favorite ? "currentColor" : "none"} />
          </button>
          <button aria-label={`Open ${site.title}`} onClick={(event) => { event.stopPropagation(); void onOpen(site); }}><ArrowUpRight size={17} /></button>
        </div>
      </div>
      <div className="site-card-body">
        <div className="site-title-line"><div><strong>{site.title}</strong><span>{site.domain}</span></div><MoreHorizontal size={18} /></div>
        <p>{site.uses.at(-1)?.text}</p>
        <div className="site-card-footer"><span className={`category-pill accent-${categoryAccent[site.category]}`}><Icon size={13} /> {site.category}</span><span>{relativeDate(site.lastOpenedAt)}</span></div>
      </div>
    </article>
  );
}

function ArchivedCard({ site, onRestore }: { site: SavedSite; onRestore: (site: SavedSite) => Promise<void> }) {
  return (
    <article className="archived-card">
      <div className="archived-icon"><Archive size={21} /></div>
      <div><strong>{site.title}</strong><span>{site.domain}</span><p>{site.uses.at(-1)?.text}</p></div>
      <button onClick={() => void onRestore(site)}>Restore</button>
    </article>
  );
}

function EmptyLibrary({ onAdd, archived = false }: { onAdd: () => void; archived?: boolean }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{archived ? <Archive size={28} /> : <Link2 size={28} />}</div>
      <h2>{archived ? "Nothing is archived" : "Your next useful find belongs here"}</h2>
      <p>{archived ? "Sites you archive stay recoverable here." : "Add a website manually, or use the Toolbelt Chrome icon while browsing."}</p>
      {!archived && <button onClick={onAdd}><Plus size={17} /> Add your first website</button>}
    </div>
  );
}

function SiteDetail({ site, onClose, onOpen, onFavorite, onEdit, onArchive, onRestore }: { site: SavedSite; onClose: () => void; onOpen: () => void; onFavorite: () => void; onEdit: () => void; onArchive: () => void; onRestore: () => void }) {
  const Icon = categoryIcons[site.category];
  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={`${site.title} details`}>
      <button className="drawer-scrim" aria-label="Close details" onClick={onClose} />
      <aside className="detail-drawer">
        <div className="drawer-topbar"><span>Website details</span><button aria-label="Close details" onClick={onClose}><X size={19} /></button></div>
        <div className={`detail-preview accent-${categoryAccent[site.category]}`} style={site.brandColor ? ({ "--accent": site.brandColor } as CSSProperties) : undefined}>
          {site.previewImageUrl && <img src={site.previewImageUrl} alt="" />}
          <div className="preview-pattern" />
          <div className="detail-mark"><Icon size={34} />{site.faviconUrl ? <img src={site.faviconUrl} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : null}</div>
          <span>{site.domain}</span>
        </div>
        <div className="detail-content">
          <div className="detail-heading"><div><span className={`category-pill accent-${categoryAccent[site.category]}`}><Icon size={13} /> {site.category}</span><h2>{site.title}</h2><a href={site.url} onClick={(event) => event.preventDefault()}>{site.domain}</a></div><button className={site.favorite ? "favorite-large active" : "favorite-large"} onClick={onFavorite}><Heart size={20} fill={site.favorite ? "currentColor" : "none"} /></button></div>
          {site.description && <p className="detail-description">{site.description}</p>}
          <section className="use-section"><div className="detail-label"><Lightbulb size={15} /> Use this when</div>{site.uses.map((use) => <div className="use-item" key={use.id}>{use.text}</div>)}</section>
          {site.tags.length > 0 && <section><div className="detail-label"><Tag size={15} /> Tags</div><div className="tag-list">{site.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div></section>}
          <div className="detail-meta"><div><span>Times opened</span><strong>{site.openCount}</strong></div><div><span>Last used</span><strong>{relativeDate(site.lastOpenedAt).replace("Opened ", "")}</strong></div></div>
          <button className="open-primary" onClick={onOpen}>Open website <ArrowUpRight size={18} /></button>
          <div className="detail-actions"><button onClick={onEdit}><Settings2 size={16} /> Edit details</button>{site.archivedAt ? <button onClick={onRestore}><Archive size={16} /> Restore</button> : <button className="archive-action" onClick={onArchive}><Archive size={16} /> Archive</button>}</div>
        </div>
      </aside>
    </div>
  );
}

function SiteForm({ site, onClose, onSave }: { site?: SavedSite; onClose: () => void; onSave: (draft: SiteDraft) => Promise<void> }) {
  const [url, setUrl] = useState(site?.url ?? "");
  const [title, setTitle] = useState(site?.title ?? "");
  const [description, setDescription] = useState(site?.description ?? "");
  const [category, setCategory] = useState<Category>(site?.category ?? "Other");
  const [purpose, setPurpose] = useState(site?.uses.at(-1)?.text ?? "");
  const [tags, setTags] = useState(site?.tags.join(", ") ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleUrlBlur = () => {
    if (title || !url) return;
    try { setTitle(new URL(url).hostname.replace(/^www\./, "")); } catch { /* Validation happens on submit. */ }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave({ id: site?.id, url, title, description, category, purpose, tags: tags.split(",") });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this website.");
      setSaving(false);
    }
  };

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-label={site ? "Edit website" : "Add website"}>
      <button className="modal-scrim" aria-label="Close form" onClick={onClose} />
      <form className="site-form" onSubmit={submit}>
        <div className="form-heading"><div><span>{site ? "Update your memory" : "Save something useful"}</span><h2>{site ? "Edit website" : "Add to Toolbelt"}</h2></div><button type="button" aria-label="Close form" onClick={onClose}><X size={19} /></button></div>
        <label><span>Website URL or local HTML file</span><input type="text" required value={url} onChange={(event) => setUrl(event.target.value)} onBlur={handleUrlBlur} placeholder="https://example.com or file:///C:/path/tool.html" autoFocus /></label>
        <label><span>Name</span><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Website name" /></label>
        <label className="purpose-field"><span>Use this when…</span><textarea required value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="I’m building a UI and need real design inspiration." rows={3} /><small>This is the strongest signal when you search later.</small></label>
        <div className="form-row"><label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value as Category)}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Tags</span><input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="ui, design, inspiration" /></label></div>
        <label><span>Description <em>optional</em></span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A short description of what the site offers." rows={2} /></label>
        {error && <div className="form-error">{error}</div>}
        <div className="form-footer"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button type="submit" className="save-button" disabled={saving}>{saving ? "Saving…" : <><Check size={17} /> Save to Toolbelt</>}</button></div>
      </form>
    </div>
  );
}

export default App;
