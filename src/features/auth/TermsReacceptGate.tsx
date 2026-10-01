import { useState } from 'react';
import TermsAndConditionsModal from './TermsAndConditionsModal';
import { useAuthContext } from '@/lib/AuthContext';
import { acceptTerms } from '@/lib/api/auth';
import { BUYER_TERMS_VERSION } from './termsVersions';
import { toUserMessage } from '@/lib/userMessage';
import { useSingleFlight } from '@/lib/useSingleFlight';

/**
 * Why: Blocks the app with the buyer terms while `/me` says `termsReacceptRequired`, until the
 * user accepts or signs out; it renders nothing otherwise.
 * @returns The blocking terms modal, or `null`.
 * @example
 * // In Layout, once, above the page content:
 * <TermsReacceptGate />
 */
export default function TermsReacceptGate() {
  const { profile, setSignedInUser, signOut } = useAuthContext();
  const [isChecked, setIsChecked] = useState(false);
  const { run, pending: submitting } = useSingleFlight();
  const [error, setError] = useState('');

  if (!profile?.termsReacceptRequired) {
    return null;
  }

  /**
   * Why: Records acceptance of the version shown and stores the updated `Me` returned by the
   * backend, which clears `termsReacceptRequired` and closes the gate.
   */
  const handleConfirm = async () => {
    if (!isChecked) return;
    setError('');
    try {
      await run(async () => {
        setSignedInUser(await acceptTerms(BUYER_TERMS_VERSION));
        setIsChecked(false);
      });
    } catch (err) {
      setError(toUserMessage(err, 'Could not record your acceptance. Please try again.'));
    }
  };

  return (
    <>
      <TermsAndConditionsModal
        isOpen
        onClose={submitting ? () => {} : signOut}
        onConfirm={handleConfirm}
        isChecked={isChecked}
        onCheckedChange={setIsChecked}
        isSubmitting={submitting}
        confirmLabel="I agree and continue"
      />
      {error ? (
        <p
          role="alert"
          className="fixed bottom-4 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-rose-600 px-4 py-2 text-sm text-white"
        >
          {error}
        </p>
      ) : null}
    </>
  );
}
