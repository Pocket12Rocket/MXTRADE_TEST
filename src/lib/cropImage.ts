/**
 * Why: Turns the crop rectangle chosen in `ImageCropDialog` into an upload-ready `File` in the
 * storefront's display ratio and at a bounded size.
 */

// Why: Display ratios shared by the cropper call sites so the numbers live in one place.
// Listing images match every product card/carousel (`aspect-[4/3]` + `object-cover`).
export const LISTING_IMAGE_ASPECT = 4 / 3;
export const AVATAR_IMAGE_ASPECT = 1;

// Why: Output widths large enough for a full-width product carousel on high-DPI screens
// (listing) and a profile avatar (avatar), without shipping multi-megabyte originals.
export const LISTING_IMAGE_OUTPUT_WIDTH = 1600;
export const AVATAR_IMAGE_OUTPUT_WIDTH = 512;

const OUTPUT_QUALITY = 0.9;

/** Crop rectangle in source-image pixels, as reported by react-easy-crop's `onCropComplete`. */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Why: Computes the output canvas size for a crop: keeps the crop's own resolution when it is
 * smaller than the target (never upscales) and otherwise scales down to `maxWidth`, deriving the
 * height from the aspect ratio so the result is exactly the display ratio.
 * @param areaPixels - Crop rectangle in source-image pixels.
 * @param aspect - Width / height ratio (e.g. 4 / 3).
 * @param maxWidth - Maximum output width in pixels.
 * @returns Integer output dimensions (at least 1x1).
 * @example
 * getOutputSize({ width: 3000 }, 4 / 3, 1600); // { width: 1600, height: 1200 }
 */
export function getOutputSize(
  areaPixels: { width: number },
  aspect: number,
  maxWidth: number,
): { width: number; height: number } {
  const width = Math.max(1, Math.round(Math.min(areaPixels.width, maxWidth)));
  const height = Math.max(1, Math.round(width / aspect));
  return { width, height };
}

/**
 * Why: Builds the output file name from the original so sellers still recognise their photos
 * in the preview list, with the extension matching the encoded type.
 * @param originalName - The source file name.
 * @param mimeType - The encoded MIME type (`image/webp` or `image/jpeg`).
 * @returns File name such as `helmet-front.webp`.
 * @example
 * buildCroppedFileName('helmet front.HEIC', 'image/webp'); // 'helmet front.webp'
 */
export function buildCroppedFileName(originalName: string, mimeType: string): string {
  const base = String(originalName || 'image').replace(/\.[^.]+$/, '') || 'image';
  return `${base}.${mimeType === 'image/webp' ? 'webp' : 'jpg'}`;
}

/**
 * Why: Promise wrapper around `canvas.toBlob`, which is callback-based.
 * @param canvas - The canvas to encode.
 * @param mimeType - Requested MIME type.
 * @param quality - Encoder quality 0–1.
 * @returns The encoded blob (browsers fall back to PNG for unsupported
 *   types, so callers must check `blob.type`).
 * @example
 * const blob = await canvasToBlob(canvas, 'image/webp', 0.9);
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));
}

/**
 * Why: Draws the chosen crop onto a canvas at the output size and encodes it as WebP, or JPEG
 * when the browser can't encode WebP.
 * @param file - The original image the user picked.
 * @param areaPixels - Crop rectangle in
 *   source-image pixels, as reported by react-easy-crop's `onCropComplete`.
 * @param options - Output options.
 * @param options.aspect - Target width / height ratio.
 * @param options.maxWidth - Maximum output width in pixels.
 * @returns The cropped, encoded image.
 * @throws {Error} When the browser cannot decode the image or encode the canvas.
 * @example
 * const cropped = await cropImageToFile(file, areaPixels, {
 *   aspect: LISTING_IMAGE_ASPECT,
 *   maxWidth: LISTING_IMAGE_OUTPUT_WIDTH,
 * });
 */
export async function cropImageToFile(
  file: File | Blob,
  areaPixels: CropArea,
  { aspect, maxWidth }: { aspect: number; maxWidth: number },
): Promise<File> {
  // Why: `imageOrientation: 'from-image'` applies EXIF rotation so phone photos crop upright,
  // matching what react-easy-crop displayed.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width, height } = getOutputSize(areaPixels, aspect, maxWidth);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not encode the cropped image.');
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    bitmap,
    areaPixels.x,
    areaPixels.y,
    areaPixels.width,
    areaPixels.height,
    0,
    0,
    width,
    height,
  );
  bitmap.close();

  let blob = await canvasToBlob(canvas, 'image/webp', OUTPUT_QUALITY);
  if (!blob || blob.type !== 'image/webp') {
    blob = await canvasToBlob(canvas, 'image/jpeg', OUTPUT_QUALITY);
  }
  if (!blob) {
    throw new Error('Could not encode the cropped image.');
  }

  return new File([blob], buildCroppedFileName('name' in file ? file.name : '', blob.type), {
    type: blob.type,
  });
}
