const SUPPORT_EMAIL = 'support@fastsport.co.za';

/**
 * Why: Public returns and refunds policy linked from the footer (PayFast and the CPA expect a
 * discoverable one). The copy mirrors `FastSport_BackEnd/docs/RETURN_POLICY.md` (D-22, D-25,
 * D-26, D-27); change both together.
 * @returns The returns and refunds policy article.
 */
export default function ReturnPolicyPage() {
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
          Returns and Refunds
        </h1>
      </header>

      <div className="space-y-10 text-[1.05rem] leading-8 text-slate-700">
        <section className="space-y-4">
          <p>
            FastSport is a marketplace. Sellers list their own items, and FastSport provides the
            platform, holds your payment safely until the sale is complete, and steps in if
            something goes wrong. When you buy an item, you&apos;re buying it from its seller.
          </p>
          <p>This policy explains what to do if an item isn&apos;t what you expected.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">Before you buy</h2>
          <p>Most problems can be avoided up front:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Read the whole listing, including the condition, and look at every photo.</li>
            <li>Check that a part fits your bike (make, model and year) before you order.</li>
            <li>
              If you&apos;re unsure about anything, contact us at {supportLink} before you buy.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">
            Orders from more than one seller
          </h2>
          <p>
            If your cart has items from different sellers, each seller&apos;s items are a separate
            order, even though you pay once. This policy applies to each order on its own: a problem
            with one seller&apos;s item doesn&apos;t affect your orders from other sellers.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">
            If there&apos;s a problem with your item
          </h2>
          <p>You can ask for a refund if your item:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>arrived damaged;</strong>
            </li>
            <li>
              <strong>is significantly different from the listing</strong>, for example a different
              item, size, model or part; or
            </li>
            <li>
              <strong>is in a significantly worse condition than the listing described</strong>; or
            </li>
            <li>
              <strong>
                has another problem with the item that the listing didn&apos;t disclose
              </strong>
              .
            </li>
          </ul>

          <h3 className="pt-2 text-xl font-semibold text-slate-900">
            Time limit: 48 hours after delivery
          </h3>
          <p>
            Request a refund <strong>within 48 hours of your order being delivered</strong>, and
            before you confirm delivery (see &quot;Confirming delivery&quot; below). After that, the
            sale is complete and we can no longer accept a refund request for that order.
          </p>

          <h3 className="pt-2 text-xl font-semibold text-slate-900">If your item never arrived</h3>
          <p>
            If your order hasn&apos;t been delivered{' '}
            <strong>10 business days after you paid</strong>, you can report it as not received and
            ask for a refund. Photos are optional for this kind of request, since there&apos;s
            nothing to photograph; telling us what happened is enough.
          </p>

          <h3 className="pt-2 text-xl font-semibold text-slate-900">How to request a refund</h3>
          <ol className="list-decimal space-y-1 pl-6">
            <li>
              Open your order in the FastSport app. If you checked out as a guest, use the link in
              your order confirmation email.
            </li>
            <li>
              Choose <strong>Request a refund</strong>.
            </li>
            <li>
              Tell us what&apos;s wrong, and add <strong>1 to 5 photos</strong> that show the
              problem. Photos are required, except when your item never arrived.
            </li>
            <li>
              Enter the bank account we should refund: account holder, bank, account type, branch
              code and account number.
            </li>
          </ol>
          <p>
            Please keep the item and its packaging as they arrived until we&apos;ve finished looking
            at your request.
          </p>
          <p>
            You can have one open refund request per order at a time. If a request isn&apos;t
            approved, you can make a new one for that order while the time limit still allows it.
          </p>

          <h3 className="pt-2 text-xl font-semibold text-slate-900">What happens next</h3>
          <p>Our team reviews every request and may contact you for more information.</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>If we approve it:</strong> we arrange and pay for a courier to take the item
              back to the seller, and we refund <strong>everything you paid for that order</strong>:
              the item price, the FastSport service fee and the delivery fee. Refunds are paid by
              EFT to the account you gave us, within 48 hours of approval. We&apos;ll email you when
              the payment has been made, with its reference.
            </li>
            <li>
              <strong>If we can&apos;t approve it:</strong> we&apos;ll email you to explain why, and
              the item stays yours.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">
            If you&apos;ve changed your mind
          </h2>
          <p>
            If your item is exactly as described but it isn&apos;t right for you, we won&apos;t
            refund it, but we&apos;ll help you sell it on.
          </p>
          <p>
            <strong>Within 7 days of delivery</strong>, email {supportLink} with your order number,
            and we&apos;ll help you list the item on FastSport{' '}
            <strong>without the FastSport service fee</strong>. That makes your item cheaper for
            buyers than a normal listing at the same price, so it can sell faster.
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>The item stays with you until someone buys it.</li>
            <li>
              To list it, you&apos;ll need to register as a seller on FastSport and accept the
              seller terms.
            </li>
            <li>
              When it sells, it follows the normal sale process, and you&apos;re paid the full price
              you set.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">Confirming delivery</h2>
          <p>
            When your order arrives, check it and then choose <strong>Confirm delivery</strong> in
            the app. By confirming, you&apos;re telling us you&apos;re happy with the item: the sale
            is complete and the seller can be paid, so you can no longer request a refund for that
            order.
          </p>
          <p>
            If you don&apos;t confirm, the sale completes automatically{' '}
            <strong>48 hours after the courier confirms delivery</strong>, unless you&apos;ve
            requested a refund.
          </p>
          <p>
            You can still use the &quot;changed your mind&quot; option for 7 days after delivery,
            even after the sale is complete.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">
            What this policy doesn&apos;t cover
          </h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>Wear, marks or defects that the listing described or showed in its photos.</li>
            <li>
              Parts that don&apos;t fit because the wrong part was ordered, when the listing&apos;s
              fitment details were correct. (If you&apos;ve changed your mind, see above.)
            </li>
            <li>Damage that happened after delivery.</li>
            <li>
              Refund requests made more than 48 hours after delivery, or after you&apos;ve confirmed
              delivery.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">Your rights</h2>
          <p>
            This policy doesn&apos;t affect your rights under the Consumer Protection Act or the
            Electronic Communications and Transactions Act.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">Contact us</h2>
          <p>Email {supportLink} with your order number, and we&apos;ll help.</p>
        </section>
      </div>
    </article>
  );
}
