/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Contrast,
  Download,
  ExternalLink,
  FileJson2,
  FileImage,
  FlaskConical,
  ImagePlus,
  History,
  HardDrive,
  Layers3,
  Lock,
  Palette,
  Puzzle,
  RefreshCw,
  Save,
  ScanSearch,
  SlidersHorizontal,
  Sparkles,
  ShieldCheck,
  Trash2,
  Type,
  Undo2,
  Redo2,
  UploadCloud,
  Unlock,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeImage,
  applyReviewStatus,
  applyBrandRules,
  buildContrastMatrix,
  buildPalette,
  buildPaletteAlternatives,
  type BrandRules,
  evaluatePalette,
  ImageAnalysis,
  invalidateReview,
  type PaletteAlternative,
  type PaletteColorRole,
  paletteToCss,
  paletteToFigmaTokens,
  paletteToTailwind,
  Profile,
  needsExceptionReview,
  retuneAnalysis,
  saveTemplatePalette,
  switchTemplatePalette,
  Tuning,
  UIPalette,
} from "@/lib/color-engine";
import {
  clearAllStoredData,
  createProjectId,
  DEFAULT_BRAND,
  deleteProject as deleteStoredProject,
  getActiveProjectId,
  getBrandPresets,
  getProject,
  getTestCache,
  listProjectSummaries,
  parseProjectFile,
  type PreviewCopyData,
  type ProjectSummary,
  type ProjectTab,
  type ProjectTemplate,
  type ProjectVersion,
  requestPersistentBrowserStorage,
  saveProject,
  saveBrandPresets,
  saveTestCache,
  setActiveProjectId,
  type StoredProject,
  type BrandPreset,
} from "@/lib/project-storage";
import { TEST_IMAGE_SET } from "@/lib/test-image-set";
import { optimizeImageForStorage } from "@/lib/image-storage";

const DEFAULT_TUNING: Tuning = {
  profile: "balanced",
  saturation: 1,
  temperature: 0,
  surfaceTint: 86,
  minContrast: 4.5,
  ignoreNearNeutral: true,
};

const PROFILE_LABELS: Record<Profile, string> = {
  balanced: "균형형",
  soft: "소프트",
  bold: "볼드",
  dark: "다크",
};

const ROLE_LABELS: Array<[keyof UIPalette, string, string]> = [
  ["key", "Key", "대표 강조색"],
  ["keyForeground", "On Key", "강조색 위 텍스트"],
  ["surface", "Surface", "카드 바탕색"],
  ["gradientTop", "Gradient A", "이미지 연결색"],
  ["gradientBottom", "Gradient B", "본문 배경색"],
  ["textPrimary", "Text", "주요 텍스트"],
  ["textSecondary", "Muted", "보조 텍스트"],
  ["accent", "Accent", "버튼·상태색"],
  ["accentForeground", "On Accent", "버튼 위 텍스트"],
  ["border", "Border", "경계선"],
];

const INITIAL_COPY: PreviewCopyData = {
  eyebrow: "TODAY'S PICK",
  title: "이미지와 자연스럽게 이어지는 UI",
  body: "사진의 분위기는 살리고, 정보는 더 선명하게 보여줍니다.",
  meta: "12,340명  ·  ★ 4.8",
  cta: "자세히 보기",
};

const createBlankProject = (name: string): StoredProject => {
  const now = new Date().toISOString();
  return {
    format: "ui-color-logic-project",
    exportVersion: 4,
    id: createProjectId(),
    name,
    createdAt: now,
    updatedAt: now,
    items: [],
    activeId: null,
    tuning: DEFAULT_TUNING,
    copy: INITIAL_COPY,
    template: "product",
    tab: "studio",
    brand: { ...DEFAULT_BRAND, colors: { ...DEFAULT_BRAND.colors }, lockedRoles: [] },
    versions: [],
    lastBackupAt: null,
    backupDirty: true,
  };
};

const readFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const validHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

type EditorSnapshot = {
  items: ImageAnalysis[];
  tuning: Tuning;
  brand: BrandRules;
  template: ProjectTemplate;
};

const cloneItems = (items: ImageAnalysis[]) => items.map((item) => ({
  ...item,
  palette: { ...item.palette },
  templatePalettes: item.templatePalettes && Object.fromEntries(
    Object.entries(item.templatePalettes).map(([key, state]) => [key, state && {
      rawKey: state.rawKey,
      palette: { ...state.palette },
      baselinePalette: state.baselinePalette ? { ...state.baselinePalette } : undefined,
    }]),
  ),
}));

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(0.1, bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`;
};

export default function Home() {
  const [items, setItems] = useState<ImageAnalysis[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tuning, setTuning] = useState<Tuning>(DEFAULT_TUNING);
  const [copy, setCopy] = useState<PreviewCopyData>(INITIAL_COPY);
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCandidates, setShowCandidates] = useState(true);
  const [template, setTemplate] = useState<ProjectTemplate>("product");
  const [tab, setTab] = useState<ProjectTab>("studio");
  const [brand, setBrand] = useState<BrandRules>({ ...DEFAULT_BRAND, colors: { ...DEFAULT_BRAND.colors }, lockedRoles: [] });
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [backupDirty, setBackupDirty] = useState(true);
  const [storageEstimate, setStorageEstimate] = useState<{ usage: number; quota: number } | null>(null);
  const [batchFilter, setBatchFilter] = useState<"all" | "pending" | "exceptions" | "safe" | "approved" | "needs-work">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [brandPresets, setBrandPresetsState] = useState<BrandPreset[]>([]);
  const [selectedBrandPreset, setSelectedBrandPreset] = useState<string>("");
  const [focusReview, setFocusReview] = useState(false);
  const [exportFormat, setExportFormat] = useState<"css" | "tailwind" | "figma">("css");
  const [historyState, setHistoryState] = useState({ undo: 0, redo: 0 });
  const [testProgress, setTestProgress] = useState<{ done: number; total: number } | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("새 프로젝트");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"loading" | "saving" | "saved" | "error">("loading");
  const fileInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const filmstripRef = useRef<HTMLDivElement>(null);
  const [projectCreatedAt, setProjectCreatedAt] = useState(new Date().toISOString());
  const undoStack = useRef<EditorSnapshot[]>([]);
  const redoStack = useRef<EditorSnapshot[]>([]);
  const historyGroup = useRef<string | null>(null);
  const historyGroupTimer = useRef<number | null>(null);
  const skipDirtyEffect = useRef(true);

  const active = useMemo(
    () => items.find((item) => item.id === activeId) ?? items[0] ?? null,
    [activeId, items],
  );

  const activeAlternatives = useMemo(
    () => active ? buildPaletteAlternatives(active, tuning, template, brand) : [],
    [active, brand, template, tuning],
  );

  const itemQuality = useMemo(
    () => new Map(items.map((item) => [item.id, evaluatePalette(item.palette, item.candidates, tuning.minContrast)])),
    [items, tuning.minContrast],
  );

  const activeQuality = active ? itemQuality.get(active.id) ?? null : null;
  const activeBaseline = active?.templatePalettes?.[template]?.baselinePalette ?? active?.palette ?? null;
  const changedPaletteRoles = active && activeBaseline
    ? (Object.keys(active.palette) as Array<keyof UIPalette>).filter((role) => active.palette[role] !== activeBaseline[role]).length
    : 0;

  const reviewCounts = useMemo(() => ({
    pending: items.filter((item) => item.status === "pending").length,
    approved: items.filter((item) => item.status === "approved").length,
    needsWork: items.filter((item) => item.status === "needs-work").length,
    exceptions: items.filter((item) => needsExceptionReview(item, itemQuality.get(item.id))).length,
    exceptionTotal: items.filter((item) => itemQuality.get(item.id)?.level !== "safe").length,
    exceptionApproved: items.filter((item) => item.status === "approved" && itemQuality.get(item.id)?.level !== "safe").length,
    exceptionNeedsWork: items.filter((item) => item.status === "needs-work" && itemQuality.get(item.id)?.level !== "safe").length,
    safe: items.filter((item) => itemQuality.get(item.id)?.level === "safe").length,
    safePending: items.filter((item) => item.status === "pending" && itemQuality.get(item.id)?.level === "safe").length,
  }), [itemQuality, items]);

  const filteredItems = useMemo(() => items.filter((item) => {
    if (batchFilter === "pending") return item.status === "pending";
    if (batchFilter === "exceptions") return needsExceptionReview(item, itemQuality.get(item.id));
    if (batchFilter === "safe") return itemQuality.get(item.id)?.level === "safe";
    if (batchFilter === "approved") return item.status === "approved";
    if (batchFilter === "needs-work") return item.status === "needs-work";
    return true;
  }), [batchFilter, itemQuality, items]);

  const selectedVisibleCount = filteredItems.filter((item) => selectedIds.has(item.id)).length;
  const allVisibleSelected = !!filteredItems.length && selectedVisibleCount === filteredItems.length;

  const loadedTestCount = useMemo(
    () => items.filter((item) => item.sourcePage).length,
    [items],
  );

  const currentProjectBytes = projects.find((project) => project.id === projectId)?.sizeBytes ?? 0;
  const storageRatio = storageEstimate?.quota ? storageEstimate.usage / storageEstimate.quota : 0;
  const storageRisk = storageRatio >= 0.7 || currentProjectBytes >= 100 * 1024 * 1024;

  const currentProject = useMemo<StoredProject | null>(() => projectId ? ({
    format: "ui-color-logic-project",
    exportVersion: 4,
    id: projectId,
    name: projectName.trim() || "이름 없는 프로젝트",
    createdAt: projectCreatedAt,
    updatedAt: new Date().toISOString(),
    items,
    activeId,
    tuning,
    copy,
    template,
    tab,
    brand,
    versions,
    lastBackupAt,
    backupDirty,
  }) : null, [activeId, backupDirty, brand, copy, items, lastBackupAt, projectCreatedAt, projectId, projectName, tab, template, tuning, versions]);

  function restoreProject(project: StoredProject) {
    skipDirtyEffect.current = true;
    setProjectCreatedAt(project.createdAt);
    setProjectId(project.id);
    setProjectName(project.name);
    setItems(project.items);
    setActiveId(project.activeId && project.items.some((item) => item.id === project.activeId)
      ? project.activeId
      : project.items[0]?.id ?? null);
    setTuning(project.tuning);
    setCopy(project.copy);
    setTemplate(project.template);
    setTab(project.tab);
    setBrand(project.brand);
    setVersions(project.versions);
    setLastBackupAt(project.lastBackupAt);
    setBackupDirty(project.backupDirty);
    setSelectedIds(new Set());
    undoStack.current = [];
    redoStack.current = [];
    setHistoryState({ undo: 0, redo: 0 });
  }

  useEffect(() => {
    let cancelled = false;

    async function restoreLastProject() {
      try {
        void requestPersistentBrowserStorage();
        const summaries = await listProjectSummaries();
        const rememberedId = await getActiveProjectId();
        let project = rememberedId ? await getProject(rememberedId) : undefined;
        if (!project && summaries[0]) project = await getProject(summaries[0].id);
        if (!project) {
          project = createBlankProject("새 프로젝트");
          await saveProject(project);
        }
        if (cancelled) return;
        restoreProject(project);
        setProjects(await listProjectSummaries());
        setBrandPresetsState(await getBrandPresets());
        setStorageAvailable(true);
        setStorageReady(true);
        setSaveStatus("saved");
        if (project.items.length) {
          setNotice(`‘${project.name}’ 프로젝트와 이미지 ${project.items.length}장을 복원했습니다.`);
        }
      } catch {
        if (cancelled) return;
        const project = createBlankProject("새 프로젝트");
        restoreProject(project);
        setStorageAvailable(false);
        setStorageReady(true);
        setSaveStatus("error");
        setNotice("브라우저 저장소를 열 수 없어 현재 화면에서만 작업합니다. 일반 모드의 Chrome 또는 Edge에서 다시 시도해 주세요.");
      }
    }

    void restoreLastProject();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!storageReady || !storageAvailable || !currentProject) return;
    const timer = window.setTimeout(() => {
      setSaveStatus("saving");
      void saveProject(currentProject)
        .then((summary) => {
          setProjects((current) => [summary, ...current.filter((item) => item.id !== summary.id)]);
          setSaveStatus("saved");
        })
        .catch(() => setSaveStatus("error"));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [currentProject, storageAvailable, storageReady]);

  useEffect(() => {
    const saveWhenHidden = () => {
      if (document.visibilityState !== "hidden" || !storageAvailable || !currentProject) return;
      void saveProject(currentProject).catch(() => undefined);
    };
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => document.removeEventListener("visibilitychange", saveWhenHidden);
  }, [currentProject, storageAvailable]);

  useEffect(() => {
    if (!storageReady) return;
    if (skipDirtyEffect.current) {
      skipDirtyEffect.current = false;
      return;
    }
    setBackupDirty(true);
  }, [brand, copy, items, projectName, storageReady, template, tuning]);

  useEffect(() => {
    if (!storageReady || !navigator.storage?.estimate) return;
    const timer = window.setTimeout(() => {
      void navigator.storage.estimate().then((estimate) => {
        setStorageEstimate({ usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 });
      }).catch(() => undefined);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [items, storageReady]);

  function snapshot(): EditorSnapshot {
    return {
      items: cloneItems(items),
      tuning: { ...tuning },
      brand: { ...brand, colors: { ...brand.colors }, lockedRoles: [...brand.lockedRoles] },
      template,
    };
  }

  function updateHistoryCount() {
    setHistoryState({ undo: undoStack.current.length, redo: redoStack.current.length });
  }

  function recordHistory(group?: string) {
    if (!group || historyGroup.current !== group) {
      undoStack.current = [...undoStack.current.slice(-19), snapshot()];
      redoStack.current = [];
      updateHistoryCount();
    }
    historyGroup.current = group ?? null;
    if (historyGroupTimer.current) window.clearTimeout(historyGroupTimer.current);
    historyGroupTimer.current = window.setTimeout(() => { historyGroup.current = null; }, 650);
  }

  function restoreSnapshot(next: EditorSnapshot) {
    setItems(cloneItems(next.items));
    setTuning({ ...next.tuning });
    setBrand({ ...next.brand, colors: { ...next.brand.colors }, lockedRoles: [...next.brand.lockedRoles] });
    setTemplate(next.template);
    setSelectedIds(new Set());
    setBackupDirty(true);
  }

  function undo() {
    const previous = undoStack.current.at(-1);
    if (!previous) return;
    redoStack.current = [...redoStack.current.slice(-19), snapshot()];
    undoStack.current = undoStack.current.slice(0, -1);
    restoreSnapshot(previous);
    updateHistoryCount();
    setNotice("직전 팔레트 작업을 실행 취소했습니다.");
  }

  function redo() {
    const next = redoStack.current.at(-1);
    if (!next) return;
    undoStack.current = [...undoStack.current.slice(-19), snapshot()];
    redoStack.current = redoStack.current.slice(0, -1);
    restoreSnapshot(next);
    updateHistoryCount();
    setNotice("취소한 팔레트 작업을 다시 적용했습니다.");
  }

  function saveCurrentTemplate(item: ImageAnalysis, rawKey = item.rawKey, palette = item.palette) {
    return saveTemplatePalette(item, template, rawKey, palette);
  }

  async function persistCurrentProject() {
    if (!storageAvailable || !currentProject) return;
    setSaveStatus("saving");
    const project = { ...currentProject, updatedAt: new Date().toISOString() };
    const summary = await saveProject(project);
    setProjects((current) => [summary, ...current.filter((item) => item.id !== summary.id)]);
    setSaveStatus("saved");
  }

  async function switchProject(nextId: string) {
    if (!storageAvailable || nextId === projectId) return;
    setStorageReady(false);
    try {
      await persistCurrentProject();
      const project = await getProject(nextId);
      if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");
      restoreProject(project);
      await setActiveProjectId(project.id);
      setSaveStatus("saved");
      setNotice(`‘${project.name}’ 프로젝트를 불러왔습니다.`);
    } catch {
      setSaveStatus("error");
      setNotice("프로젝트를 불러오지 못했습니다.");
    } finally {
      setStorageReady(true);
    }
  }

  async function createNewProject() {
    if (!storageAvailable) return;
    setStorageReady(false);
    try {
      await persistCurrentProject();
      const project = createBlankProject(`프로젝트 ${projects.length + 1}`);
      await saveProject(project);
      restoreProject(project);
      setProjects(await listProjectSummaries());
      setSaveStatus("saved");
      setNotice("새 프로젝트를 만들었습니다.");
    } catch {
      setSaveStatus("error");
      setNotice("새 프로젝트를 만들지 못했습니다.");
    } finally {
      setStorageReady(true);
    }
  }

  async function removeCurrentProject() {
    if (!storageAvailable || !projectId) return;
    setStorageReady(false);
    try {
      await deleteStoredProject(projectId);
      const remaining = await listProjectSummaries();
      let project = remaining[0] ? await getProject(remaining[0].id) : undefined;
      if (!project) {
        project = createBlankProject("새 프로젝트");
        await saveProject(project);
      }
      restoreProject(project);
      await setActiveProjectId(project.id);
      setProjects(await listProjectSummaries());
      setSaveStatus("saved");
      setNotice("현재 프로젝트를 삭제했습니다.");
    } catch {
      setSaveStatus("error");
      setNotice("프로젝트를 삭제하지 못했습니다.");
    } finally {
      setStorageReady(true);
    }
  }

  async function resetAllProjects() {
    if (!storageAvailable) return;
    setStorageReady(false);
    try {
      await clearAllStoredData();
      const project = createBlankProject("새 프로젝트");
      await saveProject(project);
      restoreProject(project);
      setProjects([{
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        itemCount: 0,
      }]);
      setSaveStatus("saved");
      setNotice("모든 프로젝트와 테스트 캐시를 초기화했습니다.");
    } catch {
      setSaveStatus("error");
      setNotice("전체 초기화를 완료하지 못했습니다.");
    } finally {
      setStorageReady(true);
    }
  }

  async function exportProjectJson() {
    if (!currentProject) return;
    try {
      const backupAt = new Date().toISOString();
      const project = { ...currentProject, updatedAt: backupAt, lastBackupAt: backupAt, backupDirty: false };
      if (storageAvailable) await saveProject(project);
      const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const safeName = project.name.replace(/[\\/:*?"<>|]/g, "-").trim() || "color-logic-project";
      anchor.href = url;
      anchor.download = `${safeName}.color-logic.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setLastBackupAt(backupAt);
      setBackupDirty(false);
      setNotice("이미지를 포함한 프로젝트 JSON을 저장했습니다.");
    } catch {
      setNotice("프로젝트 JSON을 저장하지 못했습니다.");
    }
  }

  async function importProjectJson(file: File) {
    if (!storageAvailable) return;
    setStorageReady(false);
    try {
      const parsed = parseProjectFile(JSON.parse(await file.text()));
      if (!parsed) throw new Error("지원하지 않는 프로젝트 파일입니다.");
      await persistCurrentProject();
      const now = new Date().toISOString();
      const project: StoredProject = {
        ...parsed,
        id: createProjectId(),
        name: `${parsed.name} (가져옴)`,
        createdAt: now,
        updatedAt: now,
        lastBackupAt: now,
        backupDirty: false,
      };
      await saveProject(project);
      restoreProject(project);
      setProjects(await listProjectSummaries());
      setSaveStatus("saved");
      setNotice(`‘${project.name}’ 프로젝트와 이미지 ${project.items.length}장을 가져왔습니다.`);
    } catch {
      setSaveStatus("error");
      setNotice("프로젝트 JSON을 불러오지 못했습니다. 이 프로그램에서 내보낸 파일인지 확인해 주세요.");
    } finally {
      if (importInput.current) importInput.current.value = "";
      setStorageReady(true);
    }
  }

  async function addFiles(fileList: File[] | FileList) {
    const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    if (!files.length) {
      setNotice("이미지 파일만 넣어주세요.");
      return;
    }
    setProcessing(true);
    setNotice(null);
    try {
      const analyzed = await Promise.all(files.map(async (file) => {
        const sourceDataUrl = await readFile(file);
        const stored = await optimizeImageForStorage(sourceDataUrl).catch(() => ({
          dataUrl: sourceDataUrl,
          originalBytes: file.size,
          storageBytes: file.size,
          optimized: false,
        }));
        const analysis = await analyzeImage(file.name, stored.dataUrl, tuning);
        return saveTemplatePalette({
          ...retuneAnalysis(analysis, tuning, { template, brand }),
          originalBytes: stored.originalBytes,
          storageBytes: stored.storageBytes,
          optimized: stored.optimized,
        }, template);
      }));
      recordHistory();
      setItems((current) => [...current, ...analyzed]);
      setActiveId(analyzed[0].id);
    } catch {
      setNotice("일부 이미지를 분석하지 못했습니다. JPG, PNG 또는 WebP 파일로 다시 시도해 주세요.");
    } finally {
      setProcessing(false);
    }
  }

  async function loadTestSet() {
    const loadedSources = new Set(items.map((item) => item.sourcePage).filter(Boolean));
    const pending = TEST_IMAGE_SET.filter((item) => !loadedSources.has(item.sourcePage));
    if (!pending.length) {
      setNotice("테스트 이미지 50장이 이미 모두 준비되어 있습니다.");
      setTab("batch");
      return;
    }

    recordHistory();

    setProcessing(true);
    setNotice(null);
    setTestProgress({ done: 0, total: pending.length });
    let cached: ImageAnalysis[] = [];
    if (storageAvailable) {
      try {
        cached = await getTestCache(tuning.ignoreNearNeutral);
      } catch {
        cached = [];
      }
    }
    const cachedBySource = new Map(cached.flatMap((item) => item.sourcePage ? [[item.sourcePage, item] as const] : []));
    const cachedItems = pending.flatMap((sample) => {
      const item = cachedBySource.get(sample.sourcePage);
      if (!item) return [];
      return [{
        ...item,
        id: createProjectId(),
        name: `${sample.category} · ${sample.label}`,
        dataUrl: sample.imageUrl,
        palette: applyBrandRules(buildPalette(item.rawKey, tuning), brand),
        status: "pending" as const,
        category: sample.category,
        sourcePage: sample.sourcePage,
      }].map((cachedItem) => saveTemplatePalette(cachedItem, template, cachedItem.rawKey, cachedItem.palette, { resetBaseline: true }));
    });
    const needsAnalysis = pending.filter((sample) => !cachedBySource.has(sample.sourcePage));
    if (cachedItems.length) setItems((current) => [...current, ...cachedItems]);
    let completed = cachedItems.length;
    let failed = 0;
    let firstId: string | null = cachedItems[0]?.id ?? null;
    const analyzedForCache: ImageAnalysis[] = [];
    setTestProgress({ done: completed, total: pending.length });

    for (let start = 0; start < needsAnalysis.length; start += 5) {
      const group = needsAnalysis.slice(start, start + 5);
      const results = await Promise.allSettled(group.map(async (sample) => {
        const analysis = await analyzeImage(`${sample.category} · ${sample.label}`, sample.imageUrl, tuning);
        return saveTemplatePalette({ ...retuneAnalysis(analysis, tuning, { template, brand }), category: sample.category, sourcePage: sample.sourcePage }, template, undefined, undefined, { resetBaseline: true });
      }));
      const succeeded = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      failed += results.length - succeeded.length;
      completed += results.length;
      if (!firstId && succeeded[0]) firstId = succeeded[0].id;
      if (succeeded.length) {
        analyzedForCache.push(...succeeded);
        setItems((current) => [...current, ...succeeded]);
      }
      setTestProgress({ done: completed, total: pending.length });
    }

    if (storageAvailable && (cached.length || analyzedForCache.length)) {
      try {
        await saveTestCache(tuning.ignoreNearNeutral, [...cached, ...analyzedForCache]);
      } catch {
        // 프로젝트 자동 저장은 계속 사용할 수 있으므로 캐시 실패만 조용히 건너뜁니다.
      }
    }

    if (firstId) setActiveId(firstId);
    setTab("batch");
    setNotice(failed
      ? `${completed - failed}장은 분석했고 ${failed}장은 원본 서버 응답 문제로 건너뛰었습니다.`
      : needsAnalysis.length
        ? `테스트 ${cachedItems.length}장은 캐시에서, ${analyzedForCache.length}장은 새로 분석했습니다.`
        : `테스트 이미지 ${cachedItems.length}장을 캐시에서 즉시 불러왔습니다.`);
    setProcessing(false);
    setTestProgress(null);
  }

  function applyTuning(change: Partial<Tuning>) {
    recordHistory(`tuning-${Object.keys(change)[0] ?? "settings"}`);
    const updated = { ...tuning, ...change };
    setTuning(updated);
    setItems((current) => current.map((item) => invalidateReview(saveTemplatePalette(
      retuneAnalysis(item, updated, { brand, preserveRawKey: true }),
      template,
      undefined,
      undefined,
      { resetBaseline: true },
    ))));
  }

  async function applyNeutralFilter(checked: boolean) {
    recordHistory();
    const updated = { ...tuning, ignoreNearNeutral: checked };
    setTuning(updated);
    if (!items.length) return;
    setProcessing(true);
    try {
      let cached: ImageAnalysis[] = [];
      if (storageAvailable) {
        try {
          cached = await getTestCache(checked);
        } catch {
          cached = [];
        }
      }
      const cachedBySource = new Map(cached.flatMap((item) => item.sourcePage ? [[item.sourcePage, item] as const] : []));
      const newlyAnalyzedTests: ImageAnalysis[] = [];
      const refreshed = await Promise.all(items.map(async (item) => {
        const cachedItem = item.sourcePage ? cachedBySource.get(item.sourcePage) : undefined;
        if (cachedItem) {
          return saveTemplatePalette({
            ...cachedItem,
            id: item.id,
            name: item.name,
            dataUrl: item.dataUrl,
            palette: applyBrandRules(buildPalette(cachedItem.rawKey, updated), brand),
            status: "pending",
            category: item.category,
            sourcePage: item.sourcePage,
          }, template, undefined, undefined, { resetBaseline: true });
        }
        const next = retuneAnalysis(await analyzeImage(item.name, item.dataUrl, updated), updated, { template, brand });
        const refreshedItem = {
          ...next,
          id: item.id,
          status: "pending" as const,
          category: item.category,
          sourcePage: item.sourcePage,
        };
        if (refreshedItem.sourcePage) newlyAnalyzedTests.push(refreshedItem);
        return saveTemplatePalette(refreshedItem, template, undefined, undefined, { resetBaseline: true });
      }));
      setItems(refreshed);
      if (storageAvailable && (cached.length || newlyAnalyzedTests.length)) {
        try {
          await saveTestCache(checked, [...cached, ...newlyAnalyzedTests]);
        } catch {
          // 분석 결과는 프로젝트에 저장되므로 캐시 저장 실패만 건너뜁니다.
        }
      }
    } finally {
      setProcessing(false);
    }
  }

  function removeItem(id: string) {
    recordHistory();
    setItems((current) => current.filter((item) => item.id !== id));
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    if (activeId === id) setActiveId(null);
  }

  function setReview(id: string, status: ImageAnalysis["status"]) {
    const currentItem = items.find((item) => item.id === id);
    if (!currentItem || currentItem.status === status) return;
    const wasException = needsExceptionReview(currentItem, itemQuality.get(id));
    const remainingExceptions = items.filter((item) => item.id !== id && needsExceptionReview(item, itemQuality.get(item.id)));
    recordHistory();
    setItems((current) => current.map((item) => item.id === id ? applyReviewStatus(item, status) : item));
    if (status === "pending") {
      setNotice("판정을 취소하고 미검수 상태로 되돌렸습니다.");
    } else if (wasException && remainingExceptions[0]) {
      setActiveId(remainingExceptions[0].id);
      setNotice(`판정을 저장하고 다음 예외로 이동했습니다. 남은 예외 ${remainingExceptions.length}개`);
    } else if (wasException) {
      setNotice("예외 검수를 모두 완료했습니다.");
    }
  }

  function updatePalette(role: keyof UIPalette, value: string) {
    if (!active || !validHex(value) || role === "contrast") return;
    recordHistory();
    setItems((current) => current.map((item) => item.id === active.id
      ? invalidateReview(saveCurrentTemplate(item, item.rawKey, { ...item.palette, [role]: value.toUpperCase() }))
      : item));
    if (brand.lockedRoles.includes(role as PaletteColorRole)) {
      setBrand((current) => ({ ...current, colors: { ...current.colors, [role]: value.toUpperCase() } }));
    }
  }

  function chooseRawColor(hex: string) {
    if (!active) return;
    recordHistory();
    setItems((current) => current.map((item) => item.id === active.id
      ? invalidateReview(saveCurrentTemplate(item, hex, applyBrandRules(buildPalette(hex, tuning), brand)))
      : item));
  }

  function applyTemplate(next: ProjectTemplate) {
    if (next === template) return;
    recordHistory();
    setTemplate(next);
    setItems((current) => current.map((item) => invalidateReview(switchTemplatePalette(item, template, next, tuning, brand))));
  }

  function applyBrandChange(next: BrandRules) {
    recordHistory();
    setBrand(next);
    setItems((current) => current.map((item) => invalidateReview(saveTemplatePalette(
      retuneAnalysis(item, tuning, { brand: next, preserveRawKey: true }),
      template,
      undefined,
      undefined,
      { resetBaseline: true },
    ))));
  }

  function toggleBrandRole(role: PaletteColorRole) {
    const wasLocked = brand.lockedRoles.includes(role);
    const lockedRoles = wasLocked
      ? brand.lockedRoles.filter((item) => item !== role)
      : [...brand.lockedRoles, role];
    const colors = !wasLocked && active && typeof active.palette[role] === "string"
      ? { ...brand.colors, [role]: active.palette[role] }
      : brand.colors;
    applyBrandChange({ ...brand, enabled: lockedRoles.length ? true : brand.enabled, colors, lockedRoles });
  }

  function updateBrandColor(role: PaletteColorRole, value: string) {
    if (!validHex(value)) return;
    applyBrandChange({ ...brand, colors: { ...brand.colors, [role]: value.toUpperCase() } });
  }

  async function saveCurrentBrandPreset() {
    if (!storageAvailable) return;
    const name = brand.name.trim() || "브랜드 프리셋";
    const existing = brandPresets.find((preset) => preset.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    const preset: BrandPreset = {
      id: existing?.id ?? createProjectId(),
      name,
      brand: { ...brand, name, colors: { ...brand.colors }, lockedRoles: [...brand.lockedRoles] },
      updatedAt: new Date().toISOString(),
    };
    const next = [preset, ...brandPresets.filter((item) => item.id !== preset.id)].slice(0, 20);
    await saveBrandPresets(next);
    setBrandPresetsState(next);
    setSelectedBrandPreset(preset.id);
    setNotice(`‘${name}’ 브랜드 프리셋을 저장했습니다.`);
  }

  function applySavedBrandPreset(id: string) {
    const preset = brandPresets.find((item) => item.id === id);
    if (!preset) return;
    setSelectedBrandPreset(id);
    applyBrandChange({
      ...preset.brand,
      colors: { ...preset.brand.colors },
      lockedRoles: [...preset.brand.lockedRoles],
    });
    setNotice(`‘${preset.name}’ 브랜드 프리셋을 적용했습니다.`);
  }

  function chooseAlternative(option: PaletteAlternative) {
    if (!active) return;
    recordHistory();
    setItems((current) => current.map((item) => item.id === active.id
      ? invalidateReview(saveCurrentTemplate(item, option.rawKey, option.palette))
      : item));
  }

  function saveProjectVersion(label?: string) {
    const version: ProjectVersion = {
      id: createProjectId(),
      label: label ?? `버전 ${versions.length + 1}`,
      createdAt: new Date().toISOString(),
      tuning: { ...tuning },
      brand: { ...brand, colors: { ...brand.colors }, lockedRoles: [...brand.lockedRoles] },
      template,
      items: items.map((item) => ({
        id: item.id,
        rawKey: item.rawKey,
        palette: { ...item.palette },
        status: item.status,
        templatePalettes: item.templatePalettes,
      })),
    };
    setVersions((current) => [version, ...current].slice(0, 5));
    if (!label) setNotice("현재 팔레트와 설정을 복원 버전으로 저장했습니다.");
  }

  function restoreProjectVersion(versionId: string) {
    const version = versions.find((item) => item.id === versionId);
    if (!version) return;
    recordHistory();
    const savedItems = new Map(version.items.map((item) => [item.id, item]));
    setTuning(version.tuning);
    setBrand(version.brand);
    setTemplate(version.template);
    setItems((current) => current.map((item) => {
      const saved = savedItems.get(item.id);
      return saved ? {
        ...item,
        rawKey: saved.rawKey,
        palette: saved.palette,
        status: saved.status,
        templatePalettes: saved.templatePalettes ?? item.templatePalettes,
      } : item;
    }));
    setNotice(`‘${version.label}’ 설정을 복원했습니다.`);
  }

  function applyCurrentSettingsToAll() {
    saveProjectVersion("일괄 적용 전 자동 백업");
    recordHistory();
    setItems((current) => current.map((item) => invalidateReview(saveTemplatePalette(retuneAnalysis(item, tuning, { template, brand }), template, undefined, undefined, { resetBaseline: true }))));
    setNotice(`현재 템플릿·보정·브랜드 규칙을 ${items.length}장에 적용했습니다.`);
  }

  function approveSafeItems() {
    saveProjectVersion("일괄 승인 전 자동 백업");
    recordHistory();
    let count = 0;
    setItems((current) => current.map((item) => {
      if (item.status !== "pending" || itemQuality.get(item.id)?.level !== "safe") return item;
      count += 1;
      return applyReviewStatus(item, "approved", "bulk");
    }));
    setNotice(`신뢰도 안전 항목 ${count}장을 일괄 승인했습니다.`);
  }

  function scrollFilmstrip(direction: -1 | 1) {
    const strip = filmstripRef.current;
    if (!strip) return;
    strip.scrollBy({ left: direction * Math.max(220, strip.clientWidth * 0.72), behavior: "smooth" });
  }

  function toggleVisibleSelection() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) filteredItems.forEach((item) => next.delete(item.id));
      else filteredItems.forEach((item) => next.add(item.id));
      return next;
    });
  }

  function toggleItemSelection(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function applyCurrentSettingsToSelection() {
    if (!selectedIds.size) return;
    saveProjectVersion("선택 항목 적용 전 자동 백업");
    recordHistory();
    setItems((current) => current.map((item) => selectedIds.has(item.id)
      ? invalidateReview(saveTemplatePalette(retuneAnalysis(item, tuning, { template, brand }), template, undefined, undefined, { resetBaseline: true }))
      : item));
    setNotice(`선택한 ${selectedIds.size}장에 현재 규칙을 적용했습니다.`);
  }

  function setSelectedReview(status: ImageAnalysis["status"]) {
    if (!selectedIds.size) return;
    saveProjectVersion("선택 항목 판정 전 자동 백업");
    recordHistory();
    setItems((current) => current.map((item) => selectedIds.has(item.id) ? applyReviewStatus(item, status, "bulk") : item));
    setNotice(`선택한 ${selectedIds.size}장을 ${status === "approved" ? "승인" : status === "needs-work" ? "보정 필요" : "미검수"}로 표시했습니다.`);
  }

  function openFocusReview() {
    const next = items.find((item) => needsExceptionReview(item, itemQuality.get(item.id)))
      ?? items.find((item) => item.status === "pending")
      ?? items[0];
    if (next) setActiveId(next.id);
    setFocusReview(true);
  }

  function downloadSelectedPalettes() {
    const chosen = items.filter((item) => selectedIds.has(item.id));
    if (!chosen.length) return;
    const tokenName = (item: ImageAnalysis) => `${item.name.replace(/[^a-zA-Z0-9가-힣]+/g, "-").replace(/^-|-$/g, "") || "palette"}-${item.id.slice(-5)}`;
    let contents: string;
    let extension: string;
    if (exportFormat === "css") {
      contents = chosen.map((item) => `/* ${item.name} */\n${paletteToCss(item.palette).replace(":root", `[data-ui-palette="${tokenName(item)}"]`)}`).join("\n\n");
      extension = "css";
    } else if (exportFormat === "tailwind") {
      contents = JSON.stringify(Object.fromEntries(chosen.map((item) => [tokenName(item), JSON.parse(paletteToTailwind(item.palette))])), null, 2);
      extension = "tailwind.json";
    } else {
      contents = JSON.stringify(Object.fromEntries(chosen.map((item) => [tokenName(item), JSON.parse(paletteToFigmaTokens(item.palette))])), null, 2);
      extension = "figma-tokens.json";
    }
    const blob = new Blob([contents], { type: exportFormat === "css" ? "text/css" : "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${projectName.replace(/[\\/:*?"<>|]/g, "-") || "color-logic"}-selected.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(`선택한 ${chosen.length}장의 ${exportFormat === "css" ? "CSS" : exportFormat === "tailwind" ? "Tailwind" : "Figma Tokens"} 파일을 저장했습니다.`);
  }

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
      if (files.length) void addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if ((tab !== "studio" && !focusReview) || !active || event.ctrlKey || event.metaKey || event.altKey) return;
      const index = items.findIndex((item) => item.id === active.id);
      if (event.key === "ArrowLeft" && index > 0) {
        event.preventDefault();
        setActiveId(items[index - 1].id);
      } else if (event.key === "ArrowRight" && index < items.length - 1) {
        event.preventDefault();
        setActiveId(items[index + 1].id);
      } else if (event.key.toLowerCase() === "a") {
        event.preventDefault();
        setReview(active.id, "approved");
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        setReview(active.id, "needs-work");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  async function copyCss() {
    if (!active) return;
    await navigator.clipboard.writeText(paletteToCss(active.palette));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><Palette size={19} strokeWidth={2.3} /></div>
          <div>
            <h1>Color Logic Studio</h1>
            <p>사진을 UI 컬러 시스템으로</p>
          </div>
        </div>
        <div className="header-actions">
          <Badge variant="outline" className="privacy-badge">브라우저 안에서만 처리</Badge>
          <Button variant="outline" size="sm" onClick={() => window.location.assign("/downloads/ui-color-logic-studio-extension.zip") }>
            <Puzzle size={15} /> Chrome 확장
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open("/promo.html", "_blank", "noopener,noreferrer")}>
            <Layers3 size={15} /> 소개 카드
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open("/manual.html", "_blank", "noopener,noreferrer")}>
            <BookOpen size={15} /> 사용방법
          </Button>
        </div>
      </header>

      <section className="project-strip" aria-label="프로젝트 저장 관리">
        <div className="project-identity">
          <div className="project-icon"><Layers3 size={17} /></div>
          <Select value={projectId ?? undefined} onValueChange={(value) => void switchProject(value)} disabled={!storageReady || !storageAvailable}>
            <SelectTrigger size="sm" className="project-select" aria-label="저장된 프로젝트 선택">
              <SelectValue placeholder="프로젝트 선택" />
            </SelectTrigger>
            <SelectContent align="start">
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name} · {project.itemCount}장{project.sizeBytes ? ` · ${formatBytes(project.sizeBytes)}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="project-name"
            value={projectName}
            disabled={!storageReady || !storageAvailable}
            aria-label="현재 프로젝트 이름"
            onChange={(event) => setProjectName(event.target.value)}
            onBlur={() => !projectName.trim() && setProjectName("이름 없는 프로젝트")}
          />
        </div>
        <div className="project-actions">
          <span className={`save-indicator ${saveStatus}`}>
            {saveStatus === "loading" || saveStatus === "saving"
              ? <RefreshCw className="spin" size={13} />
              : saveStatus === "saved"
                ? <CheckCircle2 size={13} />
                : <AlertTriangle size={13} />}
            {saveStatus === "loading" ? "복원 중" : saveStatus === "saving" ? "자동 저장 중" : saveStatus === "saved" ? "자동 저장됨" : "저장 사용 불가"}
          </span>
          {storageEstimate && (
            <span className={storageRisk ? "storage-indicator warning" : "storage-indicator"} title="현재 브라우저의 전체 사용량과 할당량">
              {storageRisk ? <AlertTriangle size={13} /> : <HardDrive size={13} />}
              저장 {formatBytes(storageEstimate.usage)} / {formatBytes(storageEstimate.quota)}
            </span>
          )}
          <span className={!backupDirty && lastBackupAt ? "backup-indicator ready" : "backup-indicator due"}>
            {!backupDirty && lastBackupAt ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
            {!backupDirty && lastBackupAt
              ? `JSON 백업 ${new Date(lastBackupAt).toLocaleDateString("ko-KR")}`
              : lastBackupAt ? "변경 후 백업 필요" : "JSON 백업 필요"}
          </span>
          {storageRisk && <span className="storage-warning">용량 주의 · JSON 백업 권장</span>}
          <Button variant="outline" size="sm" onClick={() => void createNewProject()} disabled={!storageReady || !storageAvailable}>
            <ImagePlus size={14} /><span>새 프로젝트</span>
          </Button>
          <input
            ref={importInput}
            className="sr-only"
            type="file"
            accept="application/json,.json"
            onChange={(event) => event.target.files?.[0] && void importProjectJson(event.target.files[0])}
          />
          <Button variant="outline" size="sm" onClick={() => importInput.current?.click()} disabled={!storageReady || !storageAvailable}>
            <UploadCloud size={14} /><span>JSON 불러오기</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void exportProjectJson()} disabled={!storageReady || !projectId}>
            <Download size={14} /><span>프로젝트 JSON</span>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!storageReady || !storageAvailable || !projectId}>
                <Trash2 size={14} /><span>현재 삭제</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>현재 프로젝트를 삭제할까요?</AlertDialogTitle>
                <AlertDialogDescription>‘{projectName}’의 이미지와 분석 결과가 이 브라우저에서 삭제됩니다.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => void removeCurrentProject()}>삭제</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={!storageReady || !storageAvailable}>
                <RefreshCw size={14} /><span>전체 초기화</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogTitle>모든 저장 데이터를 초기화할까요?</AlertDialogTitle>
                <AlertDialogDescription>모든 프로젝트, 업로드 이미지, 분석 결과와 테스트 50장 캐시가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => void resetAllProjects()}>전체 초기화</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>

      <section
        className={`drop-strip ${dragging ? "is-dragging" : ""}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void addFiles(event.dataTransfer.files);
        }}
      >
        <input
          ref={fileInput}
          className="sr-only"
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => event.target.files && void addFiles(event.target.files)}
        />
        <div className="drop-icon"><UploadCloud size={21} /></div>
        <div className="drop-copy">
          <strong>{testProgress ? `테스트 이미지 분석 중 ${testProgress.done}/${testProgress.total}` : processing ? "색을 분석하고 있습니다…" : "이미지를 여러 장 끌어놓으세요"}</strong>
          <span>직접 업로드하거나 리서치 테스트셋 50장으로 바로 검증하세요</span>
        </div>
        <div className="drop-actions">
          <Button variant="outline" size="sm" onClick={() => void loadTestSet()} disabled={processing || loadedTestCount >= TEST_IMAGE_SET.length}>
            {testProgress ? <RefreshCw className="spin" size={15} /> : <FlaskConical size={15} />}
            테스트 {loadedTestCount}/{TEST_IMAGE_SET.length}
          </Button>
          <Button size="sm" onClick={() => fileInput.current?.click()} disabled={processing}>
            {processing && !testProgress ? <RefreshCw className="spin" size={15} /> : <ImagePlus size={15} />}
            이미지 선택
          </Button>
        </div>
      </section>

      {notice && (
        <div className="notice"><AlertTriangle size={16} /><span>{notice}</span><button onClick={() => setNotice(null)}><X size={15} /></button></div>
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(value as ProjectTab)} className="workspace-tabs">
        <div className="tab-row">
          <TabsList>
            <TabsTrigger value="studio"><SlidersHorizontal size={15} /> 스튜디오</TabsTrigger>
            <TabsTrigger value="batch"><Layers3 size={15} /> 배치 검수 <span className="count-pill">{items.length}</span></TabsTrigger>
          </TabsList>
          {!!items.length && (
            <div className="review-summary">
              <span><History size={14} /> 미검수 {reviewCounts.pending}</span>
              <span><CheckCircle2 size={14} /> 승인 {reviewCounts.approved}</span>
              <span><AlertTriangle size={14} /> 보정 {reviewCounts.needsWork}</span>
              <span><ShieldCheck size={14} /> 자동 통과 {reviewCounts.safe}</span>
            </div>
          )}
        </div>

        <TabsContent value="studio" className="studio-grid">
          <aside className="control-panel">
            <PanelHeader icon={<Sparkles size={16} />} title="보정 로직" caption="색상각은 살리고 UI 안전 범위로 이동" />

            <div className="profile-grid">
              {(Object.keys(PROFILE_LABELS) as Profile[]).map((profile) => (
                <button
                  key={profile}
                  className={tuning.profile === profile ? "profile-button active" : "profile-button"}
                  onClick={() => applyTuning({ profile })}
                >
                  {PROFILE_LABELS[profile]}
                </button>
              ))}
            </div>

            <div className="brand-rules">
              <div className="brand-rules-head">
                <div>
                  <strong>브랜드 역할색</strong>
                  <span>잠근 색은 재분석·일괄 적용에도 유지</span>
                </div>
                <Switch checked={brand.enabled} onCheckedChange={(enabled) => applyBrandChange({ ...brand, enabled })} />
              </div>
              <Input
                value={brand.name}
                aria-label="브랜드 프리셋 이름"
                onChange={(event) => setBrand((current) => ({ ...current, name: event.target.value }))}
              />
              <div className="brand-preset-row">
                <Select value={selectedBrandPreset || undefined} onValueChange={applySavedBrandPreset} disabled={!brandPresets.length}>
                  <SelectTrigger size="sm" aria-label="저장된 브랜드 프리셋"><SelectValue placeholder="저장 프리셋" /></SelectTrigger>
                  <SelectContent>
                    {brandPresets.map((preset) => <SelectItem key={preset.id} value={preset.id}>{preset.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => void saveCurrentBrandPreset()} disabled={!storageAvailable}><Save size={13} /> 현재 저장</Button>
              </div>
              <div className="brand-token-list">
                {(["key", "accent", "surface"] as PaletteColorRole[]).map((role) => {
                  const color = brand.colors[role] ?? "#777777";
                  const locked = brand.lockedRoles.includes(role);
                  return (
                    <div className="brand-token" key={role}>
                      <label style={{ background: color }}>
                        <input type="color" value={color} onChange={(event) => updateBrandColor(role, event.target.value)} />
                      </label>
                      <div><strong>{role === "key" ? "Key" : role === "accent" ? "Accent" : "Surface"}</strong><span>{color}</span></div>
                      <button className={locked ? "locked" : ""} onClick={() => toggleBrandRole(role)} aria-label={`${role} ${locked ? "잠금 해제" : "잠금"}`}>
                        {locked ? <Lock size={13} /> : <Unlock size={13} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <ControlSlider
              label="채도 보정"
              value={`${Math.round(tuning.saturation * 100)}%`}
              min={65}
              max={145}
              sliderValue={tuning.saturation * 100}
              onChange={(value) => applyTuning({ saturation: value / 100 })}
            />
            <ControlSlider
              label="색온도"
              value={tuning.temperature === 0 ? "중립" : tuning.temperature > 0 ? `웜 +${tuning.temperature}` : `쿨 ${tuning.temperature}`}
              min={-30}
              max={30}
              sliderValue={tuning.temperature}
              onChange={(value) => applyTuning({ temperature: value })}
            />
            <ControlSlider
              label="표면 틴트"
              value={`${tuning.surfaceTint}%`}
              min={70}
              max={96}
              sliderValue={tuning.surfaceTint}
              onChange={(value) => applyTuning({ surfaceTint: value })}
            />
            <ControlSlider
              label="최소 대비"
              value={`${tuning.minContrast.toFixed(1)}:1`}
              min={30}
              max={70}
              step={1}
              sliderValue={tuning.minContrast * 10}
              onChange={(value) => applyTuning({ minContrast: value / 10 })}
            />

            <div className="switch-row">
              <div>
                <strong>무채색·과노출 제외</strong>
                <span>흰 배경과 그림자가 대표색이 되는 현상 방지</span>
              </div>
              <Switch
                checked={tuning.ignoreNearNeutral}
                onCheckedChange={(checked) => void applyNeutralFilter(checked)}
              />
            </div>

            <div className="version-control">
              <div>
                <History size={15} />
                <span><strong>복원 버전</strong><small>이미지 중복 없이 최근 5개</small></span>
              </div>
              <div>
                <Button variant="outline" size="sm" onClick={() => saveProjectVersion()} disabled={!items.length}>버전 저장</Button>
                <Select onValueChange={restoreProjectVersion} disabled={!versions.length}>
                  <SelectTrigger size="sm" aria-label="저장 버전 복원"><SelectValue placeholder="복원" /></SelectTrigger>
                  <SelectContent align="end">
                    {versions.map((version) => (
                      <SelectItem key={version.id} value={version.id}>
                        {version.label} · {new Date(version.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="panel-divider" />
            <PanelHeader icon={<Type size={16} />} title="텍스트 입력" caption="추출된 색 위에서 실제 문구를 검증" />
            <div className="text-fields">
              <LabeledInput label="상단 라벨" value={copy.eyebrow} onChange={(value) => setCopy((current) => ({ ...current, eyebrow: value }))} />
              <LabeledInput label="제목" value={copy.title} onChange={(value) => setCopy((current) => ({ ...current, title: value }))} />
              <label className="field-label">설명
                <Textarea value={copy.body} rows={3} onChange={(event) => setCopy((current) => ({ ...current, body: event.target.value }))} />
              </label>
              <LabeledInput label="메타 정보" value={copy.meta} onChange={(value) => setCopy((current) => ({ ...current, meta: value }))} />
              <LabeledInput label="버튼 문구" value={copy.cta} onChange={(value) => setCopy((current) => ({ ...current, cta: value }))} />
            </div>
          </aside>

          <section className="preview-panel">
            <div className="preview-toolbar">
              <div>
                <span className="section-kicker">LIVE PREVIEW</span>
                <strong>{active?.name ?? "분석할 이미지를 넣어주세요"}</strong>
              </div>
              <div className="preview-toolbar-actions">
                <div className="undo-redo" aria-label="팔레트 작업 기록">
                  <button onClick={undo} disabled={!historyState.undo} title="실행 취소 (Ctrl+Z)" aria-label="실행 취소"><Undo2 size={14} /></button>
                  <button onClick={redo} disabled={!historyState.redo} title="다시 실행 (Ctrl+Shift+Z)" aria-label="다시 실행"><Redo2 size={14} /></button>
                </div>
                <div className="template-switcher" aria-label="미리보기 유형">
                  {(["product", "content", "banner"] as const).map((value) => (
                    <button key={value} className={template === value ? "active" : ""} onClick={() => applyTemplate(value)}>
                      {value === "product" ? "상품" : value === "content" ? "콘텐츠" : "배너"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="region-hint">
              <span>{template === "banner" ? "왼쪽 36%" : "하단 36%"}</span>
              이미지와 UI가 맞닿는 연결부를 우선 분석합니다.
            </div>

            {active ? (
              <div className={`card-stage template-${template}`}>
                <article
                  className="ui-preview-card"
                  style={{
                    "--blend-top": active.palette.gradientTop,
                    "--blend-bottom": active.palette.gradientBottom,
                    "--blend-surface": active.palette.surface,
                    borderColor: active.palette.border,
                    color: active.palette.textPrimary,
                  } as CSSProperties}
                >
                  <div className="preview-photo-wrap">
                    <img src={active.dataUrl} alt="업로드한 미리보기" className="preview-photo" crossOrigin={active.sourcePage ? "anonymous" : undefined} />
                    <div className="photo-bridge" />
                    <span className="preview-chip" style={{ background: active.palette.key, color: active.palette.keyForeground }}>
                      {copy.eyebrow || "PICK"}
                    </span>
                  </div>
                  <div className="preview-content">
                    <h2 style={{ color: active.palette.textPrimary }}>{copy.title || "제목을 입력하세요"}</h2>
                    <p style={{ color: active.palette.textSecondary }}>{copy.body || "설명을 입력하세요"}</p>
                    <div className="preview-meta" style={{ color: active.palette.textSecondary }}>{copy.meta}</div>
                    <button style={{ background: active.palette.accent, color: active.palette.accentForeground, borderColor: active.palette.border }}>
                      {copy.cta || "확인"}
                    </button>
                  </div>
                </article>
                <div className="contrast-readout">
                  <Contrast size={16} />
                  <div><strong>{active.palette.contrast}:1</strong><span>본문 대비</span></div>
                  <Badge className={active.palette.contrast >= tuning.minContrast ? "pass-badge" : "warn-badge"}>
                    {active.palette.contrast >= tuning.minContrast ? "AA 통과" : "보정 필요"}
                  </Badge>
                </div>
              </div>
            ) : (
              <EmptyPreview onSelect={() => fileInput.current?.click()} />
            )}

            {!!items.length && (
              <div className="filmstrip-wrap">
                <div className="filmstrip-guide">
                  <span><i className="selection-sample" /> 현재 선택</span>
                  <span><Check size={11} /> 승인 완료</span>
                  <span><i className="pending-sample" /> 미검수</span>
                  <span><AlertTriangle size={11} /> 보정 필요</span>
                </div>
                <div className="filmstrip-row">
                  <button className="film-nav" onClick={() => scrollFilmstrip(-1)} aria-label="이전 썸네일 보기"><ChevronLeft size={18} /></button>
                  <div ref={filmstripRef} className="filmstrip" aria-label="업로드 이미지 목록. 선택해도 원래 순서와 스크롤 위치가 유지됩니다.">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        className={item.id === active?.id ? "film-item active" : "film-item"}
                        onClick={() => setActiveId(item.id)}
                        title={`${item.name} · ${item.status === "approved" ? "승인 완료" : item.status === "needs-work" ? "보정 필요" : "미검수"}`}
                        aria-label={`${item.name}, ${item.id === active?.id ? "현재 선택, " : ""}${item.status === "approved" ? "승인 완료" : item.status === "needs-work" ? "보정 필요" : "미검수"}`}
                      >
                        <img src={item.dataUrl} alt="" />
                        <span className="film-color" style={{ background: item.palette.key }} />
                        {item.status === "approved" && <Check className="film-status approved" size={13} />}
                        {item.status === "needs-work" && <AlertTriangle className="film-status needs-work" size={13} />}
                        {item.status === "pending" && <span className="film-status pending" />}
                      </button>
                    ))}
                    <button className="film-add" onClick={() => fileInput.current?.click()} aria-label="이미지 추가"><ImagePlus size={18} /></button>
                  </div>
                  <button className="film-nav" onClick={() => scrollFilmstrip(1)} aria-label="다음 썸네일 보기"><ChevronRight size={18} /></button>
                </div>
              </div>
            )}
          </section>

          <aside className="palette-panel">
            <PanelHeader icon={<Palette size={16} />} title="UI 팔레트" caption="각 역할을 직접 미세 조정할 수 있습니다" />

            {active ? (
              <>
                <div className="raw-correction">
                  <div>
                    <span>RAW KEY</span>
                    <strong>{active.rawKey}</strong>
                  </div>
                  <div className="logic-arrow">→</div>
                  <div>
                    <span>CORRECTED</span>
                    <strong>{active.palette.key}</strong>
                  </div>
                  <div className="raw-swatch" style={{ background: `linear-gradient(90deg, ${active.rawKey} 0 50%, ${active.palette.key} 50%)` }} />
                </div>

                {activeBaseline && (
                  <div className="palette-compare" aria-label="자동 팔레트와 현재 팔레트 비교">
                    <div><span>자동</span><div>{[activeBaseline.key, activeBaseline.surface, activeBaseline.gradientBottom, activeBaseline.accent, activeBaseline.textPrimary].map((color, index) => <i key={`${color}-${index}`} style={{ background: color }} />)}</div></div>
                    <div><span>현재</span><div>{[active.palette.key, active.palette.surface, active.palette.gradientBottom, active.palette.accent, active.palette.textPrimary].map((color, index) => <i key={`${color}-${index}`} style={{ background: color }} />)}</div></div>
                    <strong>{changedPaletteRoles ? `${changedPaletteRoles}개 역할 변경` : "자동값 유지"}</strong>
                  </div>
                )}

                <div className="text-logic-note">
                  <Contrast size={15} />
                  <span>본문·버튼·라벨 배경마다 대비를 계산해 검정 또는 흰색을 자동 선택합니다.</span>
                </div>

                <div className="alternative-grid" aria-label="추천 팔레트 3안">
                  {activeAlternatives.map((option) => (
                    <button
                      key={option.id}
                      className={option.rawKey === active.rawKey ? "alternative active" : "alternative"}
                      onClick={() => chooseAlternative(option)}
                    >
                      <span className="alternative-swatches">
                        <i style={{ background: option.palette.key }} />
                        <i style={{ background: option.palette.gradientBottom }} />
                        <i style={{ background: option.palette.accent }} />
                      </span>
                      <strong>{option.label}<em>{option.score}</em></strong>
                      <small>{option.description}</small>
                    </button>
                  ))}
                </div>

                <button className="candidate-toggle" onClick={() => setShowCandidates((value) => !value)}>
                  후보색 {active.candidates.length}개 <span>{showCandidates ? "접기" : "보기"}</span>
                </button>
                {showCandidates && (
                  <div className="candidate-row">
                    {active.candidates.map((candidate, index) => (
                      <button
                        key={`${candidate.hex}-${index}`}
                        className={candidate.hex === active.rawKey ? "candidate active" : "candidate"}
                        style={{ background: candidate.hex }}
                        onClick={() => chooseRawColor(candidate.hex)}
                        title={`${candidate.hex} · 점유 ${Math.round(candidate.share * 100)}%`}
                      >
                        {candidate.hex === active.rawKey && <Check size={13} />}
                      </button>
                    ))}
                  </div>
                )}

                <div className="role-list">
                  {ROLE_LABELS.map(([role, label, description]) => {
                    const value = active.palette[role];
                    if (typeof value !== "string") return null;
                    return (
                      <div className="color-role" key={role}>
                        <label className="color-input-wrap" style={{ background: value }}>
                          <input type="color" value={value} onChange={(event) => updatePalette(role, event.target.value)} />
                        </label>
                        <div className="role-copy"><strong>{label}</strong><span>{description}</span></div>
                        <input
                          key={`${active.id}-${role}-${value}`}
                          className="hex-input"
                          defaultValue={value}
                          spellCheck={false}
                          onBlur={(event) => updatePalette(role, event.target.value)}
                          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
                        />
                        <button
                          className={brand.lockedRoles.includes(role as PaletteColorRole) ? "role-lock locked" : "role-lock"}
                          onClick={() => toggleBrandRole(role as PaletteColorRole)}
                          aria-label={`${label} 역할색 잠금`}
                          title="브랜드 역할색 잠금"
                        >
                          {brand.lockedRoles.includes(role as PaletteColorRole) ? <Lock size={12} /> : <Unlock size={12} />}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="contrast-matrix">
                  <div className="contrast-matrix-head">
                    <strong>대비 매트릭스</strong>
                    <Badge className={activeQuality?.level === "safe" ? "pass-badge" : "warn-badge"}>
                      신뢰도 {activeQuality?.score ?? 0}
                    </Badge>
                  </div>
                  {(activeQuality?.checks ?? buildContrastMatrix(active.palette, tuning.minContrast)).map((check) => (
                    <div className="contrast-check" key={check.id}>
                      <span className="contrast-pair"><i style={{ background: check.foreground }} /><i style={{ background: check.background }} /></span>
                      <span>{check.label}</span>
                      <strong>{check.ratio}:1</strong>
                      {check.pass ? <Check size={13} /> : <AlertTriangle size={13} />}
                    </div>
                  ))}
                </div>

                <div className="palette-actions">
                  <Button variant="outline" onClick={() => {
                    recordHistory();
                    setItems((current) => current.map((item) => item.id === active.id
                      ? invalidateReview(saveTemplatePalette(retuneAnalysis(item, tuning, { template, brand }), template, undefined, undefined, { resetBaseline: true }))
                      : item));
                  }}>
                    <RefreshCw size={15} /> 자동값 복원
                  </Button>
                  <Button onClick={copyCss}>
                    {copied ? <Check size={15} /> : <Clipboard size={15} />}
                    {copied ? "복사됨" : "CSS 복사"}
                  </Button>
                </div>

                <div className="review-actions">
                  <span>이 결과는 어떤가요? <small>A 승인 · R 보정 · ← → 이미지</small></span>
                  <div>
                    <Button
                      size="sm"
                      variant={active.status === "approved" ? "default" : "outline"}
                      onClick={() => setReview(active.id, "approved")}
                    ><Check size={14} /> 승인</Button>
                    <Button
                      size="sm"
                      variant={active.status === "needs-work" ? "destructive" : "outline"}
                      onClick={() => setReview(active.id, "needs-work")}
                    ><AlertTriangle size={14} /> 보정 필요</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={active.status === "pending"}
                      onClick={() => setReview(active.id, "pending")}
                    ><History size={14} /> 미검수</Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="palette-empty"><FileImage size={28} /><p>이미지를 넣으면<br />10개의 UI 역할색이 만들어집니다.</p></div>
            )}
          </aside>
        </TabsContent>

        <TabsContent value="batch" className="batch-panel">
          <div className="batch-heading">
            <div>
              <span className="section-kicker">RAPID REVIEW</span>
              <h2>여러 결과를 한눈에 비교하고 빠르게 판정하세요.</h2>
              <p>승인·보정 필요 기록은 이 브라우저에 저장되어 다음 로직 조정에 활용할 수 있습니다.</p>
            </div>
            <div className="batch-heading-actions">
              <Button variant="outline" onClick={openFocusReview} disabled={!items.length}>
                <ScanSearch size={15} /> 집중 검수
              </Button>
              <Button variant="outline" onClick={applyCurrentSettingsToAll} disabled={!items.length}>
                <RefreshCw size={15} /> 현재 규칙 전체 적용
              </Button>
              <Button variant="outline" onClick={approveSafeItems} disabled={!reviewCounts.safePending}>
                <ShieldCheck size={15} /> 미승인 안전 {reviewCounts.safePending}장 승인
              </Button>
              <Button variant="outline" onClick={() => void loadTestSet()} disabled={processing || loadedTestCount >= TEST_IMAGE_SET.length}>
                <FlaskConical size={16} /> 테스트 {loadedTestCount}/{TEST_IMAGE_SET.length}
              </Button>
              <Button onClick={() => fileInput.current?.click()} disabled={processing}><ImagePlus size={16} /> 이미지 더 넣기</Button>
            </div>
          </div>

          {!!items.length && (
            <div className="batch-filters" aria-label="검수 결과 필터">
              {([
                ["all", "전체", items.length],
                ["pending", "미검수", reviewCounts.pending],
                ["exceptions", "예외 검수", reviewCounts.exceptions],
                ["safe", "자동 통과", reviewCounts.safe],
                ["approved", "승인", reviewCounts.approved],
                ["needs-work", "보정", reviewCounts.needsWork],
              ] as const).map(([value, label, count]) => (
                <button key={value} className={batchFilter === value ? "active" : ""} onClick={() => setBatchFilter(value)}>
                  {label}<span>{count}</span>
                </button>
              ))}
            </div>
          )}

          {!!filteredItems.length && (
            <div className="batch-selection-bar">
              <label>
                <Checkbox
                  checked={allVisibleSelected ? true : selectedVisibleCount ? "indeterminate" : false}
                  onCheckedChange={toggleVisibleSelection}
                  aria-label="현재 필터 결과 전체 선택"
                />
                현재 결과 전체 선택
              </label>
              <strong>선택 {selectedIds.size}장</strong>
              <div>
                <Button variant="outline" size="sm" onClick={applyCurrentSettingsToSelection} disabled={!selectedIds.size}><RefreshCw size={14} /> 규칙 적용</Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedReview("approved")} disabled={!selectedIds.size}><Check size={14} /> 승인</Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedReview("needs-work")} disabled={!selectedIds.size}><AlertTriangle size={14} /> 보정</Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedReview("pending")} disabled={!selectedIds.size}><History size={14} /> 미검수</Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} disabled={!selectedIds.size}>선택 해제</Button>
                <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as typeof exportFormat)}>
                  <SelectTrigger size="sm" aria-label="내보내기 형식"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="css">CSS</SelectItem>
                    <SelectItem value="tailwind">Tailwind</SelectItem>
                    <SelectItem value="figma">Figma Tokens</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={downloadSelectedPalettes} disabled={!selectedIds.size}><FileJson2 size={14} /> 내보내기</Button>
              </div>
            </div>
          )}

          {reviewCounts.exceptionTotal > 0 && reviewCounts.exceptions === 0 && (
            <div className="review-complete" role="status">
              <CheckCircle2 size={20} />
              <div>
                <strong>예외 검수 {reviewCounts.exceptionTotal}건을 모두 처리했습니다.</strong>
                <span>예외 승인 {reviewCounts.exceptionApproved} · 보정 지정 {reviewCounts.exceptionNeedsWork}</span>
              </div>
            </div>
          )}

          {items.length ? (
            <div className="batch-grid">
              {filteredItems.map((item) => {
                const quality = itemQuality.get(item.id);
                return (
                <article className={`batch-card quality-${quality?.level ?? "review"} ${selectedIds.has(item.id) ? "selected" : ""}`} key={item.id}>
                  <div className="batch-image">
                    <img src={item.dataUrl} alt="" crossOrigin={item.sourcePage ? "anonymous" : undefined} />
                    <div style={{ background: `linear-gradient(180deg, transparent 40%, ${item.palette.gradientBottom})` }} />
                    <span>{item.palette.key}</span>
                    <Badge className={quality?.level === "safe" ? "quality-badge safe" : quality?.level === "risk" ? "quality-badge risk" : "quality-badge review"}>
                      {quality?.level === "safe"
                        ? "자동 통과"
                        : item.status === "approved"
                          ? "예외 승인됨"
                          : item.status === "needs-work"
                            ? "보정 지정"
                            : quality?.level === "risk" ? "우선 검수" : "검토"} {quality?.score ?? 0}
                    </Badge>
                    <Checkbox
                      className="batch-select"
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={(checked) => toggleItemSelection(item.id, checked === true)}
                      aria-label={`${item.name} 선택`}
                    />
                  </div>
                  <div className="batch-body" style={{ background: item.palette.gradientBottom }}>
                    <div className="batch-title" style={{ color: item.palette.textPrimary }}>
                      <div>
                        {item.category && <span className="category-tag">{item.category}</span>}
                        <strong>{item.category ? item.name.replace(`${item.category} · `, "") : item.name}</strong>
                      </div>
                      <button onClick={() => removeItem(item.id)} aria-label="이미지 제거"><Trash2 size={15} /></button>
                    </div>
                    {item.sourcePage && (
                      <a className="source-link" href={item.sourcePage} target="_blank" rel="noreferrer">
                        Wikimedia Commons 원본 <ExternalLink size={11} />
                      </a>
                    )}
                    <div className="batch-swatches">
                      {[item.palette.key, item.palette.surface, item.palette.gradientBottom, item.palette.accent, item.palette.textPrimary].map((color) => (
                        <span key={color} style={{ background: color }} title={color} />
                      ))}
                    </div>
                    <div className="batch-metrics" style={{ color: item.palette.textSecondary }}>
                      <span>대비 {item.palette.contrast}:1</span><span>{quality?.issues[0] ?? PROFILE_LABELS[tuning.profile]}</span>
                    </div>
                    {item.reviewedAt && item.status !== "pending" && (
                      <div className="review-timestamp">
                        {item.status === "approved" ? "승인" : "보정"} · {new Date(item.reviewedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} · 이력 {item.reviewHistory?.length ?? 1}
                      </div>
                    )}
                    <div className="batch-actions">
                      <button className={item.status === "approved" ? "approved" : ""} onClick={() => setReview(item.id, "approved")}><Check size={14} /> 승인</button>
                      <button className={item.status === "needs-work" ? "needs-work" : ""} onClick={() => setReview(item.id, "needs-work")}><AlertTriangle size={14} /> 보정</button>
                      <button className={item.status === "pending" ? "pending" : ""} onClick={() => setReview(item.id, "pending")} disabled={item.status === "pending"}><History size={14} /> 미검수</button>
                      <button onClick={() => { setActiveId(item.id); setTab("studio"); }}>편집</button>
                    </div>
                  </div>
                </article>
              );})}
              {!filteredItems.length && (
                <div className="batch-filter-empty">
                  <ShieldCheck size={26} />
                  <strong>{batchFilter === "exceptions" ? "미처리 예외 검수를 모두 완료했습니다." : "이 조건에 해당하는 결과가 없습니다."}</strong>
                  <span>{batchFilter === "exceptions" ? "승인·보정 처리된 예외는 해당 상태 필터에서 확인할 수 있습니다." : "필터를 바꾸거나 이미지를 더 추가해 주세요."}</span>
                </div>
              )}
            </div>
          ) : (
            <EmptyPreview onSelect={() => fileInput.current?.click()} compact />
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={focusReview} onOpenChange={setFocusReview}>
        <DialogContent className="focus-review-dialog">
          <DialogHeader>
            <DialogTitle>집중 검수</DialogTitle>
            <DialogDescription>A 승인 · R 보정 · 판정 후 다음 예외로 자동 이동</DialogDescription>
          </DialogHeader>
          {reviewCounts.exceptionTotal > 0 && reviewCounts.exceptions === 0 ? (
            <div className="focus-review-complete">
              <CheckCircle2 size={34} />
              <strong>예외 검수를 모두 완료했습니다.</strong>
              <span>예외 승인 {reviewCounts.exceptionApproved} · 보정 지정 {reviewCounts.exceptionNeedsWork}</span>
            </div>
          ) : active ? (
            <div className="focus-review-body">
              <div className="focus-review-image">
                <img src={active.dataUrl} alt={active.name} crossOrigin={active.sourcePage ? "anonymous" : undefined} />
                <Badge className={activeQuality?.level === "risk" ? "quality-badge risk" : activeQuality?.level === "safe" ? "quality-badge safe" : "quality-badge review"}>
                  신뢰도 {activeQuality?.score ?? 0}
                </Badge>
              </div>
              <div className="focus-review-info">
                <div><strong>{active.name}</strong><span>남은 예외 {reviewCounts.exceptions}개 · 전체 미검수 {reviewCounts.pending}개</span></div>
                <div className="focus-review-swatches">{[active.palette.key, active.palette.surface, active.palette.gradientBottom, active.palette.accent, active.palette.textPrimary].map((color, index) => <i key={`${color}-${index}`} style={{ background: color }} title={color} />)}</div>
                <p>{activeQuality?.issues[0] ?? "자동 대비 검사를 통과했습니다."}</p>
                <div className="focus-review-actions">
                  <Button onClick={() => setReview(active.id, "approved")}><Check size={16} /> 승인</Button>
                  <Button variant="destructive" onClick={() => setReview(active.id, "needs-work")}><AlertTriangle size={16} /> 보정 필요</Button>
                  <Button variant="outline" onClick={() => { setFocusReview(false); setTab("studio"); }}><Palette size={16} /> 팔레트 편집</Button>
                </div>
              </div>
            </div>
          ) : <EmptyPreview onSelect={() => fileInput.current?.click()} compact />}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function PanelHeader({ icon, title, caption }: { icon: React.ReactNode; title: string; caption: string }) {
  return (
    <div className="panel-header">
      <span>{icon}</span>
      <div><strong>{title}</strong><p>{caption}</p></div>
    </div>
  );
}

function ControlSlider({ label, value, min, max, step = 1, sliderValue, onChange }: {
  label: string;
  value: string;
  min: number;
  max: number;
  step?: number;
  sliderValue: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="slider-control">
      <div><span>{label}</span><strong>{value}</strong></div>
      <Slider min={min} max={max} step={step} value={[sliderValue]} onValueChange={([next]) => onChange(next)} />
    </div>
  );
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field-label">{label}<Input value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function EmptyPreview({ onSelect, compact = false }: { onSelect: () => void; compact?: boolean }) {
  return (
    <div className={compact ? "empty-preview compact" : "empty-preview"}>
      <div className="empty-visual">
        <div className="empty-photo"><FileImage size={30} /></div>
        <div className="empty-arrow">↓</div>
        <div className="empty-colors"><span /><span /><span /><span /></div>
      </div>
      <h2>첫 이미지를 넣어 컬러 로직을 실행하세요.</h2>
      <p>대표색 추출, UI 보정, 그라데이션 생성, 텍스트 대비 검사를 한 번에 처리합니다.</p>
      <Button onClick={onSelect}><UploadCloud size={16} /> 이미지 선택</Button>
    </div>
  );
}
