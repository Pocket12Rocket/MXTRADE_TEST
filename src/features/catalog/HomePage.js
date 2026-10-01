import Link from 'next/link';
import { useEffect, useState } from 'react';
import ProductCard from './ProductCard';
import CarouselControl from '@/components/CarouselControl';
import ServiceFeeNote from '@/components/ServiceFeeNote';
import { fetchNewProducts, fetchPopularProducts } from '@/lib/api/catalog';
import { reportError } from '@/lib/userMessage';

/**
 * Why: Home page. Each carousel asks the backend for exactly the items it shows (popular by
 * 7-day views, and new-this-week per category), so no full-catalog download is needed.
 * @returns {JSX.Element} The home page markup (popular carousel + three category carousels).
 */
export default function Home() {
  const [popularProducts, setPopularProducts] = useState([]);
  const [isLoadingPopular, setIsLoadingPopular] = useState(true);
  const [popularCarouselIndex, setPopularCarouselIndex] = useState(0);

  // New state for category carousels
  const [gearProducts, setGearProducts] = useState([]);
  const [partsProducts, setPartsProducts] = useState([]);
  const [accessoriesProducts, setAccessoriesProducts] = useState([]);
  const [isLoadingGear, setIsLoadingGear] = useState(true);
  const [isLoadingParts, setIsLoadingParts] = useState(true);
  const [isLoadingAccessories, setIsLoadingAccessories] = useState(true);
  const [gearCarouselIndex, setGearCarouselIndex] = useState(0);
  const [partsCarouselIndex, setPartsCarouselIndex] = useState(0);
  const [accessoriesCarouselIndex, setAccessoriesCarouselIndex] = useState(0);

  const maxGearCarouselIndex = Math.max(gearProducts.length - 3, 0);
  const maxPartsCarouselIndex = Math.max(partsProducts.length - 3, 0);
  const maxAccessoriesCarouselIndex = Math.max(accessoriesProducts.length - 3, 0);

  useEffect(() => {
    let isMounted = true;

    // Why: four small, cacheable backend reads in parallel, one per carousel.
    /**
     * Why: Loads the popular and new-in-category carousels.
     * @returns {Promise<void>}
     */
    const loadHomeCarousels = async () => {
      try {
        const [popular, gear, parts, accessories] = await Promise.all([
          fetchPopularProducts({ limit: 6 }),
          fetchNewProducts({ category: 'gear', limit: 6 }),
          fetchNewProducts({ category: 'parts', limit: 6 }),
          fetchNewProducts({ category: 'accessories', limit: 6 }),
        ]);
        if (!isMounted) return;

        setPopularProducts(popular);
        setGearProducts(gear);
        setPartsProducts(parts);
        setAccessoriesProducts(accessories);
      } catch (err) {
        // Why: leave lists empty (each carousel renders a "no products" state) but log the failure.
        reportError('home-carousels', err);
      } finally {
        if (isMounted) {
          setIsLoadingPopular(false);
          setIsLoadingGear(false);
          setIsLoadingParts(false);
          setIsLoadingAccessories(false);
        }
      }
    };

    loadHomeCarousels();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setGearCarouselIndex((currentValue) => Math.min(currentValue, maxGearCarouselIndex));
  }, [maxGearCarouselIndex]);
  useEffect(() => {
    setPartsCarouselIndex((currentValue) => Math.min(currentValue, maxPartsCarouselIndex));
  }, [maxPartsCarouselIndex]);
  useEffect(() => {
    setAccessoriesCarouselIndex((currentValue) =>
      Math.min(currentValue, maxAccessoriesCarouselIndex),
    );
  }, [maxAccessoriesCarouselIndex]);

  /**
   * Why: Scrolls the gear carousel back.
   */
  const handleGearPrevious = () => {
    setGearCarouselIndex((currentValue) => Math.max(currentValue - 1, 0));
  };
  /**
   * Why: Scrolls the gear carousel forward.
   */
  const handleGearNext = () => {
    setGearCarouselIndex((currentValue) => Math.min(currentValue + 1, maxGearCarouselIndex));
  };
  /**
   * Why: Scrolls the parts carousel back.
   */
  const handlePartsPrevious = () => {
    setPartsCarouselIndex((currentValue) => Math.max(currentValue - 1, 0));
  };
  /**
   * Why: Scrolls the parts carousel forward.
   */
  const handlePartsNext = () => {
    setPartsCarouselIndex((currentValue) => Math.min(currentValue + 1, maxPartsCarouselIndex));
  };
  /**
   * Why: Scrolls the accessories carousel back.
   */
  const handleAccessoriesPrevious = () => {
    setAccessoriesCarouselIndex((currentValue) => Math.max(currentValue - 1, 0));
  };
  /**
   * Why: Scrolls the accessories carousel forward.
   */
  const handleAccessoriesNext = () => {
    setAccessoriesCarouselIndex((currentValue) =>
      Math.min(currentValue + 1, maxAccessoriesCarouselIndex),
    );
  };

  const maxPopularCarouselIndex = Math.max(popularProducts.length - 3, 0);

  useEffect(() => {
    setPopularCarouselIndex((currentValue) => Math.min(currentValue, maxPopularCarouselIndex));
  }, [maxPopularCarouselIndex]);

  /**
   * Why: Scrolls the popular carousel back.
   */
  const handlePopularPrevious = () => {
    setPopularCarouselIndex((currentValue) => Math.max(currentValue - 1, 0));
  };

  /**
   * Why: Scrolls the popular carousel forward.
   */
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
          <CarouselControl
            direction="previous"
            label="Scroll popular products left"
            onClick={handlePopularPrevious}
            disabled={popularCarouselIndex === 0 || isLoadingPopular || popularProducts.length <= 3}
          />
          <div className="min-w-0 flex-1 overflow-hidden">
            {isLoadingPopular ? (
              <p className="text-sm text-slate-600">Loading popular products…</p>
            ) : popularProducts.length === 0 ? (
              <p className="text-sm text-slate-600">No user-listed products have clicks yet.</p>
            ) : (
              <div
                className="flex gap-6 transition-transform duration-300 ease-out"
                style={{
                  transform: `translateX(calc(-${popularCarouselIndex * (100 / 3)}% - ${popularCarouselIndex * 1.5}rem))`,
                }}
              >
                {popularProducts.map((product) => (
                  <div key={product.id} className="min-w-0 shrink-0 basis-1/3">
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            )}
          </div>
          <CarouselControl
            direction="next"
            label="Scroll popular products right"
            onClick={handlePopularNext}
            disabled={
              popularCarouselIndex >= maxPopularCarouselIndex ||
              isLoadingPopular ||
              popularProducts.length <= 3
            }
          />
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

        {/* ...existing code... */}
      </section>

      {/*
        === NEW: Category Carousels ===
        Remove the old 'This Week's New Products' section above if needed.
      */}

      {/* New Gear Items Carousel */}
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#40E0D0]">
              New Gear This Week
            </p>
            <Link
              href="/shop/gear"
              className="text-xs font-semibold uppercase tracking-[0.08em] text-white/90 hover:text-white flex items-center gap-1"
            >
              Browse all gear <span className="text-base">→</span>
            </Link>
          </div>
          <div className="mt-6 grid auto-cols-[82%] grid-flow-col gap-4 overflow-x-auto pb-2 sm:auto-cols-[48%] lg:hidden">
            {isLoadingGear ? (
              <p className="text-sm text-slate-200">Loading new gear…</p>
            ) : gearProducts.length === 0 ? (
              <p className="text-sm text-slate-200">No new gear listed in the last 7 days.</p>
            ) : (
              gearProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                  className="min-w-0 rounded-2xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm"
                >
                  <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-700/40">
                    {product.primaryThumbnail || product.primaryImage ? (
                      <img
                        src={product.primaryThumbnail || product.primaryImage}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">
                        No image uploaded
                      </div>
                    )}
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-semibold text-white">
                    {product.name}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.08em] text-slate-200">
                    {product.category} {product.subcategory ? `• ${product.subcategory}` : ''}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[#40E0D0]">
                    R{Number(product.price).toFixed(2)}
                  </p>
                  <ServiceFeeNote
                    serviceFee={product.serviceFee}
                    className="text-xs text-slate-300"
                  />
                  {product.isSpecialActive &&
                  Number(product.originalPrice) > Number(product.price) ? (
                    <p className="text-xs text-slate-300 line-through">
                      R{Number(product.originalPrice).toFixed(2)}
                    </p>
                  ) : null}
                </Link>
              ))
            )}
          </div>
          <div className="mt-6 hidden items-center gap-4 lg:flex">
            <CarouselControl
              direction="previous"
              label="Scroll new gear left"
              onClick={handleGearPrevious}
              disabled={gearCarouselIndex === 0 || isLoadingGear || gearProducts.length <= 3}
              tone="dark"
            />
            <div className="min-w-0 flex-1 overflow-hidden">
              {isLoadingGear ? (
                <p className="text-sm text-slate-200">Loading new gear…</p>
              ) : gearProducts.length === 0 ? (
                <p className="text-sm text-slate-200">No new gear listed in the last 7 days.</p>
              ) : (
                <div
                  className="flex gap-4 transition-transform duration-300 ease-out"
                  style={{
                    transform: `translateX(calc(-${gearCarouselIndex * (100 / 3)}% - ${gearCarouselIndex * 1}rem))`,
                  }}
                >
                  {gearProducts.map((product) => (
                    <Link
                      key={product.id}
                      href={`/product/${product.id}`}
                      className="min-w-0 shrink-0 basis-1/3 rounded-2xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm"
                    >
                      <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-700/40">
                        {product.primaryThumbnail || product.primaryImage ? (
                          <img
                            src={product.primaryThumbnail || product.primaryImage}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
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
                      <p className="mt-2 text-sm font-semibold text-[#40E0D0]">
                        R{Number(product.price).toFixed(2)}
                      </p>
                      <ServiceFeeNote
                        serviceFee={product.serviceFee}
                        className="text-xs text-slate-300"
                      />
                      {product.isSpecialActive &&
                      Number(product.originalPrice) > Number(product.price) ? (
                        <p className="text-xs text-slate-300 line-through">
                          R{Number(product.originalPrice).toFixed(2)}
                        </p>
                      ) : null}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <CarouselControl
              direction="next"
              label="Scroll new gear right"
              onClick={handleGearNext}
              disabled={
                gearCarouselIndex >= maxGearCarouselIndex ||
                isLoadingGear ||
                gearProducts.length <= 3
              }
              tone="dark"
            />
          </div>
        </div>
      </section>

      {/* New Parts Items Carousel */}
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#40E0D0]">
              New Parts This Week
            </p>
            <Link
              href="/shop/parts"
              className="text-xs font-semibold uppercase tracking-[0.08em] text-white/90 hover:text-white flex items-center gap-1"
            >
              Browse all parts <span className="text-base">→</span>
            </Link>
          </div>
          <div className="mt-6 grid auto-cols-[82%] grid-flow-col gap-4 overflow-x-auto pb-2 sm:auto-cols-[48%] lg:hidden">
            {isLoadingParts ? (
              <p className="text-sm text-slate-200">Loading new parts…</p>
            ) : partsProducts.length === 0 ? (
              <p className="text-sm text-slate-200">No new parts listed in the last 7 days.</p>
            ) : (
              partsProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                  className="min-w-0 rounded-2xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm"
                >
                  <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-700/40">
                    {product.primaryThumbnail || product.primaryImage ? (
                      <img
                        src={product.primaryThumbnail || product.primaryImage}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">
                        No image uploaded
                      </div>
                    )}
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-semibold text-white">
                    {product.name}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.08em] text-slate-200">
                    {product.category} {product.subcategory ? `• ${product.subcategory}` : ''}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[#40E0D0]">
                    R{Number(product.price).toFixed(2)}
                  </p>
                  <ServiceFeeNote
                    serviceFee={product.serviceFee}
                    className="text-xs text-slate-300"
                  />
                  {product.isSpecialActive &&
                  Number(product.originalPrice) > Number(product.price) ? (
                    <p className="text-xs text-slate-300 line-through">
                      R{Number(product.originalPrice).toFixed(2)}
                    </p>
                  ) : null}
                </Link>
              ))
            )}
          </div>
          <div className="mt-6 hidden items-center gap-4 lg:flex">
            <CarouselControl
              direction="previous"
              label="Scroll new parts left"
              onClick={handlePartsPrevious}
              disabled={partsCarouselIndex === 0 || isLoadingParts || partsProducts.length <= 3}
              tone="dark"
            />
            <div className="min-w-0 flex-1 overflow-hidden">
              {isLoadingParts ? (
                <p className="text-sm text-slate-200">Loading new parts…</p>
              ) : partsProducts.length === 0 ? (
                <p className="text-sm text-slate-200">No new parts listed in the last 7 days.</p>
              ) : (
                <div
                  className="flex gap-4 transition-transform duration-300 ease-out"
                  style={{
                    transform: `translateX(calc(-${partsCarouselIndex * (100 / 3)}% - ${partsCarouselIndex * 1}rem))`,
                  }}
                >
                  {partsProducts.map((product) => (
                    <Link
                      key={product.id}
                      href={`/product/${product.id}`}
                      className="min-w-0 shrink-0 basis-1/3 rounded-2xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm"
                    >
                      <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-700/40">
                        {product.primaryThumbnail || product.primaryImage ? (
                          <img
                            src={product.primaryThumbnail || product.primaryImage}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
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
                      <p className="mt-2 text-sm font-semibold text-[#40E0D0]">
                        R{Number(product.price).toFixed(2)}
                      </p>
                      <ServiceFeeNote
                        serviceFee={product.serviceFee}
                        className="text-xs text-slate-300"
                      />
                      {product.isSpecialActive &&
                      Number(product.originalPrice) > Number(product.price) ? (
                        <p className="text-xs text-slate-300 line-through">
                          R{Number(product.originalPrice).toFixed(2)}
                        </p>
                      ) : null}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <CarouselControl
              direction="next"
              label="Scroll new parts right"
              onClick={handlePartsNext}
              disabled={
                partsCarouselIndex >= maxPartsCarouselIndex ||
                isLoadingParts ||
                partsProducts.length <= 3
              }
              tone="dark"
            />
          </div>
        </div>
      </section>

      {/* New Accessories Items Carousel */}
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#40E0D0]">
              New Accessories This Week
            </p>
            <Link
              href="/shop/accessories"
              className="text-xs font-semibold uppercase tracking-[0.08em] text-white/90 hover:text-white flex items-center gap-1"
            >
              Browse all accessories <span className="text-base">→</span>
            </Link>
          </div>
          <div className="mt-6 grid auto-cols-[82%] grid-flow-col gap-4 overflow-x-auto pb-2 sm:auto-cols-[48%] lg:hidden">
            {isLoadingAccessories ? (
              <p className="text-sm text-slate-200">Loading new accessories…</p>
            ) : accessoriesProducts.length === 0 ? (
              <p className="text-sm text-slate-200">
                No new accessories listed in the last 7 days.
              </p>
            ) : (
              accessoriesProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                  className="min-w-0 rounded-2xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm"
                >
                  <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-700/40">
                    {product.primaryThumbnail || product.primaryImage ? (
                      <img
                        src={product.primaryThumbnail || product.primaryImage}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">
                        No image uploaded
                      </div>
                    )}
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-semibold text-white">
                    {product.name}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.08em] text-slate-200">
                    {product.category} {product.subcategory ? `• ${product.subcategory}` : ''}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[#40E0D0]">
                    R{Number(product.price).toFixed(2)}
                  </p>
                  <ServiceFeeNote
                    serviceFee={product.serviceFee}
                    className="text-xs text-slate-300"
                  />
                  {product.isSpecialActive &&
                  Number(product.originalPrice) > Number(product.price) ? (
                    <p className="text-xs text-slate-300 line-through">
                      R{Number(product.originalPrice).toFixed(2)}
                    </p>
                  ) : null}
                </Link>
              ))
            )}
          </div>
          <div className="mt-6 hidden items-center gap-4 lg:flex">
            <CarouselControl
              direction="previous"
              label="Scroll new accessories left"
              onClick={handleAccessoriesPrevious}
              disabled={
                accessoriesCarouselIndex === 0 ||
                isLoadingAccessories ||
                accessoriesProducts.length <= 3
              }
              tone="dark"
            />
            <div className="min-w-0 flex-1 overflow-hidden">
              {isLoadingAccessories ? (
                <p className="text-sm text-slate-200">Loading new accessories…</p>
              ) : accessoriesProducts.length === 0 ? (
                <p className="text-sm text-slate-200">
                  No new accessories listed in the last 7 days.
                </p>
              ) : (
                <div
                  className="flex gap-4 transition-transform duration-300 ease-out"
                  style={{
                    transform: `translateX(calc(-${accessoriesCarouselIndex * (100 / 3)}% - ${accessoriesCarouselIndex * 1}rem))`,
                  }}
                >
                  {accessoriesProducts.map((product) => (
                    <Link
                      key={product.id}
                      href={`/product/${product.id}`}
                      className="min-w-0 shrink-0 basis-1/3 rounded-2xl border border-white/20 bg-black/35 p-4 backdrop-blur-sm"
                    >
                      <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-700/40">
                        {product.primaryThumbnail || product.primaryImage ? (
                          <img
                            src={product.primaryThumbnail || product.primaryImage}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
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
                      <p className="mt-2 text-sm font-semibold text-[#40E0D0]">
                        R{Number(product.price).toFixed(2)}
                      </p>
                      <ServiceFeeNote
                        serviceFee={product.serviceFee}
                        className="text-xs text-slate-300"
                      />
                      {product.isSpecialActive &&
                      Number(product.originalPrice) > Number(product.price) ? (
                        <p className="text-xs text-slate-300 line-through">
                          R{Number(product.originalPrice).toFixed(2)}
                        </p>
                      ) : null}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <CarouselControl
              direction="next"
              label="Scroll new accessories right"
              onClick={handleAccessoriesNext}
              disabled={
                accessoriesCarouselIndex >= maxAccessoriesCarouselIndex ||
                isLoadingAccessories ||
                accessoriesProducts.length <= 3
              }
              tone="dark"
            />
          </div>
        </div>
      </section>

      {/* Trade-In section hidden for now. Uncomment to restore in a future update.
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
        */}
    </div>
  );
}
