export type StoredImageData = {
  dataUrl: string;
  originalBytes: number;
  storageBytes: number;
  optimized: boolean;
};

export const fitImageDimensions = (width: number, height: number, maxSide = 1600) => {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

export const estimateDataUrlBytes = (dataUrl: string) => {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return new Blob([dataUrl]).size;
  const header = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  return header.includes(";base64") ? Math.ceil(body.length * 0.75) : new Blob([decodeURIComponent(body)]).size;
};

const loadImage = (dataUrl: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error("이미지를 최적화하지 못했습니다."));
  image.src = dataUrl;
});

export async function optimizeImageForStorage(dataUrl: string): Promise<StoredImageData> {
  const originalBytes = estimateDataUrlBytes(dataUrl);
  const image = await loadImage(dataUrl);
  if (Math.max(image.naturalWidth, image.naturalHeight) <= 1600 && originalBytes <= 1_200_000) {
    return { dataUrl, originalBytes, storageBytes: originalBytes, optimized: false };
  }

  const size = fitImageDimensions(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return { dataUrl, originalBytes, storageBytes: originalBytes, optimized: false };
  context.drawImage(image, 0, 0, size.width, size.height);
  const optimizedDataUrl = canvas.toDataURL("image/webp", 0.84);
  const storageBytes = estimateDataUrlBytes(optimizedDataUrl);
  if (storageBytes >= originalBytes) return { dataUrl, originalBytes, storageBytes: originalBytes, optimized: false };
  return { dataUrl: optimizedDataUrl, originalBytes, storageBytes, optimized: true };
}
