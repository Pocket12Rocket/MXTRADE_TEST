import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResetPassword from './ResetPasswordPage';
import { resetPassword } from '@/lib/api/auth';

const push = vi.fn();

vi.mock('next/router', () => ({
  useRouter: () => ({ isReady: true, query: { token: 't' }, push }),
}));

vi.mock('@/lib/api/auth', () => ({
  resetPassword: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(resetPassword).mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ResetPassword', () => {
  it('resets the password and shows the signed-out-everywhere confirmation', async () => {
    vi.mocked(resetPassword).mockResolvedValue({ message: 'ok' });

    render(<ResetPassword />);

    await userEvent.type(screen.getByLabelText('New password'), 'newSecret123');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'newSecret123');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith('t', 'newSecret123'));
    expect(
      await screen.findByText(/Password updated\. You.ve been signed out on all devices/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to log in' })).toHaveAttribute('href', '/login');
  });

  it('shows the invalid-link message on AUTH_TOKEN_INVALID', async () => {
    vi.mocked(resetPassword).mockRejectedValue({
      name: 'ApiProblemError',
      code: 'AUTH_TOKEN_INVALID',
      status: 400,
    });

    render(<ResetPassword />);

    await userEvent.type(screen.getByLabelText('New password'), 'newSecret123');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'newSecret123');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(
      await screen.findByText('This reset link is invalid or has expired.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'the log in page' })).toHaveAttribute('href', '/login');
  });

  it('blocks submission client-side when the passwords do not match, without calling the backend', async () => {
    render(<ResetPassword />);

    await userEvent.type(screen.getByLabelText('New password'), 'newSecret123');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'somethingElse1');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('blocks submission client-side when the password is too short', async () => {
    render(<ResetPassword />);

    await userEvent.type(screen.getByLabelText('New password'), 'short1');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'short1');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByText('Password must be 8-128 characters.')).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });
});
