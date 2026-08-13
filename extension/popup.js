const OUTBOX_KEY = "toolbeltCaptureOutbox";
const ENDPOINT = "http://127.0.0.1:47321/captures";
const categories = [
  "Design & Inspiration", "Documents & PDFs", "Images & Graphics", "Video & Audio",
  "Research & Reference", "AI & Automation", "Development & Web", "Business & Marketing",
  "Construction & Field", "Utilities & Converters", "Learning & Careers", "Other",
];

const form = document.querySelector("#capture-form");
const purposeInput = document.querySelector("#purpose");
const categoryInput = document.querySelector("#category");
const tagsInput = document.querySelector("#tags");
const status = document.querySelector("#status");
const saveButton = document.querySelector("#save-button");
let page = { url: "", title: "", description: "", faviconUrl: "", previewImageUrl: "" };

for (const category of categories) {
  const option = document.createElement("option");
  option.value = category;
  option.textContent = category;
  categoryInput.append(option);
}

function suggestCategory(text) {
  const value = text.toLowerCase();
  const rules = [
    ["Design & Inspiration", ["design", "ui", "ux", "typography", "brand", "inspiration", "website gallery"]],
    ["Documents & PDFs", ["pdf", "document", "docx", "spreadsheet", "invoice", "form"]],
    ["Images & Graphics", ["image", "photo", "png", "jpg", "background", "vector", "svg"]],
    ["Video & Audio", ["video", "audio", "mp3", "subtitle", "podcast", "transcript"]],
    ["AI & Automation", [" ai ", "artificial intelligence", "automation", "agent", "prompt"]],
    ["Development & Web", ["developer", "code", "css", "javascript", "api", "github", "web tool"]],
    ["Business & Marketing", ["marketing", "seo", "business", "sales", "email", "campaign"]],
    ["Construction & Field", ["construction", "blueprint", "field report", "estimate", "contractor"]],
    ["Learning & Careers", ["course", "learn", "career", "job", "resume", "interview"]],
    ["Research & Reference", ["research", "reference", "archive", "database", "library"]],
    ["Utilities & Converters", ["convert", "compress", "calculator", "generator", "utility", "tool"]],
  ];
  return rules.find(([, terms]) => terms.some((term) => value.includes(term)))?.[0] ?? "Other";
}

async function readActivePage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith("http")) throw new Error("Toolbelt can save regular website tabs.");
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || document.querySelector('meta[property="og:description"]')?.content || "",
      previewImageUrl: document.querySelector('meta[property="og:image"]')?.content || document.querySelector('meta[name="twitter:image"]')?.content || "",
      faviconUrl: (() => {
        const icons = [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]')];
        const score = (icon) => {
          const rel = icon.rel.toLowerCase();
          const sizes = icon.sizes?.value || icon.getAttribute("sizes") || "";
          const largest = Math.max(0, ...sizes.split(/\s+/).map((size) => Number.parseInt(size, 10) || 0));
          const formatBonus = icon.href.endsWith(".svg") ? 900 : 0;
          const touchBonus = rel.includes("apple-touch") ? 800 : 0;
          return largest + formatBonus + touchBonus;
        };
        icons.sort((a, b) => score(b) - score(a));
        return icons[0]?.href || new URL("/favicon.ico", location.href).href;
      })(),
      brandColor: document.querySelector('meta[name="theme-color"]')?.content || "",
    }),
  });
  page = {
    url: tab.url,
    title: result?.title || tab.title || new URL(tab.url).hostname,
    description: result?.description || "",
    previewImageUrl: result?.previewImageUrl || "",
    faviconUrl: result?.faviconUrl || tab.favIconUrl || "",
    brandColor: /^#[0-9a-f]{3,8}$/i.test(result?.brandColor || "") ? result.brandColor : "",
  };
  const domain = new URL(page.url).hostname.replace(/^www\./, "");
  document.querySelector("#page-title").textContent = page.title;
  document.querySelector("#page-domain").textContent = domain;
  document.querySelector("#site-icon-fallback").textContent = domain.charAt(0);
  if (page.faviconUrl) {
    const image = document.querySelector("#site-favicon");
    image.src = page.faviconUrl;
    image.hidden = false;
    document.querySelector("#site-icon-fallback").hidden = true;
    image.addEventListener("error", () => {
      image.hidden = true;
      document.querySelector("#site-icon-fallback").hidden = false;
    }, { once: true });
  }
  categoryInput.value = suggestCategory(`${page.title} ${page.description} ${domain}`);
  purposeInput.focus();
}

async function getOutbox() {
  const result = await chrome.storage.local.get(OUTBOX_KEY);
  return Array.isArray(result[OUTBOX_KEY]) ? result[OUTBOX_KEY] : [];
}

async function setOutbox(items) {
  await chrome.storage.local.set({ [OUTBOX_KEY]: items });
  await chrome.action.setBadgeText({ text: items.length ? String(items.length) : "" });
  const outbox = document.querySelector("#outbox");
  document.querySelector("#outbox-count").textContent = String(items.length);
  outbox.hidden = items.length === 0;
}

async function deliver(item) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Toolbelt-Capture": "1" },
    body: JSON.stringify(item.payload),
  });
  if (!response.ok) throw new Error("Toolbelt is not available");
}

function showStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
  status.hidden = false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!purposeInput.value.trim()) return;
  saveButton.disabled = true;
  const item = {
    id: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
    payload: {
      ...page,
      category: categoryInput.value,
      purpose: purposeInput.value.trim(),
      tags: tagsInput.value.split(",").map((tag) => tag.trim()).filter(Boolean),
    },
  };
  const items = [...await getOutbox(), item];
  await setOutbox(items);
  try {
    await deliver(item);
    await setOutbox((await getOutbox()).filter((queued) => queued.id !== item.id));
    showStatus("Saved to Toolbelt.");
  } catch {
    showStatus("Saved safely to the outbox. It will transfer when Toolbelt is open.");
  }
  saveButton.querySelector("span").textContent = "Saved";
  setTimeout(() => window.close(), 1200);
});

(async () => {
  await setOutbox(await getOutbox());
  try {
    await readActivePage();
  } catch (error) {
    showStatus(error.message || "This tab cannot be captured.", true);
    saveButton.disabled = true;
  }
})();
