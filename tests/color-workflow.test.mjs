import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

const tuning = {
  profile: "balanced",
  saturation: 1,
  temperature: 0,
  surfaceTint: 86,
  minContrast: 4.5,
  ignoreNearNeutral: true,
};

test("keeps locked brand roles while recomputing safe foregrounds", async () => {
  const { applyBrandRules, buildContrastMatrix, buildPalette, paletteToFigmaTokens, paletteToTailwind } = await vite.ssrLoadModule("/lib/color-engine.ts");
  const palette = applyBrandRules(buildPalette("#D06F45", tuning), {
    name: "Contract",
    enabled: true,
    colors: { key: "#243B2D", accent: "#B65B37" },
    lockedRoles: ["key", "accent"],
  });

  assert.equal(palette.key, "#243B2D");
  assert.equal(palette.accent, "#B65B37");
  const checks = buildContrastMatrix(palette, tuning.minContrast);
  assert.equal(checks.find((check) => check.id === "key")?.pass, true);
  assert.equal(checks.find((check) => check.id === "accent")?.pass, true);
  assert.equal(JSON.parse(paletteToTailwind(palette)).theme.extend.colors["ui-key"], "#243B2D");
  assert.equal(JSON.parse(paletteToFigmaTokens(palette)).color.key.$value, "#243B2D");
});

test("fits large images for browser storage without enlarging small images", async () => {
  const { fitImageDimensions } = await vite.ssrLoadModule("/lib/image-storage.ts");
  assert.deepEqual(fitImageDimensions(4000, 2000), { width: 1600, height: 800 });
  assert.deepEqual(fitImageDimensions(800, 600), { width: 800, height: 600 });
});

test("uses the image-to-UI seam for template recommendations", async () => {
  const { buildPalette, buildPaletteAlternatives } = await vite.ssrLoadModule("/lib/color-engine.ts");
  const candidates = [{ hex: "#8A5E3B", share: 0.4, chroma: 0.12, score: 0.7 }];
  const analysis = {
    id: "sample",
    name: "sample.jpg",
    dataUrl: "data:image/png;base64,AA==",
    width: 100,
    height: 100,
    rawKey: "#8A5E3B",
    candidates,
    regionCandidates: {
      full: candidates,
      bottom: [{ hex: "#446B5A", share: 0.5, chroma: 0.1, score: 0.8 }],
      left: [{ hex: "#4C5790", share: 0.5, chroma: 0.1, score: 0.8 }],
    },
    palette: buildPalette("#8A5E3B", tuning),
    status: "pending",
  };

  assert.equal(buildPaletteAlternatives(analysis, tuning, "product")[0].rawKey, "#446B5A");
  assert.equal(buildPaletteAlternatives(analysis, tuning, "banner")[0].rawKey, "#4C5790");
});

test("keeps manual palettes independent for each preview template", async () => {
  const { buildPalette, saveTemplatePalette, switchTemplatePalette } = await vite.ssrLoadModule("/lib/color-engine.ts");
  const candidates = [{ hex: "#8A5E3B", share: 0.4, chroma: 0.12, score: 0.7 }];
  let analysis = {
    id: "templates",
    name: "sample.jpg",
    dataUrl: "data:image/png;base64,AA==",
    width: 100,
    height: 100,
    rawKey: "#8A5E3B",
    candidates,
    regionCandidates: {
      full: candidates,
      bottom: [{ hex: "#446B5A", share: 0.5, chroma: 0.1, score: 0.8 }],
      left: [{ hex: "#4C5790", share: 0.5, chroma: 0.1, score: 0.8 }],
    },
    palette: buildPalette("#8A5E3B", tuning),
    status: "pending",
  };
  const productAccent = "#A12233";
  analysis = saveTemplatePalette(analysis, "product", analysis.rawKey, { ...analysis.palette, accent: productAccent });
  analysis = switchTemplatePalette(analysis, "product", "banner", tuning);
  const bannerAccent = "#3355AA";
  analysis = saveTemplatePalette(analysis, "banner", analysis.rawKey, { ...analysis.palette, accent: bannerAccent });
  analysis = switchTemplatePalette(analysis, "banner", "product", tuning);

  assert.equal(analysis.palette.accent, productAccent);
  assert.equal(analysis.templatePalettes.banner.palette.accent, bannerAccent);
});

test("removes approved and correction items from the exception review queue", async () => {
  const { invalidateReview, needsExceptionReview } = await vite.ssrLoadModule("/lib/color-engine.ts");
  const quality = { level: "review", score: 72, issues: [], checks: [] };
  const item = { status: "pending" };

  assert.equal(needsExceptionReview(item, quality), true);
  assert.equal(needsExceptionReview({ ...item, status: "approved" }, quality), false);
  assert.equal(needsExceptionReview({ ...item, status: "needs-work" }, quality), false);
  assert.equal(needsExceptionReview(item, { ...quality, level: "safe" }), false);
  assert.equal(invalidateReview({ ...item, status: "approved" }).status, "pending");
});

test("migrates version 2 project backups without dropping images", async () => {
  const { buildPalette } = await vite.ssrLoadModule("/lib/color-engine.ts");
  const { parseProjectFile } = await vite.ssrLoadModule("/lib/project-storage.ts");
  const project = parseProjectFile({
    format: "ui-color-logic-project",
    exportVersion: 2,
    id: "legacy",
    name: "기존 프로젝트",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    items: [{
      id: "image",
      name: "sample.png",
      dataUrl: "data:image/png;base64,AA==",
      width: 1,
      height: 1,
      rawKey: "#8A5E3B",
      candidates: [],
      palette: buildPalette("#8A5E3B", tuning),
      status: "pending",
    }],
    activeId: "image",
    tuning,
    copy: { eyebrow: "A", title: "B", body: "C", meta: "D", cta: "E" },
    template: "product",
    tab: "studio",
  });

  assert.equal(project?.exportVersion, 4);
  assert.equal(project?.items.length, 1);
  assert.deepEqual(project?.versions, []);
  assert.equal(project?.brand.enabled, false);
  assert.equal(project?.backupDirty, true);
});
