/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Clipboard,
  Contrast,
  Download,
  ExternalLink,
  FileImage,
  FlaskConical,
  ImagePlus,
  Layers3,
  Palette,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  UploadCloud,
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
  buildPalette,
  ImageAnalysis,
  paletteToCss,
  Profile,
  retuneAnalysis,
  Tuning,
  UIPalette,
} from "@/lib/color-engine";
import {
  clearAllStoredData,
  createProjectId,
  deleteProject as deleteStoredProject,
  getActiveProjectId,
  getProject,
  getTestCache,
  listProjectSummaries,
  parseProjectFile,
  type PreviewCopyData,
  type ProjectSummary,
  type ProjectTab,
  type ProjectTemplate,
  requestPersistentBrowserStorage,
  saveProject,
  saveTestCache,
  setActiveProjectId,
  type StoredProject,
} from "@/lib/project-storage";
import { TEST_IMAGE_SET } from "@/lib/test-image-set";

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
    exportVersion: 2,
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
  const [testProgress, setTestProgress] = useState<{ done: number; total: number } | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("새 프로젝트");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"loading" | "saving" | "saved" | "error">("loading");
  const fileInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const createdAt = useRef(new Date().toISOString());
  const latestProject = useRef<StoredProject | null>(null);

  const active = useMemo(
    () => items.find((item) => item.id === activeId) ?? items[0] ?? null,
    [activeId, items],
  );

  const reviewCounts = useMemo(() => ({
    approved: items.filter((item) => item.status === "approved").length,
    needsWork: items.filter((item) => item.status === "needs-work").length,
  }), [items]);

  const loadedTestCount = useMemo(
    () => items.filter((item) => item.sourcePage).length,
    [items],
  );

  latestProject.current = projectId ? {
    format: "ui-color-logic-project",
    exportVersion: 2,
    id: projectId,
    name: projectName.trim() || "이름 없는 프로젝트",
    createdAt: createdAt.current,
    updatedAt: new Date().toISOString(),
    items,
    activeId,
    tuning,
    copy,
    template,
    tab,
  } : null;

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
    if (!storageReady || !storageAvailable || !latestProject.current) return;
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      const project = latestProject.current;
      if (!project) return;
      void saveProject(project)
        .then((summary) => {
          setProjects((current) => [summary, ...current.filter((item) => item.id !== summary.id)]);
          setSaveStatus("saved");
        })
        .catch(() => setSaveStatus("error"));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [activeId, copy, items, projectId, projectName, storageAvailable, storageReady, tab, template, tuning]);

  useEffect(() => {
    const saveWhenHidden = () => {
      if (document.visibilityState !== "hidden" || !storageAvailable || !latestProject.current) return;
      void saveProject(latestProject.current).catch(() => undefined);
    };
    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => document.removeEventListener("visibilitychange", saveWhenHidden);
  }, [storageAvailable]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
      if (files.length) void addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tuning]);

  function restoreProject(project: StoredProject) {
    createdAt.current = project.createdAt;
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
  }

  async function persistCurrentProject() {
    if (!storageAvailable || !latestProject.current) return;
    setSaveStatus("saving");
    const project = { ...latestProject.current, updatedAt: new Date().toISOString() };
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
    if (!latestProject.current) return;
    try {
      await persistCurrentProject();
      const project = { ...latestProject.current, updatedAt: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const safeName = project.name.replace(/[\\/:*?"<>|]/g, "-").trim() || "color-logic-project";
      anchor.href = url;
      anchor.download = `${safeName}.color-logic.json`;
      anchor.click();
      URL.revokeObjectURL(url);
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
        const dataUrl = await readFile(file);
        return analyzeImage(file.name, dataUrl, tuning);
      }));
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
        palette: buildPalette(item.rawKey, tuning),
        status: "pending" as const,
        category: sample.category,
        sourcePage: sample.sourcePage,
      }];
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
        return { ...analysis, category: sample.category, sourcePage: sample.sourcePage };
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
    const updated = { ...tuning, ...change };
    setTuning(updated);
    setItems((current) => current.map((item) => retuneAnalysis(item, updated)));
  }

  async function applyNeutralFilter(checked: boolean) {
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
          return {
            ...cachedItem,
            id: item.id,
            name: item.name,
            dataUrl: item.dataUrl,
            palette: buildPalette(cachedItem.rawKey, updated),
            status: item.status,
            category: item.category,
            sourcePage: item.sourcePage,
          };
        }
        const next = await analyzeImage(item.name, item.dataUrl, updated);
        const refreshedItem = {
          ...next,
          id: item.id,
          status: item.status,
          category: item.category,
          sourcePage: item.sourcePage,
        };
        if (refreshedItem.sourcePage) newlyAnalyzedTests.push(refreshedItem);
        return refreshedItem;
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
    setItems((current) => current.filter((item) => item.id !== id));
    if (activeId === id) setActiveId(null);
  }

  function setReview(id: string, status: ImageAnalysis["status"]) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  }

  function updatePalette(role: keyof UIPalette, value: string) {
    if (!active || !validHex(value) || role === "contrast") return;
    setItems((current) => current.map((item) => item.id === active.id
      ? { ...item, palette: { ...item.palette, [role]: value.toUpperCase() } }
      : item));
  }

  function chooseRawColor(hex: string) {
    if (!active) return;
    setItems((current) => current.map((item) => item.id === active.id
      ? { ...item, rawKey: hex, palette: buildPalette(hex, tuning) }
      : item));
  }

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
                  {project.name} · {project.itemCount}장
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
              <span><CheckCircle2 size={14} /> 승인 {reviewCounts.approved}</span>
              <span><AlertTriangle size={14} /> 보정 {reviewCounts.needsWork}</span>
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
              <div className="template-switcher" aria-label="미리보기 유형">
                {(["product", "content", "banner"] as const).map((value) => (
                  <button key={value} className={template === value ? "active" : ""} onClick={() => setTemplate(value)}>
                    {value === "product" ? "상품" : value === "content" ? "콘텐츠" : "배너"}
                  </button>
                ))}
              </div>
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
              <div className="filmstrip" aria-label="업로드 이미지 목록">
                {items.map((item) => (
                  <button
                    key={item.id}
                    className={item.id === active?.id ? "film-item active" : "film-item"}
                    onClick={() => setActiveId(item.id)}
                    title={item.name}
                  >
                    <img src={item.dataUrl} alt="" />
                    <span style={{ background: item.palette.key }} />
                    {item.status === "approved" && <Check className="film-status approved" size={13} />}
                    {item.status === "needs-work" && <AlertTriangle className="film-status needs-work" size={13} />}
                  </button>
                ))}
                <button className="film-add" onClick={() => fileInput.current?.click()}><ImagePlus size={18} /></button>
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

                <div className="text-logic-note">
                  <Contrast size={15} />
                  <span>본문·버튼·라벨 배경마다 대비를 계산해 검정 또는 흰색을 자동 선택합니다.</span>
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
                      </div>
                    );
                  })}
                </div>

                <div className="palette-actions">
                  <Button variant="outline" onClick={() => setItems((current) => current.map((item) => item.id === active.id ? retuneAnalysis(item, tuning) : item))}>
                    <RefreshCw size={15} /> 자동값 복원
                  </Button>
                  <Button onClick={copyCss}>
                    {copied ? <Check size={15} /> : <Clipboard size={15} />}
                    {copied ? "복사됨" : "CSS 복사"}
                  </Button>
                </div>

                <div className="review-actions">
                  <span>이 결과는 어떤가요?</span>
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
                  </div>
                </div>
              </>
            ) : (
              <div className="palette-empty"><FileImage size={28} /><p>이미지를 넣으면<br />8개의 UI 역할색이 만들어집니다.</p></div>
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
              <Button variant="outline" onClick={() => void loadTestSet()} disabled={processing || loadedTestCount >= TEST_IMAGE_SET.length}>
                <FlaskConical size={16} /> 테스트 {loadedTestCount}/{TEST_IMAGE_SET.length}
              </Button>
              <Button onClick={() => fileInput.current?.click()} disabled={processing}><ImagePlus size={16} /> 이미지 더 넣기</Button>
            </div>
          </div>

          {items.length ? (
            <div className="batch-grid">
              {items.map((item) => (
                <article className="batch-card" key={item.id}>
                  <div className="batch-image">
                    <img src={item.dataUrl} alt="" crossOrigin={item.sourcePage ? "anonymous" : undefined} />
                    <div style={{ background: `linear-gradient(180deg, transparent 40%, ${item.palette.gradientBottom})` }} />
                    <span>{item.palette.key}</span>
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
                      <span>대비 {item.palette.contrast}:1</span><span>{PROFILE_LABELS[tuning.profile]}</span>
                    </div>
                    <div className="batch-actions">
                      <button className={item.status === "approved" ? "approved" : ""} onClick={() => setReview(item.id, "approved")}><Check size={14} /> 승인</button>
                      <button className={item.status === "needs-work" ? "needs-work" : ""} onClick={() => setReview(item.id, "needs-work")}><AlertTriangle size={14} /> 보정</button>
                      <button onClick={() => { setActiveId(item.id); setTab("studio"); }}>편집</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyPreview onSelect={() => fileInput.current?.click()} compact />
          )}
        </TabsContent>
      </Tabs>
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
