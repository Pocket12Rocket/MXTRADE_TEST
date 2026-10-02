import Link from 'next/link';

const SUPPORT_EMAIL = 'support@fastsport.co.za';

/**
 * Why: Public buyer Terms & Conditions linked from the footer (LEGAL-24). Draft wording built from
 * the business decisions (D-04 to D-28) and counsel's intermediary position in D-26; it needs
 * legal review and the [bracketed] company details before launch.
 * @returns The buyer terms article.
 */
export default function BuyerTermsPage() {
  const supportLink = (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-slate-900 underline">
      {SUPPORT_EMAIL}
    </a>
  );

  return (
    <article className="mx-auto max-w-4xl py-4">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Legal</p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight text-slate-900">
          Terms &amp; Conditions
        </h1>
        <p className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Draft pending legal review. Details in [square brackets] are still to be confirmed.
        </p>
      </header>

      <div className="space-y-10 text-[1.05rem] leading-8 text-slate-700">
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">1. About these terms</h2>
          <p>
            These terms apply when you browse, create an account on, or buy from the FastSport
            marketplace at fastsport.co.za. FastSport is operated by [registered company name]
            (registration number [number]), of [physical address] (&quot;FastSport&quot;,
            &quot;we&quot;, &quot;us&quot;).
          </p>
          <p>
            By using FastSport or placing an order, you agree to these terms, our{' '}
            <Link href="/privacy" className="font-semibold text-slate-900 underline">
              Privacy Policy
            </Link>{' '}
            and our{' '}
            <Link href="/returns" className="font-semibold text-slate-900 underline">
              Returns and Refunds policy
            </Link>
            . If you sell on FastSport, the Seller Terms &amp; Conditions also apply.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">2. How FastSport works</h2>
          <p>
            FastSport is a marketplace for dirt bike gear, parts and accessories. Sellers list their
            own items, and every listing is reviewed by our team before it goes live.
          </p>
          <p>
            <strong>
              When you buy an item, the contract of sale is between you and its seller.
            </strong>{' '}
            FastSport provides the platform, arranges delivery, and holds your payment safely until
            the sale is complete, and only then pays the seller. FastSport is not the seller of the
            items listed, unless a listing says otherwise.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">3. Your account</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              You must be 18 or older to create an account, or have a parent or guardian&apos;s
              consent and involvement.
            </li>
            <li>
              Give accurate details and keep them up to date. You&apos;re responsible for keeping
              your password safe and for activity on your account.
            </li>
            <li>
              You need to verify your email address, and accept the current version of these terms,
              before you can buy with your account.
            </li>
            <li>
              You can also check out as a guest. Guest orders are linked to the email address you
              give at checkout.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">4. Prices and fees</h2>
          <p>All prices are in South African rand (ZAR). What you pay is made up of:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>The item price</strong> set by the seller;
            </li>
            <li>
              <strong>The FastSport service fee</strong>, which is how FastSport earns its income.
              Listings show the all-in price with the service fee named, and checkout shows the fee
              as its own line; and
            </li>
            <li>
              <strong>A delivery fee</strong> for each seller you buy from, shown at checkout before
              you pay.
            </li>
          </ul>
          <p>
            [VAT: confirm whether prices include VAT, and FastSport&apos;s VAT number if
            registered.]
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">5. Ordering and payment</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              Payments are processed by PayFast. FastSport never sees or stores your card details.
            </li>
            <li>
              When you start checkout, we hold the items for you for 30 minutes so you can pay. If
              payment arrives after that and an item has sold to someone else, we&apos;ll contact
              you to refund you or, where possible, fulfil your order.
            </li>
            <li>
              If your cart has items from more than one seller, each seller&apos;s items become a
              separate order, even though you pay once.
            </li>
            <li>
              Your order is confirmed once your payment is received. We&apos;ll email you an order
              confirmation.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">6. Delivery</h2>
          <p>
            FastSport chooses the courier and arranges collection from the seller and delivery to
            the address you give at checkout. We&apos;ll keep you updated by email as your order
            moves along. Please make sure your delivery address and contact details are correct.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">7. Completing the sale</h2>
          <p>
            When your order arrives, check it and confirm delivery in the app. Confirming means
            you&apos;re happy with the item: the sale is complete and the seller can be paid. If you
            don&apos;t confirm, the sale completes automatically 48 hours after the courier confirms
            delivery, unless you&apos;ve requested a refund.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">8. Returns and refunds</h2>
          <p>
            If an item arrives damaged, is significantly different from its listing, or never
            arrives, you can ask for a refund. If you&apos;ve simply changed your mind, we&apos;ll
            help you resell the item without the service fee. The time limits and steps are set out
            in our{' '}
            <Link href="/returns" className="font-semibold text-slate-900 underline">
              Returns and Refunds policy
            </Link>
            , which forms part of these terms.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">9. Listings</h2>
          <p>
            Sellers are responsible for describing their items accurately, including their
            condition. We review every listing before it goes live, but we can&apos;t inspect items
            in person, so please read each listing and look at every photo before you buy. We may
            remove any listing at any time.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">10. Using FastSport fairly</h2>
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>use FastSport for anything unlawful or fraudulent;</li>
            <li>
              arrange to pay a seller outside FastSport for an item found on FastSport, which also
              takes away the protection described in these terms;
            </li>
            <li>interfere with the platform, its security, or other users&apos; accounts; or</li>
            <li>copy or scrape listings, photos or other content from FastSport.</li>
          </ul>
          <p>We may suspend or close an account that breaks these terms.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">11. Liability</h2>
          <p>
            We take reasonable steps to run a safe and reliable marketplace, but we can&apos;t
            guarantee that FastSport will always be available or free of errors. To the extent the
            law allows, FastSport is not liable for indirect or consequential loss arising from your
            use of the marketplace.
          </p>
          <p>
            Nothing in these terms limits or excludes your rights under the Consumer Protection Act
            or the Electronic Communications and Transactions Act, or any liability that cannot be
            limited by law.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">12. Complaints and disputes</h2>
          <p>
            If something goes wrong, email {supportLink} with your order number and we&apos;ll try
            to resolve it. Where a problem is between you and a seller, we&apos;ll help, and we hold
            the payment until the matter is settled.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">13. Changes to these terms</h2>
          <p>
            We may update these terms from time to time. When we do, we&apos;ll publish the new
            version here, and you&apos;ll be asked to accept it the next time you sign in before you
            can buy again.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">14. Governing law</h2>
          <p>These terms are governed by the laws of the Republic of South Africa.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">15. Contact us</h2>
          <p>[Registered company name], [physical address]. Email {supportLink}.</p>
        </section>
      </div>
    </article>
  );
}
