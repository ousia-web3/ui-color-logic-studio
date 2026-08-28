import { execFile } from "node:child_process";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";

const exec = promisify(execFile);
const root = process.cwd();
const source = await readFile(path.join(root, "lib/test-image-set.ts"), "utf8");
const expression = /commonsImage\("([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"\)/g;
const samples = [...source.matchAll(expression)].map((match) => ({
  category: match[1],
  id: match[2],
  label: match[3],
  filename: match[4],
}));

if (samples.length !== 50) {
  throw new Error(`Expected 50 samples, found ${samples.length}`);
}

const targetDirectory = path.join(root, "public/test-images");
await mkdir(targetDirectory, { recursive: true });

async function download(sample) {
  const normalized = sample.filename.replaceAll(" ", "_");
  const sourceUrl = `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(normalized)}?width=1200`;
  const temporaryPath = path.join(targetDirectory, `${sample.id}.source`);
  const outputPath = path.join(targetDirectory, `${sample.id}.webp`);
  try {
    await stat(outputPath);
    return { ...sample, status: "cached", outputPath };
  } catch {
    // Download below.
  }

  await exec("curl", ["-L", "--fail", "--retry", "2", "--max-time", "45", "-sS", "-o", temporaryPath, sourceUrl]);
  await exec("convert", [temporaryPath, "-auto-orient", "-strip", "-resize", "960x960>", "-quality", "82", `${outputPath}.tmp.webp`]);
  await rename(`${outputPath}.tmp.webp`, outputPath);
  await rm(temporaryPath, { force: true });
  return { ...sample, status: "downloaded", outputPath };
}

const queue = [...samples];
const results = [];
const failures = [];

async function worker() {
  while (queue.length) {
    const sample = queue.shift();
    try {
      const result = await download(sample);
      results.push(result);
      process.stdout.write(`✓ ${sample.category} / ${sample.label}\n`);
    } catch (error) {
      failures.push({ ...sample, error: error instanceof Error ? error.message : String(error) });
      process.stderr.write(`✗ ${sample.category} / ${sample.label}\n`);
    }
  }
}

await Promise.all(Array.from({ length: 6 }, () => worker()));

const manifest = results
  .sort((a, b) => a.id.localeCompare(b.id))
  .map((sample) => ({
    id: sample.id,
    category: sample.category,
    label: sample.label,
    filename: sample.filename,
    imagePath: `/test-images/${sample.id}.webp`,
    sourcePage: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(sample.filename.replaceAll(" ", "_"))}`,
  }));

await writeFile(path.join(targetDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Completed ${results.length}/${samples.length}`);
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exitCode = 1;
}
