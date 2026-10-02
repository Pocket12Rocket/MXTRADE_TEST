export const PRIVACY_POLICY_EFFECTIVE_DATE = '01-07-2026';

/**
 * Why: The one copy of the privacy policy text, shared by the signup/re-accept modal and the
 * public `/privacy` page so the two can never drift apart.
 * @returns The numbered privacy policy sections.
 * @example
 * <PrivacyPolicyContent />
 */
export default function PrivacyPolicyContent() {
  return (
    <>
      <div>
        <h3 className="text-base font-semibold text-slate-900">1. Introduction</h3>
        <p className="mt-2">
          FastSport (&quot;FastSport&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;)
          values your privacy and is committed to protecting your personal information. This Privacy
          Policy explains how we collect, use, store, protect, and process your personal information
          when you use the FastSport platform, including our website and related services.
        </p>
        <p className="mt-2">
          By registering an account or using the FastSport platform, you consent to the collection
          and processing of your personal information in accordance with this Privacy Policy and
          applicable laws, including the Protection of Personal Information Act, 2013 (POPIA).
        </p>
      </div>

      <div>
        <h3 className="text-base font-semibold text-slate-900">2. Information We Collect</h3>
        <p className="mt-2">
          To provide our services safely and efficiently, we may collect the following information:
        </p>
        <p className="mt-2">
          <strong>Personal Information</strong>
        </p>
        <p className="mt-1">Full name</p>
        <p className="mt-1">Email address</p>
        <p className="mt-1">Mobile number</p>
        <p className="mt-1">Residential or business address</p>
        <p className="mt-1">Date of birth (where required)</p>
        <p className="mt-1">Identity or passport number (where verification is required)</p>
        <p className="mt-2">
          <strong>Seller Information</strong>
        </p>
        <p className="mt-1">Banking details</p>
        <p className="mt-1">Identity verification documents</p>
        <p className="mt-1">Tax information where legally required</p>
        <p className="mt-2">
          <strong>Account Information</strong>
        </p>
        <p className="mt-1">Username</p>
        <p className="mt-1">Password (stored securely in encrypted form)</p>
        <p className="mt-1">Profile information</p>
        <p className="mt-1">Account preferences</p>
        <p className="mt-2">
          <strong>Transaction Information</strong>
        </p>
        <p className="mt-1">Purchase history</p>
        <p className="mt-1">Sales history</p>
        <p className="mt-1">Payment records</p>
        <p className="mt-1">Shipping information</p>
        <p className="mt-1">Refund records</p>
        <p className="mt-2">
          <strong>Technical Information</strong>
        </p>
        <p className="mt-1">IP address</p>
        <p className="mt-1">Browser type</p>
        <p className="mt-1">Device information</p>
        <p className="mt-1">Operating system</p>
        <p className="mt-1">Website usage information</p>
        <p className="mt-1">Cookies and similar technologies</p>
      </div>

      <div>
        <h3 className="text-base font-semibold text-slate-900">
          3. Why We Collect Your Information
        </h3>
        <p className="mt-2">
          Your personal information is collected for legitimate business purposes, including
          creating and managing your account, verifying the identity of buyers and sellers,
          processing payments to sellers, completing purchases and transactions, preventing fraud
          and protecting users, responding to customer support requests, improving our website and
          services, meeting legal and regulatory obligations, and communicating important updates
          regarding your account or transactions.
        </p>
        <p className="mt-2">
          We only collect information that is necessary to provide our services.
        </p>
      </div>

      <div>
        <h3 className="text-base font-semibold text-slate-900">4. Banking Information</h3>
        <p className="mt-2">
          Seller banking information is collected solely for the purpose of processing payments and
          verifying seller accounts. FastSport does not publish, sell, rent, or share banking
          information with any third party for marketing purposes. Banking information is protected
          using appropriate security measures and is accessible only to authorized personnel who
          require access to perform their duties.
        </p>
      </div>

      <div>
        <h3 className="text-base font-semibold text-slate-900">
          5. How We Protect Your Information
        </h3>
        <p className="mt-2">
          FastSport takes reasonable technical and organizational measures to protect your personal
          information against unauthorized access, loss, theft, misuse, alteration, and accidental
          disclosure. These measures may include encrypted transmission of sensitive information
          where applicable, secure servers and hosting environments, access controls and
          authentication procedures, regular security monitoring, and restricted employee access to
          confidential information.
        </p>
        <p className="mt-2">
          While we take reasonable steps to protect your information, no internet-based system can
          be guaranteed to be completely secure.
        </p>
      </div>

      <div>
        <h3 className="text-base font-semibold text-slate-900">
          6. Sharing of Personal Information
        </h3>
        <p className="mt-2">
          FastSport respects your privacy. We will never sell or rent your personal information.
          Your information will only be shared where necessary, including payment service providers
          to facilitate transactions, delivery or courier partners where required, service providers
          assisting us in operating the platform, and law enforcement or regulatory authorities
          where disclosure is required by law or a valid legal process. All service providers are
          required to protect your information appropriately.
        </p>
      </div>

      <div>
        <h3 className="text-base font-semibold text-slate-900">7. Data Retention</h3>
        <p className="mt-2">
          FastSport retains personal information only for as long as necessary to maintain your
          account, complete transactions, resolve disputes, meet legal, tax, accounting, and
          regulatory obligations, and protect FastSport against fraud or legal claims. When
          information is no longer required, it will be securely deleted, anonymized, or destroyed
          in accordance with applicable legal requirements.
        </p>
      </div>

      <div>
        <h3 className="text-base font-semibold text-slate-900">8. Your Rights</h3>
        <p className="mt-2">
          Subject to applicable law, you have the right to access the personal information we hold
          about you, request correction of inaccurate or incomplete information, request deletion of
          your personal information where legally permissible, withdraw consent where processing is
          based on consent, object to certain processing activities, and request a copy of your
          personal information. Certain information may need to be retained where FastSport has
          legal or contractual obligations to do so.
        </p>
      </div>

      <div>
        <h3 className="text-base font-semibold text-slate-900">
          9. Requesting Correction or Deletion
        </h3>
        <p className="mt-2">
          You may request that FastSport update your personal information, correct inaccurate
          information, delete your account, or remove personal information where legally permitted.
          Requests should be submitted through our customer support channels or by emailing
          support@fastsport.co.za.
        </p>
        <p className="mt-2">
          FastSport will respond within a reasonable period and in accordance with applicable law.
          Please note that deleting your account does not necessarily require us to delete all
          information immediately, as certain records may need to be retained to comply with legal,
          tax, accounting, fraud prevention, or regulatory obligations.
        </p>
      </div>

      <div>
        <h3 className="text-base font-semibold text-slate-900">10. Cookies</h3>
        <p className="mt-2">
          FastSport may use cookies and similar technologies to remember user preferences, improve
          website performance, maintain secure login sessions, analyse website traffic, and improve
          user experience. Users may disable cookies through their browser settings; however,
          certain features of the website may not function correctly.
        </p>
      </div>

      <div>
        <h3 className="text-base font-semibold text-slate-900">11. Third-Party Services</h3>
        <p className="mt-2">
          FastSport may make use of trusted third-party providers for payment processing, website
          hosting, analytics, communication services, and other operational functions. These
          providers are only permitted to process personal information on our behalf and are
          required to maintain appropriate security measures.
        </p>
      </div>

      <div>
        <h3 className="text-base font-semibold text-slate-900">12. Children&apos;s Privacy</h3>
        <p className="mt-2">
          FastSport is not intended for individuals under the age of 18 without the involvement or
          consent of a parent or legal guardian. We do not knowingly collect personal information
          from children.
        </p>
      </div>

      <div>
        <h3 className="text-base font-semibold text-slate-900">
          13. Changes to this Privacy Policy
        </h3>
        <p className="mt-2">
          FastSport reserves the right to amend this Privacy Policy at any time. Any updates will be
          published on the FastSport website with a revised effective date. Continued use of the
          platform after changes have been published constitutes acceptance of the updated Privacy
          Policy.
        </p>
      </div>

      <div>
        <h3 className="text-base font-semibold text-slate-900">14. Contact Us</h3>
        <p className="mt-2">
          If you have any questions regarding this Privacy Policy or your personal information,
          please contact us:
        </p>
        <p className="mt-2">
          <strong>FastSport</strong>
        </p>
        <p className="mt-1">Email: support@fastsport.co.za</p>
        <p className="mt-1">Website: www.fastsport.co.za</p>
      </div>
    </>
  );
}
