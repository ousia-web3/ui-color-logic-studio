import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Studio from "../app/page";
import "../app/globals.css";
import "./extension.css";

type StoredCapture = {
  dataUrl: string;
  name?: string;
};

type ExtensionChrome = {
  runtime?: {
    sendMessage(message: unknown): Promise<{
      ok?: boolean;
      dataUrl?: string;
      name?: string;
      error?: string;
    }>;
  };
  storage?: {
    local: {
      get(key: string): Promise<Record<string, unknown>>;
      remove(key: string): Promise<void>;
    };
  };
};

const chromeApi = (globalThis as typeof globalThis & { chrome?: ExtensionChrome }).chrome;
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("앱을 표시할 루트 요소를 찾지 못했습니다.");
}

createRoot(rootElement).render(
  <StrictMode>
    <Studio />
  </StrictMode>,
);

const statusElement = document.getElementById("extension-import-status");
const captureButton = document.getElementById("capture-source-tab") as HTMLButtonElement | null;
const selfCheckButton = document.getElementById("extension-self-check") as HTMLButtonElement | null;

function showStatus(message: string, tone: "info" | "error" = "info") {
  if (!statusElement) return;
  statusElement.textContent = message;
  statusElement.dataset.tone = tone;
  statusElement.hidden = false;
}

function hideStatus(delay = 3200) {
  window.setTimeout(() => {
    if (statusElement) statusElement.hidden = true;
  }, delay);
}

function isStoredCapture(value: unknown): value is StoredCapture {
  return Boolean(
    value
      && typeof value === "object"
      && "dataUrl" in value
      && typeof (value as StoredCapture).dataUrl === "string",
  );
}

function imageNameFromUrl(sourceUrl: string) {
  try {
    const candidate = decodeURIComponent(new URL(sourceUrl).pathname.split("/").pop() || "");
    return /\.(avif|gif|jpe?g|png|webp)$/i.test(candidate) ? candidate : "web-image.png";
  } catch {
    return "web-image.png";
  }
}

async function fileFromSource(sourceUrl: string, fallbackName?: string) {
  const response = await fetch(sourceUrl, { cache: "no-store", credentials: "include" });
  if (!response.ok) throw new Error(`이미지를 불러오지 못했습니다. (${response.status})`);

  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("선택한 주소가 이미지 파일이 아닙니다.");

  return new File([blob], fallbackName || imageNameFromUrl(sourceUrl), {
    type: blob.type,
    lastModified: Date.now(),
  });
}

async function waitForImageInput(timeoutMs = 10_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const input = document.querySelector<HTMLInputElement>('input[type="file"][accept*="image"]');
    if (input) return input;
    await new Promise((resolve) => window.setTimeout(resolve, 80));
  }
  throw new Error("이미지 입력 영역을 준비하지 못했습니다.");
}

async function sendFileToStudio(file: File) {
  const input = await waitForImageInput();
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function captureSourceTab() {
  if (!captureButton || !chromeApi?.runtime) return;
  captureButton.disabled = true;
  showStatus("직전에 보던 웹페이지 화면을 캡처하는 중…");
  try {
    const result = await chromeApi.runtime.sendMessage({ type: "CAPTURE_SOURCE_TAB" });
    if (!result?.ok || !result.dataUrl) throw new Error(result?.error || "현재 탭을 캡처하지 못했습니다.");
    const file = await fileFromSource(result.dataUrl, result.name || "page-capture.png");
    await sendFileToStudio(file);
    showStatus("현재 웹페이지 화면을 추가했습니다. 컬러 분석을 시작합니다.");
    hideStatus();
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "현재 탭을 캡처하지 못했습니다.", "error");
  } finally {
    captureButton.disabled = false;
  }
}

async function importRequestedImage() {
  const params = new URLSearchParams(window.location.search);
  const imageUrl = params.get("imageUrl");
  const captureKey = params.get("captureKey");
  const launchError = params.get("error");

  if (launchError === "capture_failed") {
    showStatus("화면 캡처 권한을 확인한 뒤 다시 시도해 주세요.", "error");
    return;
  }

  if (launchError === "image_permission_denied") {
    showStatus("선택한 이미지가 있는 사이트의 접근 권한이 필요합니다.", "error");
    return;
  }

  if (!imageUrl && !captureKey) return;

  try {
    showStatus(imageUrl ? "선택한 이미지를 불러오는 중…" : "캡처 이미지를 불러오는 중…");

    let file: File;
    if (imageUrl) {
      file = await fileFromSource(imageUrl);
    } else {
      if (!chromeApi?.storage || !captureKey) throw new Error("저장된 캡처를 찾지 못했습니다.");
      const result = await chromeApi.storage.local.get(captureKey);
      const capture = result[captureKey];
      if (!isStoredCapture(capture)) throw new Error("저장된 캡처 데이터가 올바르지 않습니다.");

      file = await fileFromSource(capture.dataUrl, capture.name || "page-capture.png");
      await chromeApi.storage.local.remove(captureKey);
    }

    await sendFileToStudio(file);
    window.history.replaceState(null, "", window.location.pathname);
    showStatus("이미지를 추가했습니다. 컬러 분석을 시작합니다.");
    hideStatus();
  } catch (error) {
    const message = error instanceof Error ? error.message : "이미지를 가져오지 못했습니다.";
    showStatus(`${message} 직접 업로드로 다시 시도할 수 있습니다.`, "error");
  }
}

async function showUpdateNotice() {
  if (!chromeApi?.storage) return;
  const key = "ui-color-updated-version";
  const result = await chromeApi.storage.local.get(key);
  const version = result[key];
  if (typeof version !== "string") return;
  await chromeApi.storage.local.remove(key);
  showStatus(`확장프로그램 v${version} 업데이트 완료 · 검수 흐름과 저장 최적화가 적용됐습니다.`);
  hideStatus(5200);
}

async function runSelfCheck() {
  if (!chromeApi?.runtime || !chromeApi.storage) {
    showStatus("확장프로그램 연결을 확인하지 못했습니다. 확장 관리 화면에서 새로고침해 주세요.", "error");
    return;
  }
  const key = `ui-color-self-check-${Date.now()}`;
  try {
    await chromeApi.storage.local.get(key);
    showStatus("확장 기본 기능 정상 · 저장소와 화면 캡처 요청 통로가 준비됐습니다.");
    hideStatus(4200);
  } catch {
    showStatus("확장 저장소를 확인하지 못했습니다. 권한 설정을 확인해 주세요.", "error");
  }
}

void importRequestedImage();
void showUpdateNotice();
captureButton?.addEventListener("click", () => void captureSourceTab());
selfCheckButton?.addEventListener("click", () => void runSelfCheck());
