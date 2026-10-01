import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithQueryClient } from '@/test/renderWithQueryClient';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SellerSubmit from './SellerSubmitPage';
import { createSubmission } from '@/lib/api/submissions';

const CONFIG = { categories: [{ key: 'gear', label: 'Gear' }] };

vi.mock('@/lib/useAuth', () => ({
  default: () => ({ user: { id: 'u1' }, profile: { canSell: true }, loading: false }),
}));
vi.mock('@/lib/api/catalog', () => ({ fetchCatalogConfig: vi.fn(() => Promise.resolve(CONFIG)) }));
vi.mock('@/lib/api/submissions', () => ({
  createSubmission: vi.fn(),
  toSubmissionInput: vi.fn(() => ({})),
}));
vi.mock('@/lib/listingForm', () => ({
  MAX_LISTING_IMAGES: 5,
  MIN_LISTING_IMAGES: 3,
  describeSubmissionError: vi.fn(() => ({
    message: 'failed',
    fieldErrors: {},
    showProfileLink: false,
  })),
  emptyListingForm: vi.fn((category) => ({ category })),
  validateListingForm: vi.fn(() => ({})),
}));
vi.mock('./useListingImages', () => ({
  useListingImages: () => ({
    files: [],
    previews: [],
    total: 3,
    notice: '',
    reset: vi.fn(),
    removeFile: vi.fn(),
    handleFilesChange: vi.fn(),
    cropQueue: { currentFile: null, progressLabel: '', confirm: vi.fn(), skip: vi.fn() },
  }),
}));
vi.mock('@/components/ImageCropDialog', () => ({ default: () => null }));
vi.mock('./ListingFormFields', () => ({ default: () => null }));

beforeEach(() => {
  vi.mocked(createSubmission)
    .mockReset()
    .mockReturnValue(new Promise(() => {}));
});

describe('SellerSubmit double submit', () => {
  it('creates the submission once for two rapid submits', async () => {
    const { container } = renderWithQueryClient(<SellerSubmit />);
    fireEvent.click(await screen.findByRole('button', { name: 'Gear' }));

    const form = container.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => expect(createSubmission).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled());
  });
});
