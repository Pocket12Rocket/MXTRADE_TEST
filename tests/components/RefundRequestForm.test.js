import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import RefundRequestForm, { validateRefund } from '../../components/RefundRequestForm';

vi.mock('next/router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../lib/useAuth', () => ({ default: () => ({ user: { uid: 'u1' }, loading: false }) }));

const BANK = { accountHolder: 'A Buyer', bankName: 'FNB', accountType: 'savings', branchCode: '250655', accountNumber: '62123456789' };
const PHOTO = new File(['a'], 'a.png', { type: 'image/png' });

describe('validateRefund', () => {
  it('requires a type, a reason and every bank field', () => {
    const errors = validateRefund({ type: '', reason: '', bankAccount: {}, images: [] });

    expect(Object.keys(errors).sort()).toEqual([
      'data.bankAccount.accountHolder',
      'data.bankAccount.accountNumber',
      'data.bankAccount.accountType',
      'data.bankAccount.bankName',
      'data.bankAccount.branchCode',
      'data.reason',
      'data.type',
      'images',
    ]);
  });

  it('checks the branch code (6 digits) and account number (6 to 16 digits)', () => {
    const errors = validateRefund({ type: 'damaged', reason: 'Cracked', bankAccount: { ...BANK, branchCode: '12345', accountNumber: '12345' }, images: [PHOTO] });

    expect(Object.keys(errors).sort()).toEqual(['data.bankAccount.accountNumber', 'data.bankAccount.branchCode']);
  });

  it('enforces 20 characters for other and makes photos optional for never_arrived', () => {
    const base = { bankAccount: BANK, images: [] };

    expect(validateRefund({ ...base, type: 'other', reason: 'too short', images: [PHOTO] })['data.reason']).toBe('Describe the issue (at least 20 characters)');
    expect(validateRefund({ ...base, type: 'other', reason: 'x'.repeat(20), images: [PHOTO] })).toEqual({});
    expect(validateRefund({ ...base, type: 'never_arrived', reason: 'Still waiting' })).toEqual({});
    expect(validateRefund({ ...base, type: 'damaged', reason: 'Cracked' }).images).toBeTruthy();
  });
});

describe('RefundRequestForm', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('has no type preselected, shows the bank note and blocks an invalid submit without calling the API', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(<RefundRequestForm orderId="o1" signedInDoneHref="/a" guestDoneHref="/b" />);

    expect(screen.getAllByRole('radio').some((radio) => radio.checked)).toBe(false);
    expect(screen.getByText(/stored securely and used only to pay this refund/)).toBeInTheDocument();

    fireEvent.submit(container.querySelector('form'));

    expect(screen.getByText('Please choose what went wrong.')).toBeInTheDocument();
    expect(screen.getByText('Branch code must be 6 digits.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the 20-character hint and optional photos only for the matching types', () => {
    render(<RefundRequestForm orderId="o1" signedInDoneHref="/a" guestDoneHref="/b" />);

    fireEvent.click(screen.getByLabelText('Other issue'));
    expect(screen.getByText(/at least 20 characters/)).toBeInTheDocument();
    expect(screen.getByText(/Upload images \(required/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Never arrived'));
    expect(screen.queryByText(/at least 20 characters/)).not.toBeInTheDocument();
    expect(screen.getByText(/Upload images \(optional/)).toBeInTheDocument();
  });
});
