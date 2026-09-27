/**
 * Why: Turns the crop rectangle chosen in `ImageCropDialog` into an upload-ready `File`, so every
 * listing image arrives at the backend already in the storefront's display ratio (4:3 cards and
 * carousels, 1:1 avatars) and at a bounded size. The backend still converts to WebP and
 * re-validates dimensions; this only saves bandwidth and gives sellers control over framing.
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

/**
 * Why: Computes the output canvas size for a crop: keeps the crop's own resolution when it is
 * smaller than the target (never upscales) and otherwise scales down to `maxWidth`, deriving the
 * height from the aspect ratio so the result is exactly the display ratio.
 * @param {{width: number}} areaPixels - Crop rectangle in source-image pixels.
 * @param {number} aspect - Width / height ratio (e.g. 4 / 3).
 * @param {number} maxWidth - Maximum output width in pixels.
 * @returns {{width: number, height: number}} Integer output dimensions (at least 1x1).
 * @example
 * getOutputSize({ width: 3000 }, 4 / 3, 1600); // { width: 1600, height: 1200 }
 */
export function getOutputSize(areaPixels, aspect, maxWidth) {
  const width = Math.max(1, Math.round(Math.min(areaPixels.width, maxWidth)));
  const height = Math.max(1, Math.round(width / aspect));
  return { width, height };
}

/**
 * Why: Builds the output file name from the original so sellers still recognise their photos
 * in the preview list, with the extension matching the encoded type.
 * @param {string} originalName - The source file name.
 * @param {string} mimeType - The encoded MIME type (`image/webp` or `image/jpeg`).
 * @returns {string} File name such as `helmet-front.webp`.
 * @example
 * buildCroppedFileName('helmet front.HEIC', 'image/webp'); // 'helmet front.webp'
 */
export function buildCroppedFileName(originalName, mimeType) {
  const base = String(originalName || 'image').replace(/\.[^.]+$/, '') || 'image';
  return `${base}.${mimeType === 'image/webp' ? 'webp' : 'jpg'}`;
}

/**
 * Why: Promise wrapper around `canvas.toBlob`, which is callback-based.
 * @param {HTMLCanvasElement} canvas - The canvas to encode.
 * @param {string} mimeType - Requested MIME type.
 * @param {number} quality - Encoder quality 0–1.
 * @returns {Promise<Blob|null>} The encoded blob (browsers fall back to PNG for unsupported
 *   types, so callers must check `blob.type`).
 * @example
 * const blob = await canvasToBlob(canvas, 'image/webp', 0.9);
 */
function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));
}

/**
 * Why: Draws the chosen crop of the source image onto a canvas at the output size and encodes
 * it. WebP is preferred because the backend stores WebP; browsers that cannot encode WebP
 * (they silently return PNG) fall back to JPEG to keep the upload small.
 * @param {File|Blob} file - The original image the user picked.
 * @param {{x: number, y: number, width: number, height: number}} areaPixels - Crop rectangle in
 *   source-image pixels, as reported by react-easy-crop's `onCropComplete`.
 * @param {object} options - Output options.
 * @param {number} options.aspect - Target width / height ratio.
 * @param {number} options.maxWidth - Maximum output width in pixels.
 * @returns {Promise<File>} The cropped, encoded image.
 * @throws {Error} When the browser cannot decode the image or encode the canvas.
 * @example
 * const cropped = await cropImageToFile(file, areaPixels, {
 *   aspect: LISTING_IMAGE_ASPECT,
 *   maxWidth: LISTING_IMAGE_OUTPUT_WIDTH,
 * });
 */
export async function cropImageToFile(file, areaPixels, { aspect, maxWidth }) {
  // Why: `imageOrientation: 'from-image'` applies EXIF rotation so phone photos crop upright,
  // matching what react-easy-crop displayed.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width, height } = getOutputSize(areaPixels, aspect, maxWidth);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
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

  return new File([blob], buildCroppedFileName(file.name, blob.type), { type: blob.type });
}
