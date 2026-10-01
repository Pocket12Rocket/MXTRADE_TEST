import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import ImageCropDialog from './ImageCropDialog';
import { cropImageToFile } from '@/lib/cropImage';

// Why: react-easy-crop measures real image/layout sizes that jsdom doesn't provide; the stub
// reports a fixed crop area so the dialog's own logic can be tested.
vi.mock('react-easy-crop', async () => {
  const { useEffect } = await import('react');
  return {
    default: function CropperStub({ onCropComplete, aspect }) {
      // Why: report once on mount; reporting on every render would loop, because the dialog
      // stores the area in state and re-renders.
      useEffect(() => {
        onCropComplete({}, { x: 0, y: 0, width: 400, height: 300 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <div data-testid="cropper" data-aspect={aspect} />;
    },
  };
});

vi.mock('@/lib/cropImage', async (importOriginal) => ({
  ...(await importOriginal()),
  cropImageToFile: vi.fn(),
}));

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

beforeEach(() => {
  vi.mocked(cropImageToFile).mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const file = new File(['x'], 'helmet.png', { type: 'image/png' });

describe('ImageCropDialog', () => {
  it('passes the cropped file to onConfirm', async () => {
    const cropped = new File(['y'], 'helmet.webp', { type: 'image/webp' });
    vi.mocked(cropImageToFile).mockResolvedValue(cropped);
    const onConfirm = vi.fn();

    render(
      <ImageCropDialog
        file={file}
        aspect={4 / 3}
        maxWidth={1600}
        progressLabel="1 of 3"
        onConfirm={onConfirm}
        onSkip={vi.fn()}
      />,
    );

    expect(screen.getByText('1 of 3')).toBeInTheDocument();
    expect(screen.getByTestId('cropper')).toHaveAttribute('data-aspect', String(4 / 3));
    const useButton = screen.getByRole('button', { name: 'Use photo' });
    await waitFor(() => expect(useButton).toBeEnabled());
    await userEvent.click(useButton);

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(cropped));
    expect(cropImageToFile).toHaveBeenCalledWith(
      file,
      { x: 0, y: 0, width: 400, height: 300 },
      { aspect: 4 / 3, maxWidth: 1600 },
    );
  });

  it('shows a friendly error when cropping fails', async () => {
    vi.mocked(cropImageToFile).mockRejectedValue(new Error('decode failed'));
    const onConfirm = vi.fn();

    render(
      <ImageCropDialog
        file={file}
        aspect={1}
        maxWidth={512}
        onConfirm={onConfirm}
        onSkip={vi.fn()}
      />,
    );
    const useButton = screen.getByRole('button', { name: 'Use photo' });
    await waitFor(() => expect(useButton).toBeEnabled());
    await userEvent.click(useButton);

    expect(await screen.findByRole('alert')).toHaveTextContent('crop this photo');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onSkip from the skip button and closes without a file', async () => {
    const onSkip = vi.fn();
    const { rerender } = render(
      <ImageCropDialog file={file} aspect={1} maxWidth={512} onConfirm={vi.fn()} onSkip={onSkip} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Skip photo' }));
    expect(onSkip).toHaveBeenCalled();

    rerender(
      <ImageCropDialog file={null} aspect={1} maxWidth={512} onConfirm={vi.fn()} onSkip={onSkip} />,
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Use photo' })).not.toBeInTheDocument(),
    );
  });
});
