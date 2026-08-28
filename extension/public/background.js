/* global chrome */

const IMAGE_MENU_ID = "ui-color-analyze-image";
const CAPTURE_MENU_ID = "ui-color-capture-page";
const LAST_SOURCE_TAB_KEY = "ui-color-last-source-tab";

function isStudioUrl(url) {
  return typeof url === "string" && url.startsWith(chrome.runtime.getURL(""));
}

async function rememberSourceTab(tab) {
  if (!tab?.id || isStudioUrl(tab.url)) return;
  await chrome.storage.session.set({ [LAST_SOURCE_TAB_KEY]: tab.id });
}

function permissionPattern(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.protocol}//${url.host}/*`;
  } catch {
    return null;
  }
}

async function openStudio(params = {}, sourceTab) {
  await rememberSourceTab(sourceTab);
  const url = new URL(chrome.runtime.getURL("index.html"));
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  await chrome.tabs.create({ url: url.href });
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details?.reason === "update") {
    void chrome.storage.local.set({ "ui-color-updated-version": chrome.runtime.getManifest().version });
  }
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: IMAGE_MENU_ID,
      title: "이 이미지로 UI 컬러 분석",
      contexts: ["image"],
    });
    chrome.contextMenus.create({
      id: CAPTURE_MENU_ID,
      title: "현재 화면 캡처 후 UI 컬러 분석",
      contexts: ["page"],
    });
  });
});

chrome.action.onClicked.addListener((tab) => {
  void openStudio({}, tab);
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === IMAGE_MENU_ID && info.srcUrl) {
    const origin = permissionPattern(info.srcUrl);
    if (origin) {
      const granted = await chrome.permissions.request({ origins: [origin] });
      if (!granted) {
        await openStudio({ error: "image_permission_denied" }, tab);
        return;
      }
    }
    await openStudio({ imageUrl: info.srcUrl }, tab);
    return;
  }

  if (info.menuItemId !== CAPTURE_MENU_ID) return;

  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab?.windowId, { format: "png" });
    const captureKey = `pending-capture-${Date.now()}`;
    await chrome.storage.local.set({
      [captureKey]: {
        dataUrl,
        name: `page-capture-${new Date().toISOString().replace(/[:.]/g, "-")}.png`,
      },
    });
    await openStudio({ captureKey }, tab);
  } catch {
    await openStudio({ error: "capture_failed" }, tab);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "CAPTURE_SOURCE_TAB") return;

  (async () => {
    const senderTabId = sender.tab?.id;
    const stored = await chrome.storage.session.get(LAST_SOURCE_TAB_KEY);
    const sourceTabId = stored[LAST_SOURCE_TAB_KEY];
    if (!Number.isInteger(sourceTabId)) throw new Error("먼저 분석할 웹페이지를 열어 주세요.");

    const sourceTab = await chrome.tabs.get(sourceTabId);
    if (!sourceTab.id || sourceTab.windowId === undefined) throw new Error("분석할 탭을 찾지 못했습니다.");

    try {
      await chrome.tabs.update(sourceTab.id, { active: true });
      await chrome.windows.update(sourceTab.windowId, { focused: true });
      await new Promise((resolve) => setTimeout(resolve, 140));
      const dataUrl = await chrome.tabs.captureVisibleTab(sourceTab.windowId, { format: "png" });
      sendResponse({
        ok: true,
        dataUrl,
        name: `page-capture-${new Date().toISOString().replace(/[:.]/g, "-")}.png`,
      });
    } finally {
      if (senderTabId) {
        const studioTab = await chrome.tabs.get(senderTabId).catch(() => null);
        if (studioTab?.id) {
          await chrome.tabs.update(studioTab.id, { active: true }).catch(() => undefined);
          if (studioTab.windowId !== undefined) {
            await chrome.windows.update(studioTab.windowId, { focused: true }).catch(() => undefined);
          }
        }
      }
    }
  })().catch((error) => {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "현재 탭을 캡처하지 못했습니다.",
    });
  });

  return true;
});
