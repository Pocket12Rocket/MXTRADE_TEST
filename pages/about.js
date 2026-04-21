export default function About() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">About MXTrade</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">Clean commerce for sellers and buyers</h1>
        <p className="mt-4 max-w-2xl text-slate-600">MXTrade is built to let sellers submit inventory for review, while giving customers a curated shopping experience. The admin layer keeps the marketplace quality controlled.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Seller-first experience</h2>
          <p className="mt-3 text-slate-600">Sellers register, submit products for approval, and build a profile. Admins review submissions manually before listing products.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Simple product discovery</h2>
          <p className="mt-3 text-slate-600">Products can be categorized and filtered. Each listing includes up to five images, descriptions, specs, and pricing.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Flexible payments</h2>
          <p className="mt-3 text-slate-600">The platform is designed for PayFast / Fayfast integration. You can swap the payment provider with minimal frontend changes.</p>
        </div>
      </div>
    </div>
  );
}
