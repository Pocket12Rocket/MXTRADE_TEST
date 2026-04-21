/**
 * Compresses an image File using the Canvas API.
 *
 * @param {File} file - The source image file.
 * @param {object} options
 * @param {number} options.maxSizeBytes  - Target max file size in bytes (default 4.5 MB).
 * @param {number} options.maxWidth      - Max width in pixels (default 2000).
 * @param {number} options.maxHeight     - Max height in pixels (default 2000).
 * @param {number} options.startQuality  - Initial JPEG quality 0–1 (default 0.85).
 * @returns {Promise<File>} Compressed File object (falls back to original if already small enough).
 */
export async function compressImage(file, {
  maxSizeBytes = 4.5 * 1024 * 1024,
  maxWidth = 2000,
  maxHeight = 2000,
  startQuality = 0.85,
} = {}) {
  // Non-image or already small enough — return as-is
  if (!file.type.startsWith('image/') || file.size <= maxSizeBytes) {
    return file;
  }

  const bitmap = await createImageBitmap(file);

  let { width, height } = bitmap;

  // Scale down to fit within maxWidth / maxHeight while preserving aspect ratio
  if (width > maxWidth || height > maxHeight) {
    const scale = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Iteratively lower quality until the blob fits under maxSizeBytes
  let quality = startQuality;
  let blob = null;

  while (quality >= 0.3) {
    blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    if (blob && blob.size <= maxSizeBytes) break;
    quality = Math.round((quality - 0.1) * 10) / 10;
  }

  // If still too large (very edge case), use the smallest attempt anyway
  if (!blob) {
    blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.3)
    );
  }

  const outputName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], outputName, { type: 'image/jpeg' });
}
