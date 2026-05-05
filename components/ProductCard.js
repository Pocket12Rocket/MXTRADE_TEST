import Link from 'next/link';

export default function ProductCard({ product }) {
  const imageSrc = product.primaryImage || product.images?.[0] || null;
  const conditionValue = `${product.gearCondition || ''} ${product.condition || ''}`.toLowerCase();
  const isNewItem = conditionValue.includes('new');
  const isSpecialActive = Boolean(product.isSpecialActive && Number(product.originalPrice) > Number(product.price));

  return (
    <Link href={`/product/${product.id}`} className="group block overflow-hidden rounded-3xl border border-slate-300 bg-[#eceff3] shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-200">
        {imageSrc ? (
          <img src={imageSrc} alt={product.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-300 text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">
            No image uploaded
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-slate-900/85 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
          {product.category}
        </span>
        {isNewItem ? (
          <span className="absolute right-3 top-3 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
            New
          </span>
        ) : null}
        {isSpecialActive ? (
          <span className="absolute right-3 top-10 rounded-full bg-amber-500 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
            {product.specialLabel || 'Special'}
          </span>
        ) : null}
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-900">{product.name}</h3>
        </div>
        {product.subcategory ? <p className="mt-1 text-sm text-slate-600">{product.subcategory}</p> : null}
        {/* Show suburb and city if available */}
        {(product.sellerSuburb || product.sellerCity) && (
          <p className="mt-1 text-xs text-slate-500">
            {product.sellerSuburb ? product.sellerSuburb : ''}
            {product.sellerSuburb && product.sellerCity ? ', ' : ''}
            {product.sellerCity ? product.sellerCity : ''}
          </p>
        )}
        <div className="mt-3">
          <p className="text-xl font-semibold text-slate-900">R{Number(product.price || 0).toFixed(2)}</p>
          {isSpecialActive ? (
            <p className="text-sm text-slate-500 line-through">R{Number(product.originalPrice || 0).toFixed(2)}</p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
