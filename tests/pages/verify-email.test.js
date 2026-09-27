import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VerifyEmail from '../../pages/verify-email';
import { resendVerification, verifyEmail } from '../../lib/api/auth';

const push = vi.fn();

vi.mock('next/router', () => ({
  useRouter: () => ({ isReady: true, query: { token: 't' }, push }),
}));

vi.mock('../../lib/api/auth', () => ({
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(verifyEmail).mockReset();
  vi.mocked(resendVerification).mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('VerifyEmail', () => {
  it('verifies the token once and shows success with a link to log in', async () => {
    vi.mocked(verifyEmail).mockResolvedValue({ message: 'ok' });

    render(<VerifyEmail />);

    expect(await screen.findByText('Your email is verified. You can now log in.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to log in' })).toHaveAttribute('href', '/login');
    expect(verifyEmail).toHaveBeenCalledTimes(1);
    expect(verifyEmail).toHaveBeenCalledWith('t');
  });

  it('shows the invalid-link message and resends via the email form on AUTH_TOKEN_INVALID', async () => {
    vi.mocked(verifyEmail).mockRejectedValue({ name: 'ApiProblemError', code: 'AUTH_TOKEN_INVALID', status: 400 });
    vi.mocked(resendVerification).mockResolvedValue({ message: 'ok' });

    render(<VerifyEmail />);

    expect(await screen.findByText('This link is invalid or has expired.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Email'), 'sam@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send a new link' }));

    await waitFor(() => expect(resendVerification).toHaveBeenCalledWith('sam@example.com'));
    expect(await screen.findByText("If an account needs verifying, we've sent a new link.")).toBeInTheDocument();
  });

  it('still shows the generic resend message when the resend call itself fails', async () => {
    vi.mocked(verifyEmail).mockRejectedValue({ name: 'ApiProblemError', code: 'AUTH_TOKEN_INVALID', status: 400 });
    vi.mocked(resendVerification).mockRejectedValue({ name: 'ApiProblemError', code: 'RATE_LIMITED', status: 429 });

    render(<VerifyEmail />);

    expect(await screen.findByText('This link is invalid or has expired.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Email'), 'sam@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send a new link' }));

    expect(await screen.findByText("If an account needs verifying, we've sent a new link.")).toBeInTheDocument();
  });
});
