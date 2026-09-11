import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const SHOP_CATEGORY_OPTIONS = [
  {
    href: '/shop/catalog?category=Gear',
    label: 'Gear',
    image: '/images/Gear.jpg',
    alt: 'Motocross riding gear',
  },
  {
    href: '/shop/catalog?category=Accessories',
    label: 'Accessories',
    image: '/images/Accessories.jpg',
    alt: 'Dirt bike accessories',
  },
  {
    href: '/shop/catalog?category=Parts',
    label: 'Bike Parts',
    image: '/images/Bik Parts.jpg',
    alt: 'Dirt bike parts',
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
      <section className="grid gap-5 md:grid-cols-3">
        {SHOP_CATEGORY_OPTIONS.map((option) => (
          <Link
            key={option.href}
            href={option.href}
            className="group relative flex min-h-56 items-center justify-center overflow-hidden rounded-3xl bg-slate-900 p-8 text-center text-2xl font-bold uppercase tracking-wide text-white shadow-sm transition hover:shadow-lg"
          >
            <img
              src={option.image}
              alt={option.alt}
              className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-85"
            />
            <span className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-[#00CED1]/70 transition group-hover:from-black/80 group-hover:via-black/55 group-hover:to-[#00CED1]/60" />
            <span className="relative z-10 drop-shadow-md">{option.label}</span>
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
