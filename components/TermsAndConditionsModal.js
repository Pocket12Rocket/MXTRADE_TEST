export default function TermsAndConditionsModal({
  isOpen,
  onClose,
  onConfirm,
  isChecked,
  onCheckedChange,
  isSubmitting = false,
  confirmLabel = 'Confirm and continue',
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-900">Privacy, Security &amp; Platform Terms</h2>
        </div>

        <div className="max-h-[62vh] space-y-5 overflow-y-auto px-6 py-5 text-sm leading-6 text-slate-700">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Collection and Protection of Personal Information</h3>
            <p className="mt-2">
              FastSport is committed to protecting your privacy and safeguarding your personal information. We collect and process personal information, including identification details, contact information, and banking information, only where necessary to provide our services and facilitate transactions on the FastSport platform.
            </p>
            <p className="mt-2">
              Seller banking details and personal information are collected solely for the purpose of verifying seller identities, processing payments, complying with applicable legal and regulatory requirements, and maintaining the security and integrity of the marketplace.
            </p>
            <p className="mt-2">
              FastSport implements reasonable administrative, technical, and physical security measures to protect personal information from unauthorized access, disclosure, alteration, or destruction. Under no circumstances will FastSport sell, rent, or share your personal or banking information with third parties for marketing purposes or publish such information on any public platform, except where disclosure is required by law or is necessary to provide the services requested by you.
            </p>
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">User Conduct and Account Suspension</h3>
            <p className="mt-2">
              By creating an account on FastSport, you agree to comply with all applicable laws, these Terms and Conditions, and any policies or guidelines published by FastSport from time to time.
            </p>
            <p className="mt-2">
              FastSport reserves the right, at its sole discretion, to suspend, restrict, or permanently remove any user profile or account that violates these Terms and Conditions, engages in fraudulent or unlawful activity, provides false or misleading information, lists prohibited items, or otherwise acts in a manner that may compromise the safety, security, or integrity of the FastSport marketplace.
            </p>
            <p className="mt-2">
              FastSport may remove content, listings, or user accounts without prior notice where it reasonably believes such action is necessary to protect its users or the platform.
            </p>
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">Acceptance</h3>
            <p className="mt-2">
              By registering an account and using the FastSport platform, you acknowledge that you have read, understood, and agree to these Terms and Conditions, including the collection, use, and protection of your personal information as described above.
            </p>
          </div>
        </div>

        <div className="space-y-4 border-t border-slate-200 px-6 py-5">
          <label className="flex items-start gap-3 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(event) => onCheckedChange(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#00C5CD] focus:ring-[#00C5CD]"
            />
            <span>I agree to the terms and conditions</span>
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onConfirm}
              disabled={!isChecked || isSubmitting}
              className="rounded-3xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Please wait...' : confirmLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-3xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
