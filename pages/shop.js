import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const SHOP_CATEGORY_OPTIONS = [
  {
    href: '/shop/catalog?category=Gear',
    label: 'Gear',
    color: 'bg-[#00CED1] text-white hover:bg-[#00C5CD]',
  },
  {
    href: '/shop/catalog?category=Accessories',
    label: 'Accessories',
    color: 'bg-[#00CED1] text-white hover:bg-[#00C5CD]',
  },
  {
    href: '/shop/catalog?category=Parts',
    label: 'Bike Parts',
    color: 'bg-[#00CED1] text-white hover:bg-[#00C5CD]',
  },
];

export default function ShopLanding() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const hasLegacyQuery = typeof router.query.q === 'string'
      || typeof router.query.category === 'string'
      || typeof router.query.sub === 'string';

    if (hasLegacyQuery) {
      router.replace({ pathname: '/shop/catalog', query: router.query });
    }
  }, [router]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Shop</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">Choose a category to shop</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Start by selecting the section you want to browse. Each category opens a tailored shopping view.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {SHOP_CATEGORY_OPTIONS.map((option) => (
          <Link
            key={option.href}
            href={option.href}
            className={`flex items-center justify-center rounded-3xl p-8 text-2xl font-bold uppercase tracking-wide shadow-sm transition ${option.color}`}
          >
            {option.label}
          </Link>
        ))}
      </section>
      <div className="mt-2 flex md:block md:pl-0 pl-4">
        <Link
          href="/shop/catalog"
          className="inline-flex items-center text-[#00CED1] hover:underline text-sm font-semibold px-3 py-1 rounded-full transition"
          style={{ marginLeft: 0 }}
        >
          Shop all
          <svg className="ml-1" width="16" height="16" fill="none" viewBox="0 0 20 20"><path d="M7 5l5 5-5 5" stroke="#00CED1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Link>
      </div>
    </div>
  );
}
