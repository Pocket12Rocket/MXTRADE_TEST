import { useEffect, useState } from 'react';
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
    addItem(product);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
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

    setActiveImageIndex((currentValue) => (currentValue + 1) % productImages.length);
    setLightboxZoom(1);
  }

  function handlePreviousImage() {
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
        handleNextImage();
      }

      if (event.key === 'ArrowLeft') {
        handlePreviousImage();
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
    <div className="space-y-10">
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

      {/* Seller badge display at top of product details */}
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            {productImages.map((src, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleOpenImage(index)}
                className="group relative aspect-[4/3] overflow-hidden rounded-3xl bg-slate-100 text-left"
              >
                <img src={src} alt={`${product.name} ${index + 1}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                <span className="absolute inset-x-0 bottom-0 bg-black/45 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white opacity-0 transition group-hover:opacity-100">
                  Click to enlarge
                </span>
              </button>
            ))}
            {!productImages.length ? (
              <div className="aspect-[4/3] rounded-3xl bg-slate-200 sm:col-span-2">
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold uppercase tracking-[0.1em] text-slate-600">
                  No image uploaded
                </div>
              </div>
            ) : null}
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">{product.category}</p>
            <div className="flex items-center gap-2 mt-3">
              <h1 className="text-3xl font-semibold text-slate-900">{product.name}</h1>
            </div>
            {/* Seller suburb and city */}
            {(product.sellerSuburb || product.sellerCity) && (
              <p className="mt-2 text-xs text-slate-500">
                {product.sellerSuburb ? product.sellerSuburb : ''}
                {product.sellerSuburb && product.sellerCity ? ', ' : ''}
                {product.sellerCity ? product.sellerCity : ''}
              </p>
            )}
            {displayDescription ? <p className="mt-4 text-slate-600">{displayDescription}</p> : null}
            {displaySpecifications.length ? (
              <div className="mt-6 space-y-2">
                <h2 className="text-xl font-semibold text-slate-900">Specifications</h2>
                <ul className="list-disc space-y-2 pl-5 text-slate-600">
                  {displaySpecifications.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Price</p>
          <p className="mt-2 text-4xl font-semibold text-slate-900">R{Number(product.price).toFixed(2)}</p>
          {isSpecialActive ? (
            <div className="mt-2">
              <p className="text-sm text-slate-500 line-through">R{Number(product.originalPrice).toFixed(2)}</p>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-600">{product.specialLabel || 'Special'}</p>
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleAddToCart}
            className={`mt-8 w-full rounded-3xl px-5 py-3 text-sm font-semibold uppercase tracking-[0.08em] transition ${
              addedToCart
                ? 'bg-green-500 text-white'
                : 'bg-[#00CED1] text-white hover:bg-[#00C5CD]'
            }`}
          >
            {addedToCart ? 'Added to cart!' : 'Add to cart'}
          </button>
          <p className="mt-6 text-sm text-slate-600">Your cart is saved locally. Checkout will process through PayFast.</p>
        </aside>
      </div>
      {error ? <p className="text-red-600">{error}</p> : null}

      {activeImageIndex >= 0 && productImages[activeImageIndex] ? (
        <div
          className="fixed inset-0 z-50 bg-black/90 px-4 py-6"
          role="dialog"
          aria-modal="true"
          onClick={handleCloseLightbox}
        >
          {/* ...existing code... */}
        </div>
      ) : null}
    </div>
  );
}
