import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Login from '../../pages/login';
import { login } from '../../lib/api/auth';

const push = vi.fn();

vi.mock('next/router', () => ({ useRouter: () => ({ isReady: true, query: {}, push }) }));
vi.mock('../../lib/AuthContext', () => ({ useAuthContext: () => ({ setSignedInUser: vi.fn() }) }));
vi.mock('../../lib/api/auth', () => ({
  forgotPassword: vi.fn(),
  getGoogleSignInUrl: vi.fn(() => 'http://api/google'),
  login: vi.fn(),
  register: vi.fn(),
  resendVerification: vi.fn(),
}));

beforeEach(() => {
  login.mockReset().mockResolvedValue({ id: 'u1' });
  push.mockReset().mockReturnValue(new Promise(() => {}));
});

describe('Login double submit', () => {
  it('logs in once for two rapid submits and stays locked while redirecting', () => {
    const { container } = render(<Login />);
    const inputs = container.querySelectorAll('input');
    fireEvent.change(inputs[0], { target: { value: 'sam@example.com' } });
    fireEvent.change(inputs[1], { target: { value: 'secret-pass' } });

    const form = container.querySelector('form');
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(login).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled();
  });
});
