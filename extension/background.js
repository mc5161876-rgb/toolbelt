const OUTBOX_KEY = "toolbeltCaptureOutbox";
const ENDPOINT = "http://127.0.0.1:47321/captures";

async function getOutbox() {
  const result = await chrome.storage.local.get(OUTBOX_KEY);
  return Array.isArray(result[OUTBOX_KEY]) ? result[OUTBOX_KEY] : [];
}

async function setOutbox(items) {
  await chrome.storage.local.set({ [OUTBOX_KEY]: items });
  await chrome.action.setBadgeText({ text: items.length ? String(items.length) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#6f63e8" });
}

async function deliver(item) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Toolbelt-Capture": "1",
    },
    body: JSON.stringify(item.payload),
  });
  if (!response.ok) throw new Error(`Toolbelt returned ${response.status}`);
}

async function flushOutbox() {
  const items = await getOutbox();
  if (!items.length) return;
  const remaining = [];
  for (const item of items) {
    try {
      await deliver(item);
    } catch {
      remaining.push(item);
    }
  }
  await setOutbox(remaining);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("toolbelt-flush", { periodInMinutes: 0.5 });
  void flushOutbox();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("toolbelt-flush", { periodInMinutes: 0.5 });
  void flushOutbox();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "toolbelt-flush") void flushOutbox();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "toolbelt:flush") return false;
  flushOutbox().then(async () => sendResponse({ remaining: (await getOutbox()).length }));
  return true;
});

