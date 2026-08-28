export type RGB = { r: number; g: number; b: number };

export type Profile = "balanced" | "soft" | "bold" | "dark";

export type Tuning = {
  profile: Profile;
  saturation: number;
  temperature: number;
  surfaceTint: number;
  minContrast: number;
  ignoreNearNeutral: boolean;
};

export type Candidate = {
  hex: string;
  share: number;
  chroma: number;
  score: number;
};

export type UIPalette = {
  key: string;
  keyForeground: string;
  surface: string;
  gradientTop: string;
  gradientBottom: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentForeground: string;
  border: string;
  contrast: number;
};

export type ImageAnalysis = {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
  rawKey: string;
  candidates: Candidate[];
  palette: UIPalette;
  status: "pending" | "approved" | "needs-work";
  category?: string;
  sourcePage?: string;
};

type LabPoint = {
  l: number;
  a: number;
  b: number;
  r: number;
  g: number;
  blue: number;
  weight: number;
};

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

export const rgbToHex = ({ r, g, b }: RGB) =>
  `#${[r, g, b]
    .map((value) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();

export const hexToRgb = (hex: string): RGB => {
  const clean = hex.replace("#", "");
  const value = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean.padEnd(6, "0").slice(0, 6);
  const parsed = Number.parseInt(value, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
};

const srgbToLinear = (v: number) => {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};

const rgbToOklab = (rgb: RGB) => {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
};

const rgbToHsl = (rgb: RGB) => {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
};

const hslToRgb = (h: number, s: number, l: number): RGB => {
  const sat = clamp(s / 100);
  const light = clamp(l / 100);
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x]
      : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = light - c / 2;
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
};

const mix = (a: RGB, b: RGB, amount: number): RGB => ({
  r: a.r + (b.r - a.r) * amount,
  g: a.g + (b.g - a.g) * amount,
  b: a.b + (b.b - a.b) * amount,
});

const luminance = (rgb: RGB) =>
  0.2126 * srgbToLinear(rgb.r) + 0.7152 * srgbToLinear(rgb.g) + 0.0722 * srgbToLinear(rgb.b);

export const contrastRatio = (a: string, b: string) => {
  const l1 = luminance(hexToRgb(a));
  const l2 = luminance(hexToRgb(b));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

const chooseText = (background: string, minContrast: number) => {
  const dark = "#151514";
  const light = "#FFFFFF";
  const darkRatio = contrastRatio(dark, background);
  const lightRatio = contrastRatio(light, background);
  const primary = darkRatio >= lightRatio ? dark : light;
  const ratio = Math.max(darkRatio, lightRatio);
  const bg = hexToRgb(background);
  const primaryRgb = hexToRgb(primary);
  let secondary = rgbToHex(mix(primaryRgb, bg, primary === dark ? 0.34 : 0.28));
  if (contrastRatio(secondary, background) < Math.min(minContrast, 4.5)) {
    secondary = rgbToHex(mix(primaryRgb, bg, 0.16));
  }
  return { primary, secondary, ratio };
};

const enforceContrast = (background: RGB, minContrast: number) => {
  let adjusted = background;
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const hex = rgbToHex(adjusted);
    const text = chooseText(hex, minContrast);
    if (text.ratio >= minContrast) return { background: adjusted, text };
    const target = text.primary === "#151514"
      ? { r: 255, g: 255, b: 255 }
      : { r: 12, g: 12, b: 11 };
    adjusted = mix(adjusted, target, 0.07);
  }
  const hex = rgbToHex(adjusted);
  return { background: adjusted, text: chooseText(hex, minContrast) };
};

const shiftTemperature = (rgb: RGB, temperature: number) => {
  const strength = Math.abs(temperature) / 100;
  const target = temperature >= 0
    ? { r: 255, g: 164, b: 86 }
    : { r: 77, g: 132, b: 255 };
  return mix(rgb, target, strength * 0.34);
};

export const buildPalette = (rawHex: string, tuning: Tuning): UIPalette => {
  const raw = shiftTemperature(hexToRgb(rawHex), tuning.temperature);
  const hsl = rgbToHsl(raw);
  const targets = {
    balanced: { sMin: 43, sMax: 76, lMin: 40, lMax: 59 },
    soft: { sMin: 30, sMax: 58, lMin: 52, lMax: 68 },
    bold: { sMin: 62, sMax: 88, lMin: 40, lMax: 56 },
    dark: { sMin: 48, sMax: 78, lMin: 54, lMax: 68 },
  }[tuning.profile];
  const saturation = clamp(hsl.s * tuning.saturation, targets.sMin, targets.sMax);
  const lightness = clamp(hsl.l, targets.lMin, targets.lMax);
  const keyRgb = hslToRgb(hsl.h, saturation, lightness);
  const key = rgbToHex(keyRgb);
  const white = { r: 255, g: 255, b: 255 };
  const ink = { r: 18, g: 18, b: 17 };
  const tint = clamp(tuning.surfaceTint / 100, 0.7, 0.98);
  const surfaceRgb = tuning.profile === "dark"
    ? mix(keyRgb, ink, Math.max(0.7, tint - 0.03))
    : mix(keyRgb, white, tint);
  const gradientTopRgb = tuning.profile === "dark"
    ? mix(keyRgb, ink, 0.5)
    : mix(keyRgb, white, Math.max(0.22, tint - 0.5));
  const initialGradientBottomRgb = tuning.profile === "dark"
    ? mix(keyRgb, ink, 0.76)
    : mix(keyRgb, white, Math.max(0.1, tint - 0.34));
  const contrastSafe = enforceContrast(initialGradientBottomRgb, tuning.minContrast);
  const gradientBottomRgb = contrastSafe.background;
  const surface = rgbToHex(surfaceRgb);
  const gradientTop = rgbToHex(gradientTopRgb);
  const gradientBottom = rgbToHex(gradientBottomRgb);
  const text = contrastSafe.text;
  const accentHsl = rgbToHsl(keyRgb);
  const accent = rgbToHex(hslToRgb(accentHsl.h + 28, Math.min(92, accentHsl.s + 8),
    tuning.profile === "dark" ? Math.min(76, accentHsl.l + 8) : Math.max(34, accentHsl.l - 8)));
  const keyForeground = chooseText(key, 4.5).primary;
  const accentForeground = chooseText(accent, 4.5).primary;
  const border = rgbToHex(mix(surfaceRgb, text.primary === "#151514" ? ink : white, 0.14));
  return {
    key,
    keyForeground,
    surface,
    gradientTop,
    gradientBottom,
    textPrimary: text.primary,
    textSecondary: text.secondary,
    accent,
    accentForeground,
    border,
    contrast: Number(text.ratio.toFixed(2)),
  };
};

const distance = (a: LabPoint, b: LabPoint) =>
  (a.l - b.l) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2;

const extractCandidates = (data: Uint8ClampedArray, width: number, height: number, ignoreNearNeutral: boolean) => {
  const points: LabPoint[] = [];
  const pixelCount = width * height;
  const stride = Math.max(1, Math.ceil(Math.sqrt(pixelCount / 14000)));
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 210) continue;
      const rgb = { r: data[i], g: data[i + 1], b: data[i + 2] };
      const lab = rgbToOklab(rgb);
      const chroma = Math.sqrt(lab.a ** 2 + lab.b ** 2);
      const isExtreme = lab.l < 0.08 || lab.l > 0.96;
      const centerX = Math.abs(x / width - 0.5);
      const centerY = Math.abs(y / height - 0.5);
      const centerBoost = centerX < 0.34 && centerY < 0.34 ? 1.18 : 1;
      const neutralWeight = ignoreNearNeutral && chroma < 0.025 ? 0.08 : 1;
      const extremeWeight = isExtreme ? 0.1 : 1;
      points.push({
        ...lab,
        r: rgb.r,
        g: rgb.g,
        blue: rgb.b,
        weight: centerBoost * neutralWeight * extremeWeight * (0.56 + Math.min(chroma * 3.4, 0.76)),
      });
    }
  }
  if (!points.length) return [];

  const clusterCount = Math.min(7, Math.max(3, Math.round(Math.sqrt(points.length) / 18)));
  const seeds: LabPoint[] = [points.reduce((best, point) => point.weight > best.weight ? point : best)];
  while (seeds.length < clusterCount) {
    let next = points[0];
    let nextScore = -1;
    for (const point of points) {
      const nearest = Math.min(...seeds.map((seed) => distance(point, seed)));
      const score = nearest * point.weight;
      if (score > nextScore) {
        next = point;
        nextScore = score;
      }
    }
    seeds.push(next);
  }

  let centers = seeds.map((seed) => ({ ...seed }));
  const assignments = new Int16Array(points.length);
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const sums = centers.map(() => ({ l: 0, a: 0, b: 0, r: 0, g: 0, blue: 0, weight: 0, count: 0 }));
    points.forEach((point, index) => {
      let best = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      centers.forEach((center, centerIndex) => {
        const d = distance(point, center);
        if (d < bestDistance) {
          bestDistance = d;
          best = centerIndex;
        }
      });
      assignments[index] = best;
      const sum = sums[best];
      sum.l += point.l * point.weight;
      sum.a += point.a * point.weight;
      sum.b += point.b * point.weight;
      sum.r += point.r * point.weight;
      sum.g += point.g * point.weight;
      sum.blue += point.blue * point.weight;
      sum.weight += point.weight;
      sum.count += 1;
    });
    centers = centers.map((center, index) => {
      const sum = sums[index];
      if (!sum.weight) return center;
      return {
        l: sum.l / sum.weight,
        a: sum.a / sum.weight,
        b: sum.b / sum.weight,
        r: sum.r / sum.weight,
        g: sum.g / sum.weight,
        blue: sum.blue / sum.weight,
        weight: sum.weight,
      };
    });
  }

  const totalWeight = centers.reduce((sum, center) => sum + center.weight, 0) || 1;
  return centers.map((center) => {
    const chroma = Math.sqrt(center.a ** 2 + center.b ** 2);
    const share = center.weight / totalWeight;
    const midtone = 1 - Math.min(1, Math.abs(center.l - 0.56) / 0.5);
    const chromaScore = Math.min(1, chroma / 0.18);
    const extremePenalty = center.l < 0.12 || center.l > 0.92 ? 0.34 : 0;
    const score = share * 0.5 + chromaScore * 0.34 + midtone * 0.16 - extremePenalty;
    return {
      hex: rgbToHex({ r: center.r, g: center.g, b: center.blue }),
      share,
      chroma,
      score,
    };
  }).sort((a, b) => b.score - a.score);
};

export const analyzeImage = (name: string, dataUrl: string, tuning: Tuning): Promise<ImageAnalysis> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:\/\//i.test(dataUrl)) image.crossOrigin = "anonymous";
    image.onload = () => {
      const maxSide = 420;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return reject(new Error("Canvas is unavailable"));
      context.drawImage(image, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;
      const candidates = extractCandidates(pixels, width, height, tuning.ignoreNearNeutral);
      const rawKey = candidates[0]?.hex ?? "#7C6FE8";
      resolve({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name,
        dataUrl,
        width: image.naturalWidth,
        height: image.naturalHeight,
        rawKey,
        candidates,
        palette: buildPalette(rawKey, tuning),
        status: "pending",
      });
    };
    image.onerror = () => reject(new Error("이미지를 읽을 수 없습니다."));
    image.src = dataUrl;
  });

export const retuneAnalysis = (analysis: ImageAnalysis, tuning: Tuning): ImageAnalysis => ({
  ...analysis,
  palette: buildPalette(analysis.rawKey, tuning),
});

export const paletteToCss = (palette: UIPalette) => `:root {\n${[
  ["ui-key", palette.key],
  ["ui-key-foreground", palette.keyForeground],
  ["ui-surface", palette.surface],
  ["ui-gradient-top", palette.gradientTop],
  ["ui-gradient-bottom", palette.gradientBottom],
  ["ui-text-primary", palette.textPrimary],
  ["ui-text-secondary", palette.textSecondary],
  ["ui-accent", palette.accent],
  ["ui-accent-foreground", palette.accentForeground],
  ["ui-border", palette.border],
].map(([key, value]) => `  --${key}: ${value};`).join("\n")}\n}`;
