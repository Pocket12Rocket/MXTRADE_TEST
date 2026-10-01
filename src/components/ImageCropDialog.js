import { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import Dialog from '@mui/material/Dialog';
import Slider from '@mui/material/Slider';
import { cropImageToFile } from '@/lib/cropImage';
import { toUserMessage } from '@/lib/userMessage';
import { useSingleFlight } from '@/lib/useSingleFlight';

/**
 * Why: Lets a user frame each photo at the ratio the storefront displays (4:3 listings, 1:1
 * avatars) before upload, so nothing important is cut off.
 * @param {Object} props - Dialog props.
 * @param {File|null} props.file - Image to crop; the dialog is open while this is set.
 * @param {number} props.aspect - Crop width / height ratio (see `lib/cropImage.js` constants).
 * @param {number} props.maxWidth - Maximum output width in pixels.
 * @param {'rect'|'round'} [props.cropShape='rect'] - Visual crop mask (round for avatars).
 * @param {string} [props.title='Crop photo'] - Dialog heading.
 * @param {string} [props.progressLabel] - Optional "2 of 4" style label for queued crops.
 * @param {(file: File) => void} props.onConfirm - Receives the cropped file.
 * @param {() => void} props.onSkip - Called when the user discards this photo.
 * @returns {JSX.Element} The crop dialog.
 * @example
 * <ImageCropDialog
 *   file={currentFile}
 *   aspect={LISTING_IMAGE_ASPECT}
 *   maxWidth={LISTING_IMAGE_OUTPUT_WIDTH}
 *   onConfirm={handleCropped}
 *   onSkip={handleSkip}
 * />
 */
export default function ImageCropDialog({
  file,
  aspect,
  maxWidth,
  cropShape = 'rect',
  title = 'Crop photo',
  progressLabel = '',
  onConfirm,
  onSkip,
}) {
  const [imageUrl, setImageUrl] = useState('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState(null);
  const { run, pending: saving } = useSingleFlight();
  const [error, setError] = useState('');

  // Why: Each new file gets a fresh object URL and reset crop state; the URL is revoked when
  // the file changes or the dialog unmounts so previews don't leak memory.
  useEffect(() => {
    if (!file) {
      setImageUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAreaPixels(null);
    setError('');
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleCropComplete = useCallback((_area, pixels) => {
    setAreaPixels(pixels);
  }, []);

  /**
   * Why: Renders the chosen crop to a file and hands it to the caller; errors (e.g. an image
   * format the browser can't decode, such as HEIC on some desktops) are shown in the dialog.
   * @returns {Promise<void>}
   */
  const handleConfirm = async () => {
    if (!file || !areaPixels) return;
    setError('');
    try {
      await run(async () => {
        const cropped = await cropImageToFile(file, areaPixels, { aspect, maxWidth });
        onConfirm(cropped);
      });
    } catch (err) {
      setError(toUserMessage(err, "We couldn't crop this photo. Please try a JPG or PNG image."));
    }
  };

  return (
    <Dialog open={Boolean(file)} onClose={saving ? undefined : onSkip} fullWidth maxWidth="sm">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {progressLabel ? <p className="text-xs text-slate-500">{progressLabel}</p> : null}
        </div>

        <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-slate-900 sm:h-96">
          {imageUrl ? (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={cropShape}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={handleCropComplete}
            />
          ) : null}
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Zoom</span>
          <Slider
            value={zoom}
            min={1}
            max={3}
            step={0.05}
            onChange={(_event, value) => setZoom(Number(value))}
            aria-label="Zoom"
          />
        </label>

        <p className="text-xs text-slate-500">
          Drag to position the photo. This is how it will appear in the shop.
        </p>

        {error ? (
          <p className="text-sm text-rose-700" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onSkip}
            disabled={saving}
            className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            Skip photo
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || !areaPixels}
            className="rounded-full bg-[#00CED1] px-5 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Use photo'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
