// SPDX-License-Identifier: MIT
// Laplacian-variance blur estimator.
// Lower variance = blurrier. Threshold tuned for typical phone photos.

export const BLUR_OK = 100;
export const BLUR_SOFT = 60;

export type BlurVerdict = "clear" | "soft" | "blurry";

export async function estimateBlur(
  file: File,
): Promise<{ verdict: BlurVerdict; variance: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { canvas, ctx } = downscaledCanvas(img, 640);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const variance = laplacianVariance(data);
    const verdict: BlurVerdict =
      variance >= BLUR_OK ? "clear" : variance >= BLUR_SOFT ? "soft" : "blurry";
    return { verdict, variance };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function downscaledCanvas(img: HTMLImageElement, maxWidth: number) {
  const scale = Math.min(1, maxWidth / img.naturalWidth);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas 2d unavailable");
  return { canvas, ctx };
}

function laplacianVariance(data: ImageData): number {
  const { width, height, data: px } = data;
  const gray = new Float32Array(width * height);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    gray[j] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  }

  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap =
        -4 * gray[i] +
        gray[i - 1] +
        gray[i + 1] +
        gray[i - width] +
        gray[i + width];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}
