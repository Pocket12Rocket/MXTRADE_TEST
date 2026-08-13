import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { fetchProductById, incrementProductClickCount } from '../../lib/firestoreHelpers';
import { useCart } from '../../lib/cartContext';

export default function ProductDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addedToCart, setAddedToCart] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(-1);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [deliveryInfoOpen, setDeliveryInfoOpen] = useState(false);
  const galleryRef = useRef(null);
  const addToCartLockRef = useRef(false);

  const productImages = product?.images?.length
    ? product.images
    : product?.primaryImage
      ? [product.primaryImage]
      : [];

  const normalizedCategory = (product?.category || '').toString().trim().toLowerCase();
  const isGearProduct = normalizedCategory === 'gear';
  const legacyGearMetaMatch = (product?.description || '').match(
    /Condition:\s*([^\.]+)\.\s*Brand:\s*([^\.]+)\.\s*Size:\s*([^\.]+)\.?/i
  );
  const derivedCondition = (product?.gearCondition || legacyGearMetaMatch?.[1] || '').trim();
  const derivedBrand = (product?.gearBrand || legacyGearMetaMatch?.[2] || '').trim();
  const derivedSize = (product?.gearSize || legacyGearMetaMatch?.[3] || '').trim();

  const specsFromProduct = Array.isArray(product?.specifications) ? product.specifications : [];
  const hasConditionSpec = specsFromProduct.some((item) => /^condition\s*:/i.test(item || ''));
  const hasBrandSpec = specsFromProduct.some((item) => /^brand\s*:/i.test(item || ''));
  const hasSizeSpec = specsFromProduct.some((item) => /^size\s*:/i.test(item || ''));

  const displaySpecifications = isGearProduct
    ? [
        ...specsFromProduct,
        ...(derivedCondition && !hasConditionSpec ? [`Condition: ${derivedCondition}`] : []),
        ...(derivedBrand && !hasBrandSpec ? [`Brand: ${derivedBrand}`] : []),
        ...(derivedSize && !hasSizeSpec ? [`Size: ${derivedSize}`] : []),
      ]
    : specsFromProduct;

  const displayDescription =
    isGearProduct && legacyGearMetaMatch
      ? ''
      : product?.description || '';
  const isSpecialActive = Boolean(product?.isSpecialActive && Number(product?.originalPrice) > Number(product?.price));

  function handleAddToCart() {
    if (addToCartLockRef.current) {
      return;
    }

    addToCartLockRef.current = true;
    addItem(product);
    setAddedToCart(true);

    setTimeout(() => {
      setAddedToCart(false);
      addToCartLockRef.current = false;
    }, 2000);
  }

  function handleBackClick() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/shop/catalog');
  }

  function handleOpenImage(index) {
    setActiveImageIndex(index);
    setLightboxZoom(1);
  }

  function handleCloseLightbox() {
    setActiveImageIndex(-1);
    setLightboxZoom(1);
  }

  function handleNextImage() {
    if (!productImages.length) {
      return;
    }

    const gallery = galleryRef.current;
    if (gallery) {
      const firstImageCard = gallery.querySelector('button');
      if (firstImageCard) {
        const scrollAmount = firstImageCard.getBoundingClientRect().width + 12;
        gallery.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
      return;
    }

    setLightboxZoom(1);
  }

  function handlePreviousImage() {
    if (!productImages.length) {
      return;
    }

    const gallery = galleryRef.current;
    if (gallery) {
      const firstImageCard = gallery.querySelector('button');
      if (firstImageCard) {
        const scrollAmount = firstImageCard.getBoundingClientRect().width + 12;
        gallery.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      }
      return;
    }

    setLightboxZoom(1);
  }

  function handleLightboxNext() {
    if (!productImages.length) {
      return;
    }

    setActiveImageIndex((currentValue) => (currentValue + 1) % productImages.length);
    setLightboxZoom(1);
  }

  function handleLightboxPrevious() {
    if (!productImages.length) {
      return;
    }

    setActiveImageIndex((currentValue) => (currentValue - 1 + productImages.length) % productImages.length);
    setLightboxZoom(1);
  }

  function handleImageZoomToggle() {
    setLightboxZoom((currentValue) => (currentValue > 1 ? 1 : 2));
  }

  useEffect(() => {
    if (!id) return;

    fetchProductById(id)
      .then((result) => {
        setProduct(result);

        if (result?.id) {
          incrementProductClickCount(result.id).catch(() => {
            // Non-blocking analytics update.
          });
        }

        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (activeImageIndex < 0) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleCloseLightbox();
      }

      if (event.key === 'ArrowRight') {
        handleLightboxNext();
      }

      if (event.key === 'ArrowLeft') {
        handleLightboxPrevious();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeImageIndex, productImages.length]);

  if (loading) {
    return <p>Loading product…</p>;
  }

  if (!product) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600">Product not found.</p>
        <Link href="/shop/catalog" className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-3 text-white hover:bg-slate-800">
          Return to shop
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <button
          type="button"
          onClick={handleBackClick}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:bg-slate-50"
        >
          <span aria-hidden="true">&larr;</span>
          Back
        </button>
      </div>

      <div className="flex flex-col rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.08)] sm:p-6">
        <div className="mx-auto w-full max-w-3xl">
          {productImages.length ? (
            <div className="relative">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={handlePreviousImage}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
                >
                  ‹
                </button>

                <div className="relative flex-1 overflow-hidden">
                  <div ref={galleryRef} className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:overflow-x-hidden">
                    {productImages.map((src, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleOpenImage(index)}
                        className="group relative aspect-[4/3] w-[85%] shrink-0 snap-center overflow-hidden rounded-2xl bg-slate-100 text-left shadow-sm transition hover:shadow-md sm:w-[70%] md:w-[calc(33.333%-0.67rem)]"
                      >
                        <img src={src} alt={`${product.name} ${index + 1}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                        <span className="absolute inset-x-0 bottom-0 bg-black/45 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-white opacity-0 transition group-hover:opacity-100">
                          Click to enlarge
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Next image"
                  onClick={handleNextImage}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
                >
                  ›
                </button>
              </div>
            </div>
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-slate-200 text-sm font-semibold uppercase tracking-[0.1em] text-slate-600">
              No image uploaded
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-1 flex-col gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-slate-900">{product.name}</h1>
            {(product.sellerSuburb || product.sellerCity) && (
              <p className="text-xs text-slate-500">
                {product.sellerSuburb ? product.sellerSuburb : ''}
                {product.sellerSuburb && product.sellerCity ? ', ' : ''}
                {product.sellerCity ? product.sellerCity : ''}
              </p>
            )}
          </div>

          <div className="pt-1">
            <p className="text-4xl font-semibold tracking-[-0.04em] text-slate-900">R{Number(product.price).toFixed(2)}</p>
            {isSpecialActive ? (
              <div className="mt-2 flex items-center gap-2">
                <p className="text-sm text-slate-500 line-through">R{Number(product.originalPrice).toFixed(2)}</p>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-600">{product.specialLabel || 'Special'}</p>
              </div>
            ) : null}
          </div>

          {displayDescription ? <p className="text-slate-600">{displayDescription}</p> : null}

          {displaySpecifications.length ? (
            <div className="space-y-2 pt-2">
              <h2 className="text-xl font-semibold text-slate-900">Specifications</h2>
              <ul className="list-disc space-y-2 pl-5 text-slate-600">
                {displaySpecifications.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-auto pt-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#00CED1]">
              <span>Delivery</span>
              <div className="group relative inline-flex">
                <button
                  type="button"
                  aria-label="More delivery information"
                  onClick={() => setDeliveryInfoOpen((currentValue) => !currentValue)}
                  onMouseEnter={() => setDeliveryInfoOpen(true)}
                  onMouseLeave={() => setDeliveryInfoOpen(false)}
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-[#00CED1] bg-[#E6FEFF] text-[10px] font-bold text-[#00CED1] transition hover:bg-[#D7FBFC] focus:outline-none focus:ring-2 focus:ring-[#00CED1]/40"
                >
                  ?
                </button>
                {(deliveryInfoOpen || undefined) && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-72 -translate-x-1/2 rounded-xl border border-[#00CED1]/30 bg-white p-3 text-left text-xs leading-5 text-slate-700 shadow-lg md:w-80">
                    <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-[#00CED1]/30 bg-white" />
                    Nationwide delivery: R150 per seller added at checkout. Multiple items from the same seller share one delivery fee.
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            className={`mt-4 w-full rounded-2xl px-5 py-3 text-sm font-bold uppercase tracking-[0.12em] transition ${
              addedToCart
                ? 'bg-green-500 text-white shadow-lg shadow-green-500/20'
                : 'bg-[#00CED1] text-white shadow-lg shadow-[#00CED1]/25 hover:-translate-y-0.5 hover:bg-[#00C5CD]'
            }`}
          >
            {addedToCart ? 'Added to cart!' : 'Add to cart'}
          </button>
        </div>
      </div>
      {error ? <p className="text-red-600">{error}</p> : null}

      {activeImageIndex >= 0 && productImages[activeImageIndex] ? (
        <div
          className="fixed inset-0 z-50 bg-black/90 px-4 py-6"
          role="dialog"
          aria-modal="true"
          onClick={handleCloseLightbox}
        >
          <div className="relative mx-auto flex h-full max-w-5xl items-center justify-center" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              aria-label="Close image"
              onClick={handleCloseLightbox}
              className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white backdrop-blur-sm hover:bg-white/20"
            >
              ×
            </button>

            <button
              type="button"
              aria-label="Previous image"
              onClick={handleLightboxPrevious}
              className="absolute left-2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl text-white backdrop-blur-sm hover:bg-white/20"
            >
              ‹
            </button>

            <div className="relative max-h-[80vh] max-w-[90vw] overflow-hidden rounded-2xl bg-slate-900 shadow-2xl">
              <img
                src={productImages[activeImageIndex]}
                alt={`${product.name} ${activeImageIndex + 1}`}
                className="max-h-[80vh] max-w-[90vw] object-contain transition-transform duration-200"
                style={{ transform: `scale(${lightboxZoom})` }}
              />
            </div>

            <button
              type="button"
              aria-label="Next image"
              onClick={handleLightboxNext}
              className="absolute right-2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl text-white backdrop-blur-sm hover:bg-white/20"
            >
              ›
            </button>

            <button
              type="button"
              onClick={handleImageZoomToggle}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white backdrop-blur-sm hover:bg-white/20"
            >
              {lightboxZoom > 1 ? 'Fit' : 'Zoom'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
