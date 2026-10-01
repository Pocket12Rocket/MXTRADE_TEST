import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Login from './LoginPage';
import { login, register } from '@/lib/api/auth';
import type { Me } from '@/lib/api/types';

const push = vi.fn();

vi.mock('next/router', () => ({ useRouter: () => ({ isReady: true, query: {}, push }) }));
vi.mock('@/lib/AuthContext', () => ({ useAuthContext: () => ({ setSignedInUser: vi.fn() }) }));
vi.mock('@/lib/api/auth', () => ({
  forgotPassword: vi.fn(),
  getGoogleSignInUrl: vi.fn(() => 'http://api/google'),
  login: vi.fn(),
  register: vi.fn(),
  resendVerification: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(login)
    .mockReset()
    .mockResolvedValue({ id: 'u1' } as Me);
  push.mockReset().mockReturnValue(new Promise(() => {}));
});

describe('Login double submit', () => {
  it('logs in once for two rapid submits and stays locked while redirecting', () => {
    const { container } = render(<Login />);
    const inputs = container.querySelectorAll('input');
    fireEvent.change(inputs[0]!, { target: { value: 'sam@example.com' } });
    fireEvent.change(inputs[1]!, { target: { value: 'secret-pass' } });

    const form = container.querySelector('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(login).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled();
  });
});

describe('Login register', () => {
  it('registers straight away without a terms step or acceptTerms', async () => {
    vi.mocked(register).mockReset().mockResolvedValue({ message: 'ok' });
    const { container } = render(<Login />);
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    const inputs = container.querySelectorAll('input');
    fireEvent.change(inputs[0]!, { target: { value: 'sam@example.com' } });
    fireEvent.change(inputs[1]!, { target: { value: 'secret-pass' } });
    fireEvent.change(inputs[2]!, { target: { value: 'secret-pass' } });
    fireEvent.change(inputs[3]!, { target: { value: 'Sam' } });
    fireEvent.change(inputs[4]!, { target: { value: 'Rider' } });
    fireEvent.submit(container.querySelector('form')!);

    expect(register).toHaveBeenCalledTimes(1);
    expect(vi.mocked(register).mock.calls[0]![0]).not.toHaveProperty('acceptTerms');
    expect(await screen.findByText(/Check your email/i)).toBeInTheDocument();
    expect(screen.queryByText(/I agree and create profile/i)).not.toBeInTheDocument();
  });
});
