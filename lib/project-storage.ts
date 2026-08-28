import type { ImageAnalysis, Tuning } from "@/lib/color-engine";

export type ProjectTemplate = "product" | "content" | "banner";
export type ProjectTab = "studio" | "batch";

export type PreviewCopyData = {
  eyebrow: string;
  title: string;
  body: string;
  meta: string;
  cta: string;
};

export type StoredProject = {
  format: "ui-color-logic-project";
  exportVersion: 2;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: ImageAnalysis[];
  activeId: string | null;
  tuning: Tuning;
  copy: PreviewCopyData;
  template: ProjectTemplate;
  tab: ProjectTab;
};

export type ProjectSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
};

type SettingRecord = { key: string; value: string };
type TestCacheRecord = {
  key: string;
  updatedAt: string;
  items: ImageAnalysis[];
};

const DATABASE_NAME = "ui-color-logic-studio";
const DATABASE_VERSION = 1;
const ACTIVE_PROJECT_KEY = "active-project-id";

const requestResult = <T,>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error("IndexedDB 요청에 실패했습니다."));
});

const transactionDone = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB 저장에 실패했습니다."));
  transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB 저장이 취소되었습니다."));
});

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (typeof indexedDB === "undefined") {
    reject(new Error("이 브라우저에서는 IndexedDB를 사용할 수 없습니다."));
    return;
  }

  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains("projects")) {
      database.createObjectStore("projects", { keyPath: "id" });
    }
    if (!database.objectStoreNames.contains("projectSummaries")) {
      const summaries = database.createObjectStore("projectSummaries", { keyPath: "id" });
      summaries.createIndex("updatedAt", "updatedAt");
    }
    if (!database.objectStoreNames.contains("settings")) {
      database.createObjectStore("settings", { keyPath: "key" });
    }
    if (!database.objectStoreNames.contains("testCache")) {
      database.createObjectStore("testCache", { keyPath: "key" });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error("프로젝트 저장소를 열 수 없습니다."));
  request.onblocked = () => reject(new Error("다른 탭에서 저장소를 사용 중입니다."));
});

export const createProjectId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `project-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export async function saveProject(project: StoredProject) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(["projects", "projectSummaries", "settings"], "readwrite");
    const completion = transactionDone(transaction);
    const summary: ProjectSummary = {
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      itemCount: project.items.length,
    };
    transaction.objectStore("projects").put(project);
    transaction.objectStore("projectSummaries").put(summary);
    transaction.objectStore("settings").put({ key: ACTIVE_PROJECT_KEY, value: project.id } satisfies SettingRecord);
    await completion;
    return summary;
  } finally {
    database.close();
  }
}

export async function getProject(id: string) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction("projects", "readonly");
    const project = await requestResult(transaction.objectStore("projects").get(id));
    return project as StoredProject | undefined;
  } finally {
    database.close();
  }
}

export async function listProjectSummaries() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction("projectSummaries", "readonly");
    const summaries = await requestResult(transaction.objectStore("projectSummaries").getAll()) as ProjectSummary[];
    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } finally {
    database.close();
  }
}

export async function getActiveProjectId() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction("settings", "readonly");
    const setting = await requestResult(transaction.objectStore("settings").get(ACTIVE_PROJECT_KEY)) as SettingRecord | undefined;
    return setting?.value ?? null;
  } finally {
    database.close();
  }
}

export async function setActiveProjectId(id: string) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction("settings", "readwrite");
    const completion = transactionDone(transaction);
    transaction.objectStore("settings").put({ key: ACTIVE_PROJECT_KEY, value: id } satisfies SettingRecord);
    await completion;
  } finally {
    database.close();
  }
}

export async function deleteProject(id: string) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(["projects", "projectSummaries"], "readwrite");
    const completion = transactionDone(transaction);
    transaction.objectStore("projects").delete(id);
    transaction.objectStore("projectSummaries").delete(id);
    await completion;
  } finally {
    database.close();
  }
}

export async function clearAllStoredData() {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(["projects", "projectSummaries", "settings", "testCache"], "readwrite");
    const completion = transactionDone(transaction);
    transaction.objectStore("projects").clear();
    transaction.objectStore("projectSummaries").clear();
    transaction.objectStore("settings").clear();
    transaction.objectStore("testCache").clear();
    await completion;
  } finally {
    database.close();
  }
}

const testCacheKey = (ignoreNearNeutral: boolean) => `test-set-v1-neutral-${ignoreNearNeutral ? "on" : "off"}`;

export async function getTestCache(ignoreNearNeutral: boolean) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction("testCache", "readonly");
    const record = await requestResult(transaction.objectStore("testCache").get(testCacheKey(ignoreNearNeutral))) as TestCacheRecord | undefined;
    return record?.items ?? [];
  } finally {
    database.close();
  }
}

export async function saveTestCache(ignoreNearNeutral: boolean, items: ImageAnalysis[]) {
  const bySource = new Map<string, ImageAnalysis>();
  items.filter((item) => item.sourcePage).forEach((item) => bySource.set(item.sourcePage as string, item));
  const record: TestCacheRecord = {
    key: testCacheKey(ignoreNearNeutral),
    updatedAt: new Date().toISOString(),
    items: [...bySource.values()],
  };
  const database = await openDatabase();
  try {
    const transaction = database.transaction("testCache", "readwrite");
    const completion = transactionDone(transaction);
    transaction.objectStore("testCache").put(record);
    await completion;
  } finally {
    database.close();
  }
}

export async function requestPersistentBrowserStorage() {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export function parseProjectFile(value: unknown): StoredProject | null {
  if (!isObject(value) || value.format !== "ui-color-logic-project" || value.exportVersion !== 2) return null;
  if (typeof value.name !== "string" || !Array.isArray(value.items)) return null;
  if (!isObject(value.tuning) || !isObject(value.copy)) return null;
  if (!(["balanced", "soft", "bold", "dark"] as unknown[]).includes(value.tuning.profile)) return null;
  if (!["saturation", "temperature", "surfaceTint", "minContrast"].every((key) => typeof value.tuning[key] === "number")) return null;
  if (typeof value.tuning.ignoreNearNeutral !== "boolean") return null;
  if (!["eyebrow", "title", "body", "meta", "cta"].every((key) => typeof value.copy[key] === "string")) return null;
  if (!value.items.every((item) => isObject(item)
    && typeof item.id === "string"
    && typeof item.name === "string"
    && typeof item.dataUrl === "string"
    && typeof item.rawKey === "string"
    && Array.isArray(item.candidates)
    && isObject(item.palette))) return null;
  if (!(["product", "content", "banner"] as unknown[]).includes(value.template)) return null;
  if (!(["studio", "batch"] as unknown[]).includes(value.tab)) return null;
  return value as unknown as StoredProject;
}
