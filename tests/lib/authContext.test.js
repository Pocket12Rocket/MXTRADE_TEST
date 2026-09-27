import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuthContext } from '../../lib/AuthContext';
import { getMe, logout } from '../../lib/api/auth';

vi.mock('../../lib/api/auth', () => ({
  getMe: vi.fn(),
  logout: vi.fn(),
}));

let context;

/**
 * Why: Captures the live context value so tests can call its actions.
 * @returns {JSX.Element} The signed-in email or "signed out".
 */
function Probe() {
  context = useAuthContext();
  if (context.loading) return <p>loading</p>;
  return <p>{context.user ? `${context.user.id}:${context.user.email}` : 'signed out'}</p>;
}

beforeEach(() => {
  vi.mocked(getMe).mockReset();
  vi.mocked(logout).mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('AuthProvider', () => {
  it('loads the session from /me and exposes user + profile', async () => {
    vi.mocked(getMe).mockResolvedValue({ id: 'u1', email: 'a@b.co', emailVerified: true, role: 'customer' });

    render(<AuthProvider><Probe /></AuthProvider>);

    expect(await screen.findByText('u1:a@b.co')).toBeInTheDocument();
    expect(context.profile.role).toBe('customer');
    expect(getMe).toHaveBeenCalledTimes(1);
  });

  it('treats a failed session probe as signed out', async () => {
    vi.mocked(getMe).mockRejectedValue(new TypeError('Failed to fetch'));

    render(<AuthProvider><Probe /></AuthProvider>);

    expect(await screen.findByText('signed out')).toBeInTheDocument();
  });

  it('signOut clears the user even if the logout call fails', async () => {
    vi.mocked(getMe).mockResolvedValue({ id: 'u1', email: 'a@b.co' });
    vi.mocked(logout).mockRejectedValue(new TypeError('Failed to fetch'));
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText('u1:a@b.co');

    await act(() => context.signOut());

    expect(screen.getByText('signed out')).toBeInTheDocument();
  });

  it('setSignedInUser stores a login response without another /me call', async () => {
    vi.mocked(getMe).mockResolvedValue(null);
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText('signed out');

    act(() => context.setSignedInUser({ id: 'u2', email: 'c@d.co' }));

    await waitFor(() => expect(screen.getByText('u2:c@d.co')).toBeInTheDocument());
    expect(getMe).toHaveBeenCalledTimes(1);
  });
});
