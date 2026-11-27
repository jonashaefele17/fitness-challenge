/**
 * Downscaling pictures on the device before they are uploaded (generic: progress photos now,
 * later profile pictures or device images). The original never leaves the device; encoding
 * through a canvas drops EXIF data (location, camera) on the way.
 */

export interface ImageSize {
  width: number;
  height: number;
}

/** The size that fits within maxEdge on the longer side, aspect kept; never larger. */
export function fitWithin(size: ImageSize, maxEdge: number): ImageSize {
  const { width, height } = size;
  if (width <= 0 || height <= 0) throw new Error('image_without_size');
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * The sizes to draw through on the way down: halving while more than twice the target is
 * left, then the target. Drawing big steps at once looks jagged; this keeps it smooth.
 */
export function downscaleSteps(from: ImageSize, to: ImageSize): ImageSize[] {
  const steps: ImageSize[] = [];
  let { width, height } = from;
  while (width / 2 >= to.width * 2 && height / 2 >= to.height * 2) {
    width = Math.round(width / 2);
    height = Math.round(height / 2);
    steps.push({ width, height });
  }
  steps.push(to);
  return steps;
}

/**
 * The JPEG qualities to try, best first, while the file is larger than wanted: the given
 * one, then lower in steps of 0.1 down to minQuality.
 */
export function qualitySteps(quality: number, minQuality: number): number[] {
  const steps = [quality];
  for (let q = Math.round((quality - 0.1) * 10) / 10; q >= minQuality - 1e-9; q -= 0.1) {
    steps.push(Math.round(q * 10) / 10);
  }
  return steps;
}

export interface DownscaleOptions {
  /** Longest side in pixels (never upscaled). */
  maxEdge: number;
  /** JPEG quality, 0 … 1. */
  quality: number;
  /** Lower the quality (down to minQuality) while the file is larger than this. */
  maxBytes?: number;
  /** Default 0.5. */
  minQuality?: number;
}

export interface DownscaledImage {
  blob: Blob;
  width: number;
  height: number;
}

type Drawable = ImageBitmap | HTMLImageElement;

/** Decodes with the EXIF orientation applied (portrait photos stay upright). */
async function decode(source: Blob): Promise<{ image: Drawable; release: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
      return {
        image: bitmap,
        release: () => {
          bitmap.close();
        },
      };
    } catch {
      // Older Safari: no options or no support for the format – fall back to <img>.
    }
  }
  // <img> applies the EXIF orientation itself (CSS image-orientation: from-image).
  const url = URL.createObjectURL(source);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  try {
    await img.decode();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return {
    image: img,
    release: () => {
      URL.revokeObjectURL(url);
    },
  };
}

const sizeOf = (image: Drawable): ImageSize =>
  image instanceof HTMLImageElement
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : { width: image.width, height: image.height };

function canvasOf(size: ImageSize): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  return canvas;
}

function draw(target: HTMLCanvasElement, image: CanvasImageSource) {
  const context = target.getContext('2d');
  if (!context) throw new Error('canvas_unavailable');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, target.width, target.height);
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        // Browsers fall back to PNG silently for types they cannot encode: check.
        if (blob && blob.type === 'image/jpeg') resolve(blob);
        else reject(new Error('jpeg_encoding_failed'));
      },
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Decodes a picture (EXIF orientation applied), scales it down to maxEdge on the longer side
 * and encodes it as JPEG (always JPEG: Safari cannot encode WebP from a canvas). The result
 * carries no EXIF data.
 */
export async function downscaleImage(
  source: Blob,
  options: DownscaleOptions,
): Promise<DownscaledImage> {
  const { image, release } = await decode(source);
  try {
    const target = fitWithin(sizeOf(image), options.maxEdge);
    let current: CanvasImageSource = image;
    let canvas: HTMLCanvasElement | null = null;
    for (const step of downscaleSteps(sizeOf(image), target)) {
      const next = canvasOf(step);
      draw(next, current);
      current = next;
      canvas = next;
    }
    if (!canvas) throw new Error('canvas_unavailable');
    let blob: Blob | null = null;
    for (const quality of qualitySteps(options.quality, options.minQuality ?? 0.5)) {
      blob = await toJpeg(canvas, quality);
      if (options.maxBytes === undefined || blob.size <= options.maxBytes) break;
    }
    if (!blob) throw new Error('jpeg_encoding_failed');
    return { blob, width: target.width, height: target.height };
  } finally {
    release();
  }
}
