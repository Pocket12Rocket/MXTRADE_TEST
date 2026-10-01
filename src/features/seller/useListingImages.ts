import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useImageCropQueue, type ImageCropQueue } from '@/lib/useImageCropQueue';
import type { SellerListingImage } from '@/lib/api/submissions';
import { MAX_LISTING_IMAGES, mergeUniqueFiles } from '@/lib/listingForm';

interface ListingImagesState {
  kept: SellerListingImage[];
  files: File[];
  notice: string;
}

/** What `useListingImages` returns. */
export interface ListingImages {
  kept: SellerListingImage[];
  files: File[];
  notice: string;
  previews: Array<{ id: string; name: string; previewUrl: string }>;
  total: number;
  keepImageIds: string[];
  cropQueue: ImageCropQueue;
  handleFilesChange: (event: ChangeEvent<HTMLInputElement>) => void;
  removeKept: (index: number) => void;
  removeFile: (index: number) => void;
  reset: (kept?: SellerListingImage[]) => void;
}

/**
 * Why: The seller submit page and the edit dialog on the submissions page both manage the same
 * listing photos: existing images to keep (edits only), new cropped files, previews, the 5-image
 * cap and the 4:3 crop queue. One hook keeps that logic in one place.
 * @returns Image state and handlers. Spread `cropQueue` into `ImageCropDialog`; upload `files`; send
 *   `keepImageIds` with edits; `notice` is a message when the cap trimmed a photo.
 * @example
 * const images = useListingImages();
 * // <input type="file" multiple onChange={images.handleFilesChange} />
 * // createSubmission({ input, files: images.files });
 */
export function useListingImages(): ListingImages {
  const [state, setState] = useState<ListingImagesState>({ kept: [], files: [], notice: '' });

  /**
   * Why: Adds one cropped photo, enforcing the 5-image cap after cropping (kept plus new) so a
   * skipped photo does not count against the seller.
   * @param croppedFile - The cropped image from `ImageCropDialog`.
   * @example
   * useImageCropQueue(handleCropped);
   */
  const handleCropped = useCallback((croppedFile: File) => {
    setState((prev) => {
      const merged = mergeUniqueFiles(prev.files, [croppedFile]);
      const room = Math.max(0, MAX_LISTING_IMAGES - prev.kept.length);

      if (merged.length > room) {
        return {
          ...prev,
          files: merged.slice(0, room),
          notice: `You can upload a maximum of ${MAX_LISTING_IMAGES} images per listing.`,
        };
      }
      return { ...prev, files: merged, notice: '' };
    });
  }, []);

  const cropQueue = useImageCropQueue(handleCropped);

  const previews = useMemo(() => {
    if (typeof window === 'undefined') {
      return [];
    }
    return state.files.map((file, index) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
    }));
  }, [state.files]);

  useEffect(() => {
    return () => {
      previews.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [previews]);

  /**
   * Why: Every picked photo goes through the 4:3 cropper first so it matches the storefront cards.
   * @param event - The file input change event.
   * @example
   * <input type="file" multiple onChange={images.handleFilesChange} />
   */
  const handleFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    cropQueue.enqueue(Array.from(event.target.files || []));
    // Allow selecting the same file again in a later pick.
    event.target.value = '';
  };

  /**
   * Why: Lets the seller drop an existing photo from an edit.
   * @param index - Position in `kept`.
   * @example
   * images.removeKept(0);
   */
  const removeKept = (index: number) => {
    setState((prev) => ({
      ...prev,
      kept: prev.kept.filter((_, itemIndex) => itemIndex !== index),
      notice: '',
    }));
  };

  /**
   * Why: Lets the seller drop a newly added photo before submitting.
   * @param index - Position in `files`.
   * @example
   * images.removeFile(2);
   */
  const removeFile = (index: number) => {
    setState((prev) => ({
      ...prev,
      files: prev.files.filter((_, itemIndex) => itemIndex !== index),
      notice: '',
    }));
  };

  /**
   * Why: Clears the new files and sets which existing photos an edit starts with (none for a new
   * listing), for example after a successful submit or when the edit dialog opens.
   * @param kept - Existing images to keep.
   * @example
   * images.reset(listing.imageItems);
   */
  const reset = useCallback((kept: SellerListingImage[] = []) => {
    setState({ kept, files: [], notice: '' });
  }, []);

  return {
    kept: state.kept,
    files: state.files,
    notice: state.notice,
    previews,
    total: state.kept.length + state.files.length,
    // An image only lacks an id in list views; the edit flows load full details, where it is set.
    keepImageIds: state.kept.map((image) => image.id) as string[],
    cropQueue,
    handleFilesChange,
    removeKept,
    removeFile,
    reset,
  };
}
