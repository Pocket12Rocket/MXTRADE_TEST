import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SellerSubmit from '../../pages/seller/submit';
import { createSubmission } from '../../lib/api/submissions';

const CONFIG = { categories: [{ key: 'gear', label: 'Gear' }] };

vi.mock('../../lib/useAuth', () => ({
  default: () => ({ user: { id: 'u1' }, profile: { canSell: true }, loading: false }),
}));
vi.mock('../../lib/api/catalog', () => ({ fetchCatalogConfig: vi.fn(() => Promise.resolve(CONFIG)) }));
vi.mock('../../lib/api/submissions', () => ({
  createSubmission: vi.fn(),
  toSubmissionInput: vi.fn(() => ({})),
}));
vi.mock('../../lib/listingForm', () => ({
  MAX_LISTING_IMAGES: 5,
  MIN_LISTING_IMAGES: 3,
  describeSubmissionError: vi.fn(() => ({ message: 'failed', fieldErrors: {}, showProfileLink: false })),
  emptyListingForm: vi.fn((category) => ({ category })),
  validateListingForm: vi.fn(() => ({})),
}));
vi.mock('../../lib/useListingImages', () => ({
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
vi.mock('../../components/ImageCropDialog', () => ({ default: () => null }));
vi.mock('../../components/ListingFormFields', () => ({ default: () => null }));

beforeEach(() => {
  createSubmission.mockReset().mockReturnValue(new Promise(() => {}));
});

describe('SellerSubmit double submit', () => {
  it('creates the submission once for two rapid submits', async () => {
    const { container } = render(<SellerSubmit />);
    fireEvent.click(await screen.findByRole('button', { name: 'Gear' }));

    const form = container.querySelector('form');
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(createSubmission).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled());
  });
});
