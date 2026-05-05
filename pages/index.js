import Link from 'next/link';
import { useEffect, useState } from 'react';
import ProductCard from '../components/ProductCard';
import { fetchMostClickedProducts, fetchThisWeeksNewProducts } from '../lib/firestoreHelpers';

export default function Home() {
  const [thisWeeksProducts, setThisWeeksProducts] = useState([]);
  const [isLoadingThisWeek, setIsLoadingThisWeek] = useState(true);
  const [thisWeekCarouselIndex, setThisWeekCarouselIndex] = useState(0);
  const [popularProducts, setPopularProducts] = useState([]);
  const [isLoadingPopular, setIsLoadingPopular] = useState(true);
  const [popularCarouselIndex, setPopularCarouselIndex] = useState(0);

  const maxThisWeekCarouselIndex = Math.max(thisWeeksProducts.length - 3, 0);
  const maxPopularCarouselIndex = Math.max(popularProducts.length - 3, 0);

  useEffect(() => {
    fetchThisWeeksNewProducts(5)
      .then(setThisWeeksProducts)
      .finally(() => setIsLoadingThisWeek(false));

    fetchMostClickedProducts(10)
      .then(setPopularProducts)
      .finally(() => setIsLoadingPopular(false));
  }, []);

  useEffect(() => {
    setThisWeekCarouselIndex((currentValue) => Math.min(currentValue, maxThisWeekCarouselIndex));
  }, [maxThisWeekCarouselIndex]);

  useEffect(() => {
    setPopularCarouselIndex((currentValue) => Math.min(currentValue, maxPopularCarouselIndex));
  }, [maxPopularCarouselIndex]);

  const handleThisWeekPrevious = () => {
    setThisWeekCarouselIndex((currentValue) => Math.max(currentValue - 1, 0));
  };

  const handleThisWeekNext = () => {
    setThisWeekCarouselIndex((currentValue) => Math.min(currentValue + 1, maxThisWeekCarouselIndex));
  };

  const handlePopularPrevious = () => {
    setPopularCarouselIndex((currentValue) => Math.max(currentValue - 1, 0));
  };

  const handlePopularNext = () => {
    setPopularCarouselIndex((currentValue) => Math.min(currentValue + 1, maxPopularCarouselIndex));
  };

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Featured</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">Popular this week</h2>
          </div>
          <Link href="/shop" className="text-sm font-medium text-[#00C5CD] hover:text-[#00CED1]">
            Browse full catalog →
          </Link>
        </div>
        <div className="mt-6 grid auto-cols-[82%] grid-flow-col gap-4 overflow-x-auto pb-2 sm:auto-cols-[48%] lg:hidden">
          {isLoadingPopular ? (
            <p className="text-sm text-slate-600">Loading popular products…</p>
          ) : popularProducts.length === 0 ? (
            <p className="text-sm text-slate-600">No user-listed products have clicks yet.</p>
          ) : (
            popularProducts.map((product) => <ProductCard key={product.id} product={product} />)
          )}
        </div>
        <div className="mt-8 hidden items-center gap-4 lg:flex">
          <button
            type="button"
            onClick={handlePopularPrevious}
            disabled={popularCarouselIndex === 0 || isLoadingPopular || popularProducts.length <= 3}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD] disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            aria-label="Scroll popular products left"
          >
            <span className="text-xl leading-none">‹</span>
          </button>
          <div className="min-w-0 flex-1 overflow-hidden">
          {isLoadingPopular ? (
            <p className="text-sm text-slate-600">Loading popular products…</p>
          ) : popularProducts.length === 0 ? (
            <p className="text-sm text-slate-600">No user-listed products have clicks yet.</p>
          ) : (
            <div
              className="flex gap-6 transition-transform duration-300 ease-out"
              style={{ transform: `translateX(calc(-${popularCarouselIndex * (100 / 3)}% - ${popularCarouselIndex * 1.5}rem))` }}
            >
              {popularProducts.map((product) => (
                <div key={product.id} className="min-w-0 shrink-0 basis-1/3">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          )}
          </div>
          <button
            type="button"
            onClick={handlePopularNext}
            disabled={popularCarouselIndex >= maxPopularCarouselIndex || isLoadingPopular || popularProducts.length <= 3}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300 text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD] disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
            aria-label="Scroll popular products right"
          >
            <span className="text-xl leading-none">›</span>
          </button>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[2rem] bg-slate-900 text-white shadow-xl">
        <div className="absolute inset-0">
          <img
            src="/images/background image.jpg"
            alt="Performance vehicle"
            className="h-full w-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-[#00CED1]/55" />
        </div>

        <div className="relative px-6 py-14 sm:px-10 lg:px-14">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#40E0D0]">This Week's New Products</p>
            <Link href="/shop" className="text-xs font-semibold uppercase tracking-[0.08em] text-white/90 hover:text-white flex items-center gap-1">
              Browse full catalog <span className="text-base">→</span>
            </Link>
          </div>

          <div className="mt-6 grid auto-cols-[82%] grid-flow-col gap-4 overflow-x-auto pb-2 sm:auto-cols-[48%] lg:hidden">
            {isLoadingThisWeek ? (
              <p className="text-sm text-slate-200">Loading latest products…</p>
            ) : thisWeeksProducts.length === 0 ? (
              <p className="text-sm text-slate-200">No new unsold products listed in the last 7 days.</p>
            ) : (
              thisWeeksProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                  className="min-w-0 rounded-2xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm"
                >
                  <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-700/40">
                    {product.primaryImage || product.images?.[0] ? (
                      <img src={product.primaryImage || product.images?.[0]} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">
                        No image uploaded
                      </div>
                    )}
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-semibold text-white">{product.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.08em] text-slate-200">
                    {product.category} {product.subcategory ? `• ${product.subcategory}` : ''}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[#40E0D0]">R{Number(product.price).toFixed(2)}</p>
                  {product.isSpecialActive && Number(product.originalPrice) > Number(product.price) ? (
                    <p className="text-xs text-slate-300 line-through">R{Number(product.originalPrice).toFixed(2)}</p>
                  ) : null}
                </Link>
              ))
            )}
          </div>

          <div className="mt-6 hidden items-center gap-4 lg:flex">
            <button
              type="button"
              onClick={handleThisWeekPrevious}
              disabled={thisWeekCarouselIndex === 0 || isLoadingThisWeek || thisWeeksProducts.length <= 3}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 text-white hover:border-[#40E0D0] hover:text-[#40E0D0] disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/30"
              aria-label="Scroll new products left"
            >
              <span className="text-xl leading-none">‹</span>
            </button>
            <div className="min-w-0 flex-1 overflow-hidden">
              {isLoadingThisWeek ? (
                <p className="text-sm text-slate-200">Loading latest products…</p>
              ) : thisWeeksProducts.length === 0 ? (
                <p className="text-sm text-slate-200">No new unsold products listed in the last 7 days.</p>
              ) : (
                <div
                  className="flex gap-4 transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(calc(-${thisWeekCarouselIndex * (100 / 3)}% - ${thisWeekCarouselIndex * 1}rem))` }}
                >
                  {thisWeeksProducts.map((product) => (
                    <Link
                      key={product.id}
                      href={`/product/${product.id}`}
                      className="min-w-0 shrink-0 basis-1/3 rounded-2xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm"
                    >
                      <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-700/40">
                        {product.primaryImage || product.images?.[0] ? (
                          <img src={product.primaryImage || product.images?.[0]} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">
                            No image uploaded
                          </div>
                        )}
                      </div>
                      <p className="mt-3 text-sm font-semibold text-white">{product.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.08em] text-slate-200">
                        {product.category} {product.subcategory ? `• ${product.subcategory}` : ''}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[#40E0D0]">R{Number(product.price).toFixed(2)}</p>
                      {product.isSpecialActive && Number(product.originalPrice) > Number(product.price) ? (
                        <p className="text-xs text-slate-300 line-through">R{Number(product.originalPrice).toFixed(2)}</p>
                      ) : null}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleThisWeekNext}
              disabled={thisWeekCarouselIndex >= maxThisWeekCarouselIndex || isLoadingThisWeek || thisWeeksProducts.length <= 3}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 text-white hover:border-[#40E0D0] hover:text-[#40E0D0] disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/30"
              aria-label="Scroll new products right"
            >
              <span className="text-xl leading-none">›</span>
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-300 bg-[#e5e7eb] px-6 py-8 shadow-sm sm:px-8 lg:px-10">
        <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="relative min-h-[280px] overflow-hidden rounded-[1.75rem] border border-slate-300 bg-[#eceff3]">
            <div className="absolute left-4 top-4 z-20 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold uppercase tracking-[0.06em] text-slate-700 shadow-sm">
              Your old gear
            </div>

            <div className="absolute bottom-5 left-6 z-10 w-[34%] rotate-[-14deg]">
              <img
                src="/images/Gearne Boots 2.png"
                alt="Old riding gear"
                className="h-full w-full rounded-[1.5rem] object-contain shadow-xl"
              />
            </div>

            <div className="absolute left-[30%] top-[26%] h-32 w-32 rounded-full bg-[#00CED1]/12 blur-3xl" />
            <div className="absolute left-[36%] top-[38%] h-28 w-28 rounded-full border-[14px] border-dotted border-[#00CED1]/25 opacity-80" />

            <svg viewBox="0 0 220 120" className="absolute bottom-14 left-[32%] z-20 h-24 w-40 text-[#00C5CD]" fill="none">
              <path
                d="M16 96 C 30 38, 88 28, 118 66 C 128 78, 136 84, 150 84"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <path d="M136 66 L 152 84 L 134 94" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            <div className="absolute left-[42%] top-[2%] z-20 w-[38%] rotate-[6deg]">
              <img
                src="/images/Gearne Boots.png"
                alt="New riding gear"
                className="h-full w-full rounded-[1.75rem] object-contain shadow-2xl"
              />
            </div>

            <div className="absolute bottom-8 left-[54%] z-20 rounded-xl border border-[#00C5CD]/40 bg-white px-4 py-2 text-sm font-semibold uppercase tracking-[0.06em] text-[#00C5CD] shadow-sm">
              Your new gear
            </div>
          </div>

          <div className="space-y-4 lg:pl-4">
            <div className="flex items-center gap-2">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Gear Trade-In Program</p>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">Coming Soon</span>
            </div>
            <h2 className="max-w-xl text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
              Trade in Your Gear &amp; Upgrade for Less!
            </h2>
            <p className="max-w-lg text-base leading-7 text-slate-700 sm:text-lg">
              Get credit towards your next piece of riding gear by trading in your old setup. It&apos;s fast, practical, and keeps quality kit moving.
            </p>
            <button
              disabled
              className="inline-flex cursor-not-allowed rounded-full bg-slate-300 px-6 py-3 text-sm font-semibold text-slate-400"
            >
              Start Your Trade-In Now!
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-300 bg-[#e5e7eb] p-6 sm:p-8">
        <div className="grid gap-6 md:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Why MXTrade</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">Marketplace trust layer</h3>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Admin-reviewed listings</p>
            <p className="mt-2 text-sm text-slate-600">Every product is approved before going live.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Detailed product data</p>
            <p className="mt-2 text-sm text-slate-600">Images, specs, and pricing are visible before checkout.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Focused categories</p>
            <p className="mt-2 text-sm text-slate-600">Shop by Gear, Accessories, or Parts with cleaner navigation paths.</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-300 bg-slate-900 p-6 text-white sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#40E0D0]">Built for serious buyers</p>
            <h3 className="mt-3 text-2xl font-semibold">Need support choosing the right part?</h3>
            <p className="mt-2 text-slate-300">Use product specs and category filters to compare options before checkout.</p>
          </div>
          <Link href="/faq" className="rounded-full bg-[#00CED1] px-6 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-white hover:bg-[#00C5CD]">
            View buying FAQ
          </Link>
        </div>
      </section>
    </div>
  );
}
