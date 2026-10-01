import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import RefundRequestForm, { validateRefund } from '../../components/RefundRequestForm';
import { requestRefund } from '../../lib/api/orders';

const routerState = { push: vi.fn(), query: {} };
vi.mock('next/router', () => ({ useRouter: () => routerState }));
vi.mock('../../lib/api/orders', async (importOriginal) => ({ ...(await importOriginal()), requestRefund: vi.fn() }));
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

  it('uses the exact messages for an empty reason and a short other reason, trimming first', () => {
    const base = { bankAccount: BANK, images: [PHOTO] };

    expect(validateRefund({ ...base, type: 'damaged', reason: '' })['data.reason']).toBe('Describe the problem.');
    expect(validateRefund({ ...base, type: 'damaged', reason: '   ' })['data.reason']).toBe('Describe the problem.');
    expect(validateRefund({ ...base, type: 'other', reason: `${'x'.repeat(10)}          ` })['data.reason']).toBe('Describe the issue (at least 20 characters)');
  });

  it('mirrors the bank field length limits', () => {
    const errors = validateRefund({
      type: 'damaged',
      reason: 'Cracked',
      bankAccount: { ...BANK, accountHolder: 'x'.repeat(101), bankName: 'y'.repeat(61) },
      images: [PHOTO],
    });

    expect(Object.keys(errors).sort()).toEqual(['data.bankAccount.accountHolder', 'data.bankAccount.bankName']);
    expect(validateRefund({ type: 'damaged', reason: 'Cracked', bankAccount: { ...BANK, accountHolder: 'x'.repeat(100), bankName: 'y'.repeat(60) }, images: [PHOTO] })).toEqual({});
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
  afterEach(() => {
    vi.unstubAllGlobals();
    routerState.query = {};
  });

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

  it('sends the refund request once for two rapid submits', () => {
    routerState.query = { type: 'never_arrived' };
    vi.mocked(requestRefund).mockReturnValue(new Promise(() => {}));
    const { container } = render(<RefundRequestForm orderId="o1" signedInDoneHref="/a" guestDoneHref="/b" />);

    fireEvent.change(screen.getByLabelText('Describe the issue'), { target: { value: 'Still waiting' } });
    fireEvent.change(screen.getByLabelText('Account holder'), { target: { value: BANK.accountHolder } });
    fireEvent.change(screen.getByLabelText('Bank name'), { target: { value: BANK.bankName } });
    fireEvent.change(screen.getByLabelText('Account type'), { target: { value: BANK.accountType } });
    fireEvent.change(screen.getByLabelText('Branch code (6 digits)'), { target: { value: BANK.branchCode } });
    fireEvent.change(screen.getByLabelText('Account number (6 to 16 digits)'), { target: { value: BANK.accountNumber } });

    const form = container.querySelector('form');
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(requestRefund).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Submitting...' })).toBeDisabled();
  });

  it('offers only the problem types, without never_arrived', () => {
    render(<RefundRequestForm orderId="o1" signedInDoneHref="/a" guestDoneHref="/b" />);

    expect(screen.getAllByRole('radio').map((radio) => radio.value)).toEqual(['damaged', 'not_as_described', 'other']);
    expect(screen.queryByLabelText('Never arrived')).not.toBeInTheDocument();
  });

  it('shows the 20-character hint and required photos for other', () => {
    render(<RefundRequestForm orderId="o1" signedInDoneHref="/a" guestDoneHref="/b" />);

    fireEvent.click(screen.getByLabelText('Other issue'));
    expect(screen.getByText(/at least 20 characters/)).toBeInTheDocument();
    expect(screen.getByText(/Upload images \(required/)).toBeInTheDocument();
  });

  it('preselects never_arrived from ?type=never_arrived, with optional photos', () => {
    routerState.query = { type: 'never_arrived' };
    render(<RefundRequestForm orderId="o1" signedInDoneHref="/a" guestDoneHref="/b" />);

    expect(screen.getByLabelText('Never arrived')).toBeChecked();
    expect(screen.queryByText(/at least 20 characters/)).not.toBeInTheDocument();
    expect(screen.getByText(/Upload images \(optional/)).toBeInTheDocument();
  });
});
