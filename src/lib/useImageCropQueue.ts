import { useCallback, useState } from 'react';

/** The queue controls returned by `useImageCropQueue`. */
export interface ImageCropQueue {
  enqueue: (files: Iterable<File> | ArrayLike<File> | null | undefined) => void;
  currentFile: File | null;
  progressLabel: string;
  confirm: (file: File) => void;
  skip: () => void;
}

/**
 * Why: Sellers pick several photos at once, but each needs its own crop. This hook queues the
 * picked files and exposes the current one to `ImageCropDialog`, so every upload call site
 * (new listing, edit listing, avatar) shares one crop flow instead of re-implementing a queue.
 * @param onCropped - Called with each cropped file, in pick order.
 * @returns Queue controls; spread `currentFile`/`progressLabel` and wire `confirm`/`skip` into
 *   `ImageCropDialog`'s `file`/`progressLabel`/`onConfirm`/`onSkip`.
 * @example
 * const cropQueue = useImageCropQueue((file) => setFiles((prev) => [...prev, file]));
 * // <input type="file" onChange={(e) => cropQueue.enqueue(Array.from(e.target.files))} />
 * // <ImageCropDialog file={cropQueue.currentFile} progressLabel={cropQueue.progressLabel}
 * //   onConfirm={cropQueue.confirm} onSkip={cropQueue.skip} ... />
 */
export function useImageCropQueue(onCropped: (file: File) => void): ImageCropQueue {
  // Why: queue and batch size live in one state object so each update is a single pure
  // updater (React Strict Mode double-invokes updaters, which would double-count otherwise).
  const [state, setState] = useState<{ queue: File[]; batchSize: number }>({
    queue: [],
    batchSize: 0,
  });
  const { queue, batchSize } = state;

  const enqueue = useCallback((files: Iterable<File> | ArrayLike<File> | null | undefined) => {
    const images = Array.from(files || []).filter(
      (file) => file && String(file.type).startsWith('image/'),
    );
    if (images.length === 0) return;
    setState((prev) => ({
      queue: [...prev.queue, ...images],
      // Why: a new pick while the queue is empty starts a new "1 of N" count.
      batchSize: prev.queue.length === 0 ? images.length : prev.batchSize + images.length,
    }));
  }, []);

  const advance = useCallback(() => {
    setState((prev) => ({ ...prev, queue: prev.queue.slice(1) }));
  }, []);

  const confirm = useCallback(
    (file: File) => {
      onCropped(file);
      advance();
    },
    [onCropped, advance],
  );

  const currentFile = queue[0] ?? null;
  const position = batchSize - queue.length + 1;
  const progressLabel = currentFile && batchSize > 1 ? `${position} of ${batchSize}` : '';

  return { enqueue, currentFile, progressLabel, confirm, skip: advance };
}
