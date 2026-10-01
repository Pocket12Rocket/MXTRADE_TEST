import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PrivateImage from './PrivateImage';

// Why: API_BASE_URL is empty in tests, so API URLs are same-origin with the jsdom page.
const URL_A = `${window.location.origin}/files/private/a`;

describe('PrivateImage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders the plain URL without fetching when there is no token', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<PrivateImage url={URL_A} alt="Photo" />);

    expect(screen.getByAltText('Photo')).toHaveAttribute('src', URL_A);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches with the token, shows a blob URL and revokes it on unmount', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      blob: async () => new Blob(['x']),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const create = vi.fn(() => 'blob:one');
    const revoke = vi.fn();
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;

    const { unmount } = render(<PrivateImage url={URL_A} token="tok" alt="Photo" />);

    await waitFor(() => expect(screen.getByAltText('Photo')).toHaveAttribute('src', 'blob:one'));
    expect(fetchMock.mock.calls[0][1].headers['X-Order-Token']).toBe('tok');
    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:one');
  });

  it('revokes the old object URL when the url changes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, blob: async () => new Blob(['x']) })),
    );
    let n = 0;
    URL.createObjectURL = vi.fn(() => `blob:${++n}`);
    const revoke = vi.fn();
    URL.revokeObjectURL = revoke;

    const { rerender } = render(<PrivateImage url={URL_A} token="tok" alt="Photo" />);
    await waitFor(() => expect(screen.getByAltText('Photo')).toHaveAttribute('src', 'blob:1'));
    rerender(<PrivateImage url={`${URL_A}2`} token="tok" alt="Photo" />);

    await waitFor(() => expect(screen.getByAltText('Photo')).toHaveAttribute('src', 'blob:2'));
    expect(revoke).toHaveBeenCalledWith('blob:1');
  });

  it('shows a placeholder when the fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('no', { status: 403 })),
    );

    render(<PrivateImage url={URL_A} token="bad" alt="Photo" />);

    expect(await screen.findByText('Photo unavailable')).toBeInTheDocument();
  });
});
