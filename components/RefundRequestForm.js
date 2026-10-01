import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import useAuth from '../lib/useAuth';
import {
  REFUND_IMAGE_TYPES,
  REFUND_MAX_IMAGE_BYTES,
  NOT_ARRIVED_TYPE,
  REFUND_MAX_REASON_LENGTH,
  REFUND_PROBLEM_TYPES,
  REFUND_TYPES,
  getOrderToken,
  getRefundRules,
  requestRefund,
} from '../lib/api/orders';
import { ACCOUNT_TYPE_OPTIONS } from '../lib/api/seller';
import { getFieldErrors } from '../lib/apiClient';
import { toUserMessage } from '../lib/userMessage';

/**
 * Why: Buyers often type bank numbers with spaces or dashes; strip them once, so validation and
 * the request use the same digits.
 * @param {string} [value] - Raw input.
 * @returns {string} The value with whitespace and dashes removed.
 * @example
 * stripDigitSeparators('1234 5678-90'); // '1234567890'
 */
function stripDigitSeparators(value) {
  return String(value || '').replace(/[\s-]/g, '');
}

const EMPTY_BANK_ACCOUNT = { accountHolder: '', bankName: '', accountType: '', branchCode: '', accountNumber: '' };

// Why: Free-text bank detail fields in display order, so the inputs and their validation come from one list.
const BANK_FIELDS = [
  { key: 'accountHolder', label: 'Account holder', maxLength: 100 },
  { key: 'bankName', label: 'Bank name', maxLength: 60 },
];

/**
 * Why: Validates the form before upload with the backend's rules, returning errors keyed by the
 * backend's 422 paths so client and server messages render in the same places.
 * @param {{type: string, reason: string, bankAccount: object, images: File[]}} values - Form values.
 * @returns {Object<string, string>} Message per field path; empty when the form is valid.
 * @example
 * validateRefund({ type: '', reason: '', bankAccount: {}, images: [] })['data.type']; // 'Please choose what went wrong.'
 */
export function validateRefund({ type, reason, bankAccount, images }) {
  const errors = {};
  const rules = getRefundRules(type);
  const trimmedReason = String(reason || '').trim();
  if (!type) errors['data.type'] = 'Please choose what went wrong.';
  if (trimmedReason.length < 1) errors['data.reason'] = 'Describe the problem.';
  else if (trimmedReason.length < rules.minReasonLength) errors['data.reason'] = `Describe the issue (at least ${rules.minReasonLength} characters)`;
  else if (trimmedReason.length > REFUND_MAX_REASON_LENGTH) errors['data.reason'] = `Please keep this to ${REFUND_MAX_REASON_LENGTH} characters or fewer.`;
  BANK_FIELDS.forEach(({ key, label, maxLength }) => {
    const value = String(bankAccount[key] || '').trim();
    if (!value) errors[`data.bankAccount.${key}`] = `${label} is required.`;
    else if (value.length > maxLength) errors[`data.bankAccount.${key}`] = `${label} must be ${maxLength} characters or fewer.`;
  });
  if (!bankAccount.accountType) errors['data.bankAccount.accountType'] = 'Please choose an account type.';
  // Why: validate the same normalised values that are sent (spaces and dashes stripped), so
  // "1234 5678 90" isn't rejected here when the backend would accept it.
  if (!/^\d{6}$/.test(stripDigitSeparators(bankAccount.branchCode))) errors['data.bankAccount.branchCode'] = 'Branch code must be 6 digits.';
  if (!/^\d{6,16}$/.test(stripDigitSeparators(bankAccount.accountNumber))) errors['data.bankAccount.accountNumber'] = 'Account number must be 6 to 16 digits.';
  if (images.length < rules.minImages) errors.images = 'Please add at least one photo of the problem.';
  else if (images.length > rules.maxImages) errors.images = `You can upload up to ${rules.maxImages} photos. Please remove some.`;
  else if (images.some((file) => !REFUND_IMAGE_TYPES.includes(file.type))) errors.images = 'Photos must be JPEG, PNG or WebP images.';
  else if (images.some((file) => file.size > REFUND_MAX_IMAGE_BYTES)) errors.images = 'Each photo must be 10 MB or smaller.';
  return errors;
}

/**
 * Why: Refund request form (`POST /orders/{id}/refund-request`) shared by the signed-in and guest
 * return pages. It opens with `?type=never_arrived` preselected when coming from "Report not
 * arrived"; guests are authorised by their stored order token.
 * @param {object} props - Component props.
 * @param {string} props.orderId - Order UUID.
 * @param {string} props.signedInDoneHref - Where a signed-in buyer goes after success.
 * @param {string} props.guestDoneHref - Where a token-only guest goes after success.
 * @returns {JSX.Element} The refund form, a sign-in prompt, or the success message.
 * @example
 * <RefundRequestForm orderId={orderId} signedInDoneHref="/profile/orders" guestDoneHref={`/order/${orderId}`} />
 */
export default function RefundRequestForm({ orderId, signedInDoneHref, guestDoneHref }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [chosenType, setType] = useState('');
  // Why: the query is read at render, not in initial state, because `router.query` can still be
  // empty on the first render of a statically optimised page.
  const fromNotArrivedLink = router.query?.type === NOT_ARRIVED_TYPE;
  const type = chosenType || (fromNotArrivedLink ? NOT_ARRIVED_TYPE : '');
  const typeOptions = fromNotArrivedLink ? REFUND_TYPES : REFUND_PROBLEM_TYPES;
  const [reason, setReason] = useState('');
  const [bankAccount, setBankAccount] = useState(EMPTY_BANK_ACCOUNT);
  const [fieldErrors, setFieldErrors] = useState({});
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const rules = getRefundRules(type);
  const setBankField = (key, value) => setBankAccount((prev) => ({ ...prev, [key]: value }));
  // Why: shows the message for a field path (and `images.N` under the photos) in one place.
  const fieldError = (path) => {
    const message = fieldErrors[path]
      || (path === 'images' ? Object.entries(fieldErrors).find(([key]) => key.startsWith('images.'))?.[1] : '');
    return message ? <p className="mt-1 text-sm text-red-600">{message}</p> : null;
  };

  const handleImageChange = (e) => {
    const incomingFiles = Array.from(e.target.files || []);

    setImages((prev) => {
      const seen = new Set((prev || []).map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const merged = [...(prev || [])];

      incomingFiles.forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(file);
        }
      });

      return merged;
    });

    // Allow selecting the same file again in a later pick.
    e.target.value = '';
  };

  const imagePreviews = useMemo(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    return images.map((file, index) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
    }));
  }, [images]);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [imagePreviews]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const cleanBank = {
      ...Object.fromEntries(Object.entries(bankAccount).map(([key, value]) => [key, value.trim()])),
      accountNumber: stripDigitSeparators(bankAccount.accountNumber),
    };
    const values = { type, reason: reason.trim(), bankAccount: cleanBank, images };
    const errors = validateRefund(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSubmitting(true);
    try {
      await requestRefund(orderId, { type, reason: values.reason, bankAccount: cleanBank, files: images }, getOrderToken(orderId));
      setSuccess(true);
      setTimeout(() => router.push(user ? signedInDoneHref : guestDoneHref), 2000);
    } catch (err) {
      // 422 paths map to the fields; anything else (409 codes, 413, ...) goes through toUserMessage.
      const serverErrors = getFieldErrors(err);
      setFieldErrors(serverErrors);
      if (Object.keys(serverErrors).length === 0) {
        setError(toUserMessage(err, "We couldn't submit your refund request. Please try again."));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center min-h-[40vh]"><p>Loading...</p></div>;
  if (!user && !getOrderToken(orderId)) {
    return (
      <div className="max-w-md mx-auto mt-16 p-8 rounded-3xl border border-slate-200 bg-white shadow-sm text-center">
        <h1 className="text-2xl font-semibold mb-4">Sign in to request a return</h1>
        <p className="mb-6 text-slate-600">Please log in to submit a return request.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto mt-16 p-8 rounded-3xl border border-slate-200 bg-white shadow-sm text-center">
        <h1 className="text-2xl font-semibold mb-4">Refund request submitted!</h1>
        <p className="mb-6 text-slate-600">Your refund request has been sent to the admin team. You will be notified by email once reviewed.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto mt-8 p-6 rounded-3xl border border-slate-200 bg-white shadow-sm">
      <h1 className="text-2xl font-semibold mb-6">Submit Refund Request</h1>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset>
          <legend className="block text-sm font-medium text-slate-700 mb-1">What went wrong?</legend>
          {typeOptions.map((option) => (
            <label key={option.value} className="flex items-center gap-2 py-1 text-sm text-slate-700">
              <input
                type="radio"
                name="refundType"
                value={option.value}
                checked={type === option.value}
                onChange={() => setType(option.value)}
              />
              {option.label}
            </label>
          ))}
          {fieldError('data.type')}
        </fieldset>
        <div>
          <label htmlFor="refund-reason" className="block text-sm font-medium text-slate-700 mb-1">Describe the issue</label>
          <textarea
            id="refund-reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            required
            rows={3}
            maxLength={REFUND_MAX_REASON_LENGTH}
            className="w-full rounded border px-3 py-2"
            placeholder="Describe the issue with your order..."
          />
          {rules.minReasonLength > 1 && (
            <p className="mt-1 text-xs text-slate-500">Please give at least {rules.minReasonLength} characters so we can understand the issue.</p>
          )}
          {fieldError('data.reason')}
        </div>
        <fieldset className="space-y-3">
          <legend className="block text-sm font-medium text-slate-700 mb-1">Bank details for your refund</legend>
          <p className="text-xs text-slate-500">Your bank details are stored securely and used only to pay this refund.</p>
          {BANK_FIELDS.map(({ key, label, maxLength }) => (
            <div key={key}>
              <label htmlFor={`refund-${key}`} className="block text-sm text-slate-700 mb-1">{label}</label>
              <input
                id={`refund-${key}`}
                type="text"
                value={bankAccount[key]}
                onChange={(e) => setBankField(key, e.target.value)}
                required
                maxLength={maxLength}
                className="w-full rounded border px-3 py-2"
              />
              {fieldError(`data.bankAccount.${key}`)}
            </div>
          ))}
          <div>
            <label htmlFor="refund-accountType" className="block text-sm text-slate-700 mb-1">Account type</label>
            <select
              id="refund-accountType"
              value={bankAccount.accountType}
              onChange={(e) => setBankField('accountType', e.target.value)}
              required
              className="w-full rounded border px-3 py-2"
            >
              <option value="">Select account type</option>
              {ACCOUNT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {fieldError('data.bankAccount.accountType')}
          </div>
          <div>
            <label htmlFor="refund-branchCode" className="block text-sm text-slate-700 mb-1">Branch code (6 digits)</label>
            <input
              id="refund-branchCode"
              type="text"
              inputMode="numeric"
              value={bankAccount.branchCode}
              onChange={(e) => setBankField('branchCode', e.target.value.replace(/\D/g, ''))}
              required
              className="w-full rounded border px-3 py-2"
            />
            {fieldError('data.bankAccount.branchCode')}
          </div>
          <div>
            <label htmlFor="refund-accountNumber" className="block text-sm text-slate-700 mb-1">Account number (6 to 16 digits)</label>
            <input
              id="refund-accountNumber"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={bankAccount.accountNumber}
              onChange={(e) => setBankField('accountNumber', e.target.value)}
              required
              className="w-full rounded border px-3 py-2"
            />
            {fieldError('data.bankAccount.accountNumber')}
          </div>
        </fieldset>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Upload images ({rules.minImages > 0 ? 'required, 1 to 5' : 'optional, up to 5'}, JPEG/PNG/WebP, 10 MB each)</label>
          <input
            type="file"
            accept={REFUND_IMAGE_TYPES.join(',')}
            multiple
            onChange={handleImageChange}
            className="block w-full text-sm"
          />

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-700">Selected images</p>
              <p className="text-xs text-slate-600">{imagePreviews.length} selected</p>
            </div>

            {imagePreviews.length > 0 ? (
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {imagePreviews.map((item, index) => (
                  <div key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <img src={item.previewUrl} alt={item.name} className="h-28 w-full object-cover" />
                    <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-3 py-2">
                      <p className="truncate text-xs text-slate-600" title={item.name}>{item.name}</p>
                      <button
                        type="button"
                        onClick={() => setImages((prev) => prev.filter((_, fileIndex) => fileIndex !== index))}
                        className="text-xs font-semibold uppercase tracking-[0.06em] text-rose-700 hover:text-rose-800"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">{rules.minImages > 0 ? 'No images selected yet. At least one photo is required.' : 'No images selected yet. Photos are optional for items that never arrived.'}</p>
            )}
          </div>
          {fieldError('images')}
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="bg-emerald-600 text-white px-6 py-2 rounded font-semibold disabled:opacity-60"
        >
          {submitting ? 'Submitting...' : 'Submit Refund'}
        </button>
      </form>
    </div>
  );
}
