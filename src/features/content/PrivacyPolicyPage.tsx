import PrivacyPolicyContent, { PRIVACY_POLICY_EFFECTIVE_DATE } from './PrivacyPolicyContent';

/**
 * Why: Permanent public URL for the privacy policy (POPIA and PayFast require one), linked from
 * the footer; it renders the same text users accept in the signup modal.
 * @returns The privacy policy article.
 */
export default function PrivacyPolicyPage() {
  return (
    <article className="mx-auto max-w-4xl py-4">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Legal</p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight text-slate-900">
          FastSport Privacy Policy
        </h1>
        <p className="mt-4 text-xs uppercase tracking-[0.08em] text-slate-500">
          Effective date: {PRIVACY_POLICY_EFFECTIVE_DATE}
        </p>
      </header>

      <section className="space-y-6 text-[1.05rem] leading-8 text-slate-700">
        <PrivacyPolicyContent />
      </section>
    </article>
  );
}
