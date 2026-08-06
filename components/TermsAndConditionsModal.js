export default function TermsAndConditionsModal({
  isOpen,
  onClose,
  onConfirm,
  isChecked,
  onCheckedChange,
  isSubmitting = false,
  confirmLabel = 'Confirm and continue',
  title = 'FastSport Privacy Policy',
  subtitle = 'Effective Date: 01-07-2026',
  mode = 'privacy',
  checkboxLabel = 'I have read and agree to the privacy policy',
}) {
  if (!isOpen) {
    return null;
  }

  const renderContent = () => {
    if (mode === 'seller') {
      return (
        <>
          <div>
            <h3 className="text-base font-semibold text-slate-900">1. Introduction</h3>
            <p className="mt-2">
              These Seller Terms &amp; Conditions govern the use of the FastSport marketplace by individuals and businesses offering products for sale (&quot;Seller&quot;, &quot;you&quot;, or &quot;your&quot;). By registering as a seller and listing products on FastSport, you agree to be bound by these Terms, together with FastSport&apos;s general Terms &amp; Conditions and Privacy Policy.
            </p>
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">2. Seller Eligibility</h3>
            <p className="mt-2">To sell products on FastSport, you must:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Provide accurate and complete registration information.</li>
              <li>Maintain up-to-date account information.</li>
              <li>Supply any documentation requested by FastSport to verify your identity or ownership of products.</li>
              <li>Comply with all applicable laws and regulations.</li>
            </ul>
            <p className="mt-2">FastSport reserves the right to approve or decline any seller application at its sole discretion.</p>
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">3. Product Listings</h3>
            <p className="mt-2">
              All products submitted for sale on FastSport are subject to review before being made available on the marketplace.
            </p>
            <p className="mt-2">
              FastSport manually reviews every product listing to help maintain the quality, safety, and integrity of the platform.
            </p>
            <p className="mt-2">
              FastSport reserves the right to approve or reject any product listing, refuse the sale of any product for any reason it reasonably considers appropriate, remove any product listing at any time, request additional photographs, documentation, proof of purchase, serial numbers, or any other information necessary to verify the authenticity, ownership, or condition of a product, and contact sellers to request clarification or supporting information before approving a listing.
            </p>
            <p className="mt-2">Submission of a product does not guarantee that it will be approved for sale on the FastSport marketplace.</p>
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">4. Product Authenticity</h3>
            <p className="mt-2">
              Sellers are solely responsible for ensuring that all products listed are genuine, legally owned, accurately described, and do not infringe upon the intellectual property rights of any third party.
            </p>
            <p className="mt-2">
              FastSport reserves the right to reject or remove listings where authenticity cannot be reasonably verified or where there is reason to believe that a product may be counterfeit, stolen, prohibited, or misrepresented.
            </p>
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">5. Pricing</h3>
            <p className="mt-2">Sellers are responsible for providing accurate pricing for all listed products.</p>
            <p className="mt-2">FastSport reserves the right to remove listings containing obvious pricing errors or misleading information.</p>
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">6. Delivery and Shipping</h3>
            <p className="mt-2">
              FastSport will determine the courier or delivery service used to transport products sold through the marketplace.
            </p>
            <p className="mt-2">
              By listing products on FastSport, sellers acknowledge and agree that FastSport has sole discretion in selecting the delivery company or logistics partner responsible for collecting and delivering sold products.
            </p>
            <p className="mt-2">
              Sellers agree to package products appropriately and make them available for collection within the timeframes communicated by FastSport.
            </p>
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">7. Payment to Sellers</h3>
            <p className="mt-2">
              To protect both buyers and sellers, FastSport operates a secure payment process.
            </p>
            <p className="mt-2">
              Payments made by customers will be held by FastSport until the purchased product has been successfully delivered to the buyer and the delivery has been confirmed.
            </p>
            <p className="mt-2">
              Once delivery has been successfully completed and any applicable verification or inspection requirements have been satisfied, payment will be released to the seller in accordance with FastSport&apos;s payment procedures.
            </p>
            <p className="mt-2">
              FastSport reserves the right to delay payment where a delivery dispute exists, fraud is suspected, an investigation is required, a return, refund, or chargeback is pending, or there is any other reasonable concern regarding the transaction.
            </p>
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">8. Seller Responsibilities</h3>
            <p className="mt-2">Sellers agree to accurately describe products, disclose any defects or damage, ensure products are available for sale, respond promptly to requests for information, cooperate with FastSport during authenticity checks or investigations, and comply with all marketplace policies.</p>
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">9. Prohibited Products</h3>
            <p className="mt-2">
              FastSport reserves the right to prohibit the sale of products that are counterfeit or replicas, illegal or stolen, dangerous or unsafe, misrepresented, restricted by applicable law, or otherwise considered unsuitable for the FastSport marketplace.
            </p>
            <p className="mt-2">FastSport may remove prohibited listings without prior notice.</p>
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">10. Suspension and Termination</h3>
            <p className="mt-2">
              FastSport reserves the right to suspend or permanently terminate a seller account where the seller breaches these Terms, provides false information, attempts to sell counterfeit or prohibited products, engages in fraudulent or dishonest conduct, fails to cooperate with verification requests, or acts in a manner that may damage the reputation, security, or integrity of the FastSport platform.
            </p>
            <p className="mt-2">FastSport may also remove any associated listings without prior notice.</p>
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">11. Limitation of Liability</h3>
            <p className="mt-2">
              While FastSport takes reasonable steps to operate a secure and trustworthy marketplace, FastSport does not guarantee that every transaction will be free from delays, disputes, technical interruptions, or unforeseen circumstances.
            </p>
            <p className="mt-2">
              To the fullest extent permitted by law, FastSport shall not be liable for indirect, incidental, or consequential losses arising from the use of the marketplace.
            </p>
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">12. Amendments</h3>
            <p className="mt-2">
              FastSport reserves the right to amend, update, or replace these Seller Terms &amp; Conditions, marketplace policies, procedures, fees, or operational requirements at any time.
            </p>
            <p className="mt-2">
              Updated Terms will become effective upon publication on the FastSport website unless otherwise stated. Continued use of the platform after such publication constitutes acceptance of the revised Terms.
            </p>
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900">13. Acceptance</h3>
            <p className="mt-2">
              By registering as a seller or listing products on the FastSport marketplace, you acknowledge that you have read, understood, and agree to be bound by these Seller Terms &amp; Conditions.
            </p>
          </div>
        </>
      );
    }

    return (
      <>
        <div>
          <h3 className="text-base font-semibold text-slate-900">1. Introduction</h3>
          <p className="mt-2">
            FastSport (&quot;FastSport&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) values your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, protect, and process your personal information when you use the FastSport platform, including our website and related services.
          </p>
          <p className="mt-2">
            By registering an account or using the FastSport platform, you consent to the collection and processing of your personal information in accordance with this Privacy Policy and applicable laws, including the Protection of Personal Information Act, 2013 (POPIA).
          </p>
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-900">2. Information We Collect</h3>
          <p className="mt-2">To provide our services safely and efficiently, we may collect the following information:</p>
          <p className="mt-2"><strong>Personal Information</strong></p>
          <p className="mt-1">Full name</p>
          <p className="mt-1">Email address</p>
          <p className="mt-1">Mobile number</p>
          <p className="mt-1">Residential or business address</p>
          <p className="mt-1">Date of birth (where required)</p>
          <p className="mt-1">Identity or passport number (where verification is required)</p>
          <p className="mt-2"><strong>Seller Information</strong></p>
          <p className="mt-1">Banking details</p>
          <p className="mt-1">Identity verification documents</p>
          <p className="mt-1">Tax information where legally required</p>
          <p className="mt-2"><strong>Account Information</strong></p>
          <p className="mt-1">Username</p>
          <p className="mt-1">Password (stored securely in encrypted form)</p>
          <p className="mt-1">Profile information</p>
          <p className="mt-1">Account preferences</p>
          <p className="mt-2"><strong>Transaction Information</strong></p>
          <p className="mt-1">Purchase history</p>
          <p className="mt-1">Sales history</p>
          <p className="mt-1">Payment records</p>
          <p className="mt-1">Shipping information</p>
          <p className="mt-1">Refund records</p>
          <p className="mt-2"><strong>Technical Information</strong></p>
          <p className="mt-1">IP address</p>
          <p className="mt-1">Browser type</p>
          <p className="mt-1">Device information</p>
          <p className="mt-1">Operating system</p>
          <p className="mt-1">Website usage information</p>
          <p className="mt-1">Cookies and similar technologies</p>
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-900">3. Why We Collect Your Information</h3>
          <p className="mt-2">
            Your personal information is collected for legitimate business purposes, including creating and managing your account, verifying the identity of buyers and sellers, processing payments to sellers, completing purchases and transactions, preventing fraud and protecting users, responding to customer support requests, improving our website and services, meeting legal and regulatory obligations, and communicating important updates regarding your account or transactions.
          </p>
          <p className="mt-2">We only collect information that is necessary to provide our services.</p>
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-900">4. Banking Information</h3>
          <p className="mt-2">
            Seller banking information is collected solely for the purpose of processing payments and verifying seller accounts. FastSport does not publish, sell, rent, or share banking information with any third party for marketing purposes. Banking information is protected using appropriate security measures and is accessible only to authorized personnel who require access to perform their duties.
          </p>
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-900">5. How We Protect Your Information</h3>
          <p className="mt-2">
            FastSport takes reasonable technical and organizational measures to protect your personal information against unauthorized access, loss, theft, misuse, alteration, and accidental disclosure. These measures may include encrypted transmission of sensitive information where applicable, secure servers and hosting environments, access controls and authentication procedures, regular security monitoring, and restricted employee access to confidential information.
          </p>
          <p className="mt-2">While we take reasonable steps to protect your information, no internet-based system can be guaranteed to be completely secure.</p>
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-900">6. Sharing of Personal Information</h3>
          <p className="mt-2">
            FastSport respects your privacy. We will never sell or rent your personal information. Your information will only be shared where necessary, including payment service providers to facilitate transactions, delivery or courier partners where required, service providers assisting us in operating the platform, and law enforcement or regulatory authorities where disclosure is required by law or a valid legal process. All service providers are required to protect your information appropriately.
          </p>
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-900">7. Data Retention</h3>
          <p className="mt-2">
            FastSport retains personal information only for as long as necessary to maintain your account, complete transactions, resolve disputes, meet legal, tax, accounting, and regulatory obligations, and protect FastSport against fraud or legal claims. When information is no longer required, it will be securely deleted, anonymized, or destroyed in accordance with applicable legal requirements.
          </p>
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-900">8. Your Rights</h3>
          <p className="mt-2">
            Subject to applicable law, you have the right to access the personal information we hold about you, request correction of inaccurate or incomplete information, request deletion of your personal information where legally permissible, withdraw consent where processing is based on consent, object to certain processing activities, and request a copy of your personal information. Certain information may need to be retained where FastSport has legal or contractual obligations to do so.
          </p>
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-900">9. Requesting Correction or Deletion</h3>
          <p className="mt-2">
            You may request that FastSport update your personal information, correct inaccurate information, delete your account, or remove personal information where legally permitted. Requests should be submitted through our customer support channels or by emailing support@fastsport.co.za.
          </p>
          <p className="mt-2">
            FastSport will respond within a reasonable period and in accordance with applicable law. Please note that deleting your account does not necessarily require us to delete all information immediately, as certain records may need to be retained to comply with legal, tax, accounting, fraud prevention, or regulatory obligations.
          </p>
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-900">10. Cookies</h3>
          <p className="mt-2">
            FastSport may use cookies and similar technologies to remember user preferences, improve website performance, maintain secure login sessions, analyse website traffic, and improve user experience. Users may disable cookies through their browser settings; however, certain features of the website may not function correctly.
          </p>
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-900">11. Third-Party Services</h3>
          <p className="mt-2">
            FastSport may make use of trusted third-party providers for payment processing, website hosting, analytics, communication services, and other operational functions. These providers are only permitted to process personal information on our behalf and are required to maintain appropriate security measures.
          </p>
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-900">12. Children&apos;s Privacy</h3>
          <p className="mt-2">
            FastSport is not intended for individuals under the age of 18 without the involvement or consent of a parent or legal guardian. We do not knowingly collect personal information from children.
          </p>
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-900">13. Changes to this Privacy Policy</h3>
          <p className="mt-2">
            FastSport reserves the right to amend this Privacy Policy at any time. Any updates will be published on the FastSport website with a revised effective date. Continued use of the platform after changes have been published constitutes acceptance of the updated Privacy Policy.
          </p>
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-900">14. Contact Us</h3>
          <p className="mt-2">If you have any questions regarding this Privacy Policy or your personal information, please contact us:</p>
          <p className="mt-2"><strong>FastSport</strong></p>
          <p className="mt-1">Email: support@fastsport.co.za</p>
          <p className="mt-1">Website: www.fastsport.co.za</p>
        </div>
      </>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        </div>

        <div className="max-h-[62vh] space-y-5 overflow-y-auto px-6 py-5 text-sm leading-6 text-slate-700">
          <p className="font-medium text-slate-900">{subtitle}</p>
          {renderContent()}
        </div>

        <div className="space-y-4 border-t border-slate-200 px-6 py-5">
          <label className="flex items-start gap-3 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(event) => onCheckedChange(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#00C5CD] focus:ring-[#00C5CD]"
            />
            <span>{checkboxLabel}</span>
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
