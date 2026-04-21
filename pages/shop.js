import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const SHOP_CATEGORY_OPTIONS = [
  {
    href: '/shop/catalog?category=Gear',
    title: 'Shop Gear',
    description: 'Browse riding gear, helmets, boots, jerseys, and combos.',
  },
  {
    href: '/shop/catalog?category=Accessories',
    title: 'Shop Accessories',
    description: 'Explore tools, maintenance items, straps, bags, and more.',
  },
  {
    href: '/shop/catalog?category=Parts',
    title: 'Shop Dirt Bike Parts',
    description: 'Find parts across engine, suspension, brakes, wheels, and controls.',
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
            className="group rounded-3xl border border-slate-300 bg-[#eceff3] p-6 shadow-sm transition hover:border-[#00CED1] hover:bg-white"
          >
            <h2 className="text-xl font-semibold text-slate-900 group-hover:text-[#00C5CD]">{option.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{option.description}</p>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.1em] text-[#00C5CD]">Open category</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
