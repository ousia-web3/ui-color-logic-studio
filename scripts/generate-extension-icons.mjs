import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const iconRoot = path.join(repositoryRoot, "extension", "public", "icons");

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  name.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return output;
}

function insideRoundedRect(x, y, left, top, right, bottom, radius) {
  const centerX = Math.min(Math.max(x, left + radius), right - radius);
  const centerY = Math.min(Math.max(y, top + radius), bottom - radius);
  return (x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2;
}

function createIcon(size) {
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  const shapes = [
    [0.08, 0.08, 0.52, 0.52, 0.10, [46, 158, 255, 255]],
    [0.62, 0.08, 0.92, 0.38, 0.09, [12, 121, 216, 255]],
    [0.08, 0.62, 0.38, 0.92, 0.09, [12, 121, 216, 255]],
    [0.50, 0.50, 0.92, 0.92, 0.10, [104, 196, 255, 255]],
  ];

  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    pixels[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const normalizedX = (x + 0.5) / size;
      const normalizedY = (y + 0.5) / size;
      const target = row + 1 + x * 4;
      for (const [left, top, right, bottom, radius, color] of shapes) {
        if (insideRoundedRect(normalizedX, normalizedY, left, top, right, bottom, radius)) {
          pixels[target] = color[0];
          pixels[target + 1] = color[1];
          pixels[target + 2] = color[2];
          pixels[target + 3] = color[3];
        }
      }
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

await mkdir(iconRoot, { recursive: true });
await Promise.all([16, 32, 48, 128].map((size) => writeFile(path.join(iconRoot, `icon-${size}.png`), createIcon(size))));

console.log("Chrome extension icons generated.");
