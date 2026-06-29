import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
// Tooltip for selling price info
function SellingPriceInfo({ price }) {
  const [show, setShow] = useState(false);
  if (!price || isNaN(Number(price)) || Number(price) <= 0) return null;
  const p = Number(price);
  let markup = 0.20;
  if (p > 999) markup = 0.11;
  else if (p >= 501) markup = 0.15;
  const sellingPrice = (p + p * markup).toFixed(2);
  return (
    <div className="flex items-center gap-2 mt-1 text-xs text-red-600">
      <span>
        Selling price (incl. markup): R {sellingPrice}
      </span>
      <span className="relative flex items-center">
        <span
          tabIndex={0}
          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold cursor-pointer border border-slate-300 hover:bg-slate-300 focus:bg-slate-300 focus:outline-none"
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}
          onFocus={() => setShow(true)}
          onBlur={() => setShow(false)}
        >
          ?
        </span>
        {show && (
          <span
            className="absolute left-6 top-1 z-10 w-64 rounded-lg bg-white border border-slate-300 p-3 text-xs text-slate-700 shadow-lg"
          >
            The selling price includes the Fast Sport transaction fee. This is the final amount the buyer will pay, excluding shipping costs.<br /><br />
            The price entered by you (the seller) is the amount you will receive from the sale.
          </span>
        )}
      </span>
    </div>
  );
}
import useAuth from '../../lib/useAuth';
import { fetchGearBrandOptions, submitProductRequest } from '../../lib/firestoreHelpers';
import { DIRT_BIKE_CATEGORIES, GEAR_BRAND_OPTIONS, GEAR_CONDITION_OPTIONS, GEAR_ITEM_OPTIONS } from '../../lib/dirtBikeCategories';

const SELL_CATEGORY_OPTIONS = [
  { value: 'Gear', label: 'Gear' },
  { value: 'Parts', label: 'Dirt Bike Parts' },
  { value: 'Accessories', label: 'Accessories' },
];

const ALPHA_SIZE_GEAR_ITEMS = ['Helmet', 'Jersey', 'Socks', 'Protection'];

const ALPHA_SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', 'Youth S', 'Youth M', 'Youth L', 'Youth XL'];

const PANTS_SIZE_OPTIONS = ['4', '6', '8', '10', '12', '14', '22', '24', '26', '28', '30', '32', '34', '36', '38', '40', '42'];

const BOOTS_SIZE_OPTIONS = ['UK1', 'UK2', 'UK3', 'UK4', 'UK5', 'UK6', 'UK7', 'UK8', 'UK9', 'UK10', 'UK11', 'UK12', 'UK13', 'UK14', 'UK15', 'UK16', '10j', '11j', '12j', '13j', '14j'];

const GLOVES_SIZE_OPTIONS = ['YOUTH S', 'YOUTH M', 'YOUTH L', 'YOUTH XL', 'XS', 'M', 'L', 'XL', 'XXL'];

const OTHER_BRAND_VALUE = '__other__';

function getCategoryLabel(categoryValue) {
  return SELL_CATEGORY_OPTIONS.find((option) => option.value === categoryValue)?.label || categoryValue;
}

export default function SellerSubmit() {
  const { user, profile, loading } = useAuth();
  const fileInputRef = useRef(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [gearItem, setGearItem] = useState('');
  const [gearCondition, setGearCondition] = useState('');
  const [gearBrand, setGearBrand] = useState('');
  const [customGearBrand, setCustomGearBrand] = useState('');
  const [gearSize, setGearSize] = useState('');
  const [accessoriesSubcategory, setAccessoriesSubcategory] = useState('');
  const [accessoriesCondition, setAccessoriesCondition] = useState('');
  const [accessoriesBrand, setAccessoriesBrand] = useState('');
  const [customAccessoriesBrand, setCustomAccessoriesBrand] = useState('');
  const [gearComboShirtSize, setGearComboShirtSize] = useState('');
  const [gearComboPantsSize, setGearComboPantsSize] = useState('');
  const [description, setDescription] = useState('');
  // Remove specifications for parts, add condition
  const [partsCondition, setPartsCondition] = useState('');
  const [partsBrand, setPartsBrand] = useState('');
  const [customPartsBrand, setCustomPartsBrand] = useState('');
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [brandOptions, setBrandOptions] = useState(GEAR_BRAND_OPTIONS);
  // Add missing state for manufacturer, model, otherManufacturer
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState([]);
  const [otherManufacturer, setOtherManufacturer] = useState('');

  useEffect(() => {
    let isMounted = true;

    fetchGearBrandOptions()
      .then((savedBrands) => {
        if (!isMounted) {
          return;
        }

        const mergedBrands = [...GEAR_BRAND_OPTIONS];
        savedBrands.forEach((savedBrand) => {
          const exists = mergedBrands.some((brand) => brand.toLowerCase() === savedBrand.toLowerCase());
          if (!exists) {
            mergedBrands.push(savedBrand);
          }
        });

        const sortedBrands = mergedBrands.sort((a, b) => a.localeCompare(b));
        setBrandOptions(sortedBrands);
      })
      .catch(() => {
        if (isMounted) {
          setBrandOptions(GEAR_BRAND_OPTIONS);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      setStatus('Please log in to submit products.');
    }
  }, [loading, user]);

  useEffect(() => {
    if (!category) {
      setSubcategory('');
      return;
    }

    if (category === 'Gear') {
      setSubcategory('');
      setGearItem(GEAR_ITEM_OPTIONS[0] || '');
      setGearCondition(GEAR_CONDITION_OPTIONS[0] || '');
      setGearBrand(brandOptions[0] || '');
      setCustomGearBrand('');
      return;
    }

    if (category === 'Accessories') {
      setAccessoriesSubcategory(DIRT_BIKE_CATEGORIES.Accessories[0] || '');
      setAccessoriesCondition(GEAR_CONDITION_OPTIONS[0] || '');
      setAccessoriesBrand(brandOptions[0] || '');
      setCustomAccessoriesBrand('');
      return;
    }

    const defaultSubcategory = DIRT_BIKE_CATEGORIES[category]?.[0] || '';
    setSubcategory(defaultSubcategory);
  }, [category, brandOptions]);

  useEffect(() => {
    if (category === 'Gear' && !gearBrand && brandOptions.length > 0) {
      setGearBrand(brandOptions[0]);
    }
  }, [category, gearBrand, brandOptions]);

  useEffect(() => {
    if (gearBrand !== OTHER_BRAND_VALUE) {
      setCustomGearBrand('');
    }
  }, [gearBrand]);

  useEffect(() => {
    if (category !== 'Gear') {
      return;
    }

    if (ALPHA_SIZE_GEAR_ITEMS.includes(gearItem)) {
      setGearSize(ALPHA_SIZE_OPTIONS[0] || '');
      setGearComboShirtSize('');
      setGearComboPantsSize('');
      return;
    }

    if (gearItem === 'Pants') {
      setGearSize(PANTS_SIZE_OPTIONS[0] || '');
      setGearComboShirtSize('');
      setGearComboPantsSize('');
      return;
    }

    if (gearItem === 'Gear Combo') {
      setGearSize('');
      setGearComboShirtSize(ALPHA_SIZE_OPTIONS[0] || '');
      setGearComboPantsSize(PANTS_SIZE_OPTIONS[0] || '');
      return;
    }

    if (gearItem === 'Boots') {
      setGearSize(BOOTS_SIZE_OPTIONS[0] || '');
      setGearComboShirtSize('');
      setGearComboPantsSize('');
      return;
    }

    if (gearItem === 'Gloves') {
      setGearSize(GLOVES_SIZE_OPTIONS[0] || '');
      setGearComboShirtSize('');
      setGearComboPantsSize('');
      return;
    }

    setGearSize('');
    setGearComboShirtSize('');
    setGearComboPantsSize('');
  }, [category, gearItem]);

  const handleCategoryChoice = (selectedCategory) => {
    setCategory(selectedCategory);
    setStatus('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user) return;

    if (!price || Number(price) <= 0) {
      setStatus('Please enter a valid price greater than 0.');
      return;
    }

    if (category === 'Gear') {
      const resolvedGearBrand = gearBrand === OTHER_BRAND_VALUE ? customGearBrand.trim() : gearBrand.trim();
      const needsSingleSize = gearItem !== 'Gear Combo';
      const missingSingleSize = needsSingleSize && !gearSize.trim();
      const missingComboSizes = gearItem === 'Gear Combo' && (!gearComboShirtSize || !gearComboPantsSize);
      const missingBrand = !resolvedGearBrand;

      if (!gearItem || !gearCondition || missingBrand || missingSingleSize || missingComboSizes) {
        setStatus('Please complete all required gear fields before submitting.');
        return;
      }
    }

    if (category === 'Accessories') {
      if (!accessoriesSubcategory || !accessoriesCondition || !description.trim()) {
        setStatus('Please complete all required accessories fields before submitting.');
        return;
      }
    }

    if (category === 'Parts') {
      if (!name.trim() || !subcategory || !description.trim()) {
        setStatus('Please complete all required parts fields before submitting.');
        return;
      }
    }

    if (!files || files.length === 0) {
      setStatus('Please upload at least one product image before submitting for review.');
      return;
    }

    if ((category === 'Gear' || category === 'Accessories') && (files.length < 3 || files.length > 5)) {
      setStatus('Please upload between 3 and 5 images.');
      return;
    }

    setIsSubmitting(true);
    setStatus('');

    try {
      const resolvedGearBrand = gearBrand === OTHER_BRAND_VALUE ? customGearBrand.trim() : gearBrand.trim();
      const resolvedAccessoriesBrand = accessoriesBrand === OTHER_BRAND_VALUE ? customAccessoriesBrand.trim() : accessoriesBrand.trim();

      let resolvedName, resolvedSubcategory, resolvedDescription, resolvedSpecifications, resolvedCustomFields;

      if (category === 'Gear') {
        const resolvedGearSize = gearItem === 'Gear Combo'
          ? `Shirt: ${gearComboShirtSize}, Pants: ${gearComboPantsSize}`
          : gearSize.trim();
        resolvedName = `${resolvedGearBrand} ${gearItem}`;
        resolvedSubcategory = gearItem;
        resolvedDescription = '';
        resolvedSpecifications = `Condition: ${gearCondition}\nBrand: ${resolvedGearBrand}\nSize: ${resolvedGearSize}`;
        resolvedCustomFields = {
          gearItem,
          gearCondition,
          gearBrand: resolvedGearBrand,
          customGearBrand: gearBrand === OTHER_BRAND_VALUE ? resolvedGearBrand : '',
          gearSize: resolvedGearSize,
          gearComboShirtSize: gearItem === 'Gear Combo' ? gearComboShirtSize : '',
          gearComboPantsSize: gearItem === 'Gear Combo' ? gearComboPantsSize : '',
        };
      } else if (category === 'Accessories') {
        const resolvedAccessoriesBrandForDisplay = (accessoriesBrand && accessoriesBrand !== OTHER_BRAND_VALUE) ? accessoriesBrand : (accessoriesBrand === OTHER_BRAND_VALUE ? customAccessoriesBrand.trim() : '');
        resolvedName = resolvedAccessoriesBrandForDisplay ? `${resolvedAccessoriesBrandForDisplay} ${accessoriesSubcategory}` : accessoriesSubcategory;
        resolvedSubcategory = accessoriesSubcategory;
        resolvedDescription = description;
        const brandSpecLine = resolvedAccessoriesBrandForDisplay ? `Brand: ${resolvedAccessoriesBrandForDisplay}` : '';
        resolvedSpecifications = brandSpecLine ? `Condition: ${accessoriesCondition}\n${brandSpecLine}` : `Condition: ${accessoriesCondition}`;
        resolvedCustomFields = {
          accessoriesSubcategory,
          accessoriesCondition,
          accessoriesBrand: resolvedAccessoriesBrandForDisplay,
          customAccessoriesBrand: accessoriesBrand === OTHER_BRAND_VALUE ? resolvedAccessoriesBrandForDisplay : '',
        };
      } else {
        const normalizedManufacturer = (manufacturer || '').trim();
        const normalizedOtherManufacturer = (otherManufacturer || '').trim();
        const resolvedPartsBrand = normalizedManufacturer === 'Other'
          ? normalizedOtherManufacturer
          : normalizedManufacturer;

        if (!normalizedManufacturer) {
          setStatus('Please select a bike manufacturer.');
          return;
        }

        if (normalizedManufacturer === 'Other' && !normalizedOtherManufacturer) {
          setStatus('Please enter the manufacturer/brand name when selecting Other.');
          return;
        }

        const normalizedModels = Array.isArray(model)
          ? model.map((item) => item.trim()).filter(Boolean)
          : [];

        if (normalizedManufacturer !== 'Universal' && normalizedManufacturer !== 'Other' && normalizedModels.length === 0) {
          setStatus('Please select at least one bike model.');
          return;
        }

        const resolvedOptionalPartsBrand = partsBrand === OTHER_BRAND_VALUE ? customPartsBrand.trim() : partsBrand.trim();
        resolvedName = name;
        resolvedSubcategory = subcategory;
        resolvedDescription = description;
        const brandSpecLine = resolvedOptionalPartsBrand ? `Brand: ${resolvedOptionalPartsBrand}` : `Brand: ${resolvedPartsBrand}`;
        resolvedSpecifications = `Condition: ${partsCondition}\n${brandSpecLine}`;
        resolvedCustomFields = {
          partsCondition,
          manufacturer: normalizedManufacturer,
          model: normalizedManufacturer === 'Universal' || normalizedManufacturer === 'Other' ? [] : normalizedModels,
          otherManufacturer: normalizedManufacturer === 'Other' ? normalizedOtherManufacturer : '',
          brand: resolvedPartsBrand,
          customPartsBrand: normalizedManufacturer === 'Other' ? normalizedOtherManufacturer : '',
          partsBrand: resolvedOptionalPartsBrand,
          customPartsBrandOptional: partsBrand === OTHER_BRAND_VALUE ? resolvedOptionalPartsBrand : '',
        };
      }

      // Calculate markup price
      const sellerPrice = Number(price);
      let markup = 0.20;
      if (sellerPrice > 999) markup = 0.11;
      else if (sellerPrice >= 501) markup = 0.15;
      const markupPrice = (sellerPrice + sellerPrice * markup).toFixed(2);

      await submitProductRequest({
        user,
        name: resolvedName,
        price: markupPrice,
        category,
        subcategory: resolvedSubcategory,
        description: resolvedDescription,
        specifications: resolvedSpecifications,
        files,
        customFields: {
          ...resolvedCustomFields,
          sellerPrice: sellerPrice.toFixed(2),
        },
      });
      setName('');
      setPrice('');
      setSubcategory('');
      setGearItem('');
      setGearCondition('');
      setGearBrand('');
      setCustomGearBrand('');
      setGearSize('');
      setGearComboShirtSize('');
      setGearComboPantsSize('');
      setAccessoriesSubcategory('');
      setAccessoriesCondition('');
      setAccessoriesBrand('');
      setCustomAccessoriesBrand('');
      setDescription('');
      setPartsCondition('');
      setPartsBrand('');
      setCustomPartsBrand('');
      setManufacturer('');
      setModel([]);
      setOtherManufacturer('');
      setFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setStatus('');
      setShowSuccessPopup(true);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <p>Loading seller submission form...</p>;
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600">Please sign in to submit products.</p>
      </div>
    );
  }

  if (!profile?.canSell && profile?.role !== 'admin') {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-slate-600">Your account is not enabled for selling yet. Complete your profile to unlock product listings.</p>
        <Link href="/profile" className="mt-4 inline-flex rounded-full bg-slate-900 px-5 py-3 text-white hover:bg-slate-800">
          Go to profile
        </Link>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Seller</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900">What are you selling?</h1>
          <p className="mt-3 text-slate-600">Choose the product type first. The submission form will then load for that category.</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {SELL_CATEGORY_OPTIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => handleCategoryChoice(item.value)}
              className="rounded-3xl border border-slate-300 bg-[#eceff3] px-5 py-6 text-center text-sm font-semibold uppercase tracking-[0.08em] text-slate-800 transition hover:border-[#00CED1] hover:text-[#00C5CD]"
            >
              {item.label}
            </button>
          ))}
        </div>

        {status ? <p className="mt-6 text-slate-600">{status}</p> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Seller</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">Submit new product</h1>
        <p className="mt-3 text-slate-600">Fill in details for your {getCategoryLabel(category).toLowerCase()} product and submit for admin approval.</p>
      </div>
      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Selected category</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{getCategoryLabel(category)}</p>
          </div>
          <button
            type="button"
            onClick={() => setCategory('')}
            className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]"
          >
            Change category
          </button>
        </div>
        {category === 'Gear' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">What gear item do you wish to sell?</span>
                <select
                  value={gearItem}
                  onChange={(event) => setGearItem(event.target.value)}
                  required
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  {GEAR_ITEM_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Please describe the condition of the gear</span>
                <select
                  value={gearCondition}
                  onChange={(event) => setGearCondition(event.target.value)}
                  required
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  {GEAR_CONDITION_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">What brand is the gear item?</span>
                <select
                  value={gearBrand}
                  onChange={(event) => setGearBrand(event.target.value)}
                  required
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  {brandOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                  <option value={OTHER_BRAND_VALUE}>Other (Add New Brand)</option>
                </select>
              </label>

              {gearBrand === OTHER_BRAND_VALUE ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Enter brand name</span>
                  <input
                    type="text"
                    value={customGearBrand}
                    onChange={(event) => setCustomGearBrand(event.target.value)}
                    required
                    maxLength={60}
                    placeholder="Type the brand name"
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                  />
                </label>
              ) : null}

              {ALPHA_SIZE_GEAR_ITEMS.includes(gearItem) ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Please provide the size of the gear</span>
                  <select
                    value={gearSize}
                    onChange={(event) => setGearSize(event.target.value)}
                    required
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    {ALPHA_SIZE_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {gearItem === 'Gloves' ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Please provide the size of the gloves</span>
                  <select
                    value={gearSize}
                    onChange={(event) => setGearSize(event.target.value)}
                    required
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    {GLOVES_SIZE_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {gearItem === 'Boots' ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Please provide the size of the boots</span>
                  <select
                    value={gearSize}
                    onChange={(event) => setGearSize(event.target.value)}
                    required
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    {BOOTS_SIZE_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {gearItem === 'Pants' ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Please provide the size of the gear</span>
                  <select
                    value={gearSize}
                    onChange={(event) => setGearSize(event.target.value)}
                    required
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    {PANTS_SIZE_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {gearItem === 'Gear Combo' ? (
                <div className="grid gap-4 sm:grid-cols-2 sm:col-span-2">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Shirt size</span>
                    <select
                      value={gearComboShirtSize}
                      onChange={(event) => setGearComboShirtSize(event.target.value)}
                      required
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      {ALPHA_SIZE_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Pants size</span>
                    <select
                      value={gearComboPantsSize}
                      onChange={(event) => setGearComboPantsSize(event.target.value)}
                      required
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      {PANTS_SIZE_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              {gearItem !== 'Gear Combo' && !ALPHA_SIZE_GEAR_ITEMS.includes(gearItem) && gearItem !== 'Pants' ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Please provide the size of the gear</span>
                  <input
                    value={gearSize}
                    onChange={(event) => setGearSize(event.target.value)}
                    required
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                  />
                </label>
              ) : null}
            </div>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Price</span>
              <input
                type="number"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                required
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
              />
              {/* Selling price calculation */}
              <SellingPriceInfo price={price} />
            </label>
          </>
        ) : category === 'Accessories' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">What type of accessory is this?</span>
                <select
                  value={accessoriesSubcategory}
                  onChange={(event) => setAccessoriesSubcategory(event.target.value)}
                  required
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  {DIRT_BIKE_CATEGORIES.Accessories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Please describe the condition of the item</span>
                <select
                  value={accessoriesCondition}
                  onChange={(event) => setAccessoriesCondition(event.target.value)}
                  required
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  {GEAR_CONDITION_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Brand <span className="text-xs text-slate-500">(optional)</span></span>
                <select
                  value={accessoriesBrand}
                  onChange={(event) => setAccessoriesBrand(event.target.value)}
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <option value="">-- Select or leave blank --</option>
                  {brandOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                  <option value={OTHER_BRAND_VALUE}>Other (Add New Brand)</option>
                </select>
              </label>

              {accessoriesBrand === OTHER_BRAND_VALUE ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Enter brand name</span>
                  <input
                    type="text"
                    value={customAccessoriesBrand}
                    onChange={(event) => setCustomAccessoriesBrand(event.target.value)}
                    maxLength={60}
                    placeholder="Type the brand name"
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                  />
                </label>
              ) : null}
            </div>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Description</span>
              <textarea
                rows="5"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Price</span>
              <input
                type="number"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                required
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
              />
              {/* Selling price calculation */}
              <SellingPriceInfo price={price} />
            </label>
          </>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Product name</span>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Price</span>
                <input
                  type="number"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  required
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                />
                {/* Selling price calculation */}
                <SellingPriceInfo price={price} />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Condition</span>
                <select
                  value={partsCondition}
                  onChange={e => setPartsCondition(e.target.value)}
                  required
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <option value="">Select condition</option>
                  {GEAR_CONDITION_OPTIONS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Part Brand <span className="text-xs text-slate-500">(optional)</span></span>
                <select
                  value={partsBrand}
                  onChange={e => setPartsBrand(e.target.value)}
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <option value="">-- Select or leave blank --</option>
                  {brandOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                  <option value={OTHER_BRAND_VALUE}>Other (Add New Brand)</option>
                </select>
              </label>
              {partsBrand === OTHER_BRAND_VALUE ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Enter brand name</span>
                  <input
                    type="text"
                    value={customPartsBrand}
                    onChange={e => setCustomPartsBrand(e.target.value)}
                    maxLength={60}
                    placeholder="Type the brand name"
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                  />
                </label>
              ) : null}
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Dirt Bike Category</span>
              <select
                value={subcategory}
                onChange={e => setSubcategory(e.target.value)}
                required
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <option value="">Select a category</option>
                {DIRT_BIKE_CATEGORIES.Parts.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Fits Bike Manufacturer</span>
              <select
                value={manufacturer || ''}
                onChange={e => { setManufacturer(e.target.value); setModel([]); setOtherManufacturer(''); }}
                required
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <option value="">Select manufacturer</option>
                {[
                  'Honda','Yamaha','KTM','Kawasaki','Suzuki','Husqvarna','GasGas','Beta','Sherco','TM Racing','Stark Future','Fantic','Sur-Ron','Kayo','Osset','Triumph','Universal','Other'
                ].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {manufacturer === 'Other' && (
                <input
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                  placeholder="Enter manufacturer name"
                  value={otherManufacturer || ''}
                  onChange={e => setOtherManufacturer(e.target.value)}
                  required
                />
              )}
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Fits Bike Model(s)</span>
              <select
                multiple
                size={8}
                value={model}
                onChange={(event) => {
                  const selectedModels = Array.from(event.target.selectedOptions).map((option) => option.value);
                  setModel(selectedModels);
                }}
                disabled={manufacturer === 'Universal' || !manufacturer || manufacturer === 'Other'}
                required={manufacturer !== 'Universal' && manufacturer !== 'Other'}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                {(function() {
                  const MODELS = {
                    Honda: ['CRF450R','CRF450RWE','CRF250R','CRF250RWE','CRF450RX','CRF250RX','CRF450X','CRF250F','CRF125F','CRF110F','CRF50F'],
                    Yamaha: ['YZ450F','YZ250F','YZ250','YZ125','YZ450FX','YZ250FX','WR450F','WR250F','TT-R230','TT-R125LE','TT-R110E','TT-R50E','PW50','YZ65','YZ85'],
                    KTM: ['450 SX-F','350 SX-F','250 SX-F','300 SX','250 SX','125 SX','85 SX','65 SX','50 SX','450 XC-F','350 XC-F','250 XC-F','300 XC','250 XC'],
                    Kawasaki: ['KX450','KX250','KX112','KX85','KX65','KX450X','KX250X','KLX300R','KLX230R','KLX140R','KLX110R'],
                    Suzuki: ['RM-Z450','RM-Z250','DR-Z125L','DR-Z50','RM-250','RM-125','RM-85'],
                    Husqvarna: ['FC 450','FC 350','FC 250','TC 300','TC 250','TC 125','TC 85','TC 65','TC 50','TE 300','FE 350','FE 501','FE 450','FE 350','FE 250','TE 300','TE 250','TE 150','TE 125'],
                    GasGas: ['MC 450F','MC 250F','MC 250','MC 125','MC 85','MC 65','MC 50','EC 500F','EC 350F','EC 300.','EX 300'],
                    Beta: ['RX 350','RX 250','RX 450','125 RR Race','200 RR Race','250 RR Race','300 RR Race','350 RR Race','390 RR Race','430 RR Race','480 RR Race'],
                    Sherco: ['125 SE Factory','250 SE Factory','300 SE Factory','4-Stroke Models','250 SEF Factory','300 SEF Factory','450 SEF Factory','500 SEF Factory','250 SE Xtrem'],
                    'TM Racing': ['EN 125 Fi','EN 144 Fi','EN 250 Fi','EN 300 Fi','EN 250Fi','EN 300Fi','EN 450Fi','MX 85','MX 125','MX 144','MX 250','MX 300','MX 250Fi','MX 300Fi','MX 450Fi'],
                    'Stark Future': ['VARG MX','VARG EX'],
                    Fantic: ['XEF 450','XEF 310','XEF 250','XE 300','XE 125','XEF 125','XE 50','XXF 450','XXF 250','XX 250','XX 125'],
                    'Sur-Ron': ['Light Bee X','Light Bee L1E','Light Bee S','Ultra Bee','Ultra Bee T','Ultra Bee R','Storm Bee F','Storm Bee E','Storm Bee R'],
                    Osset: ['TXP-24','TXP-20','TXP-16','TXP-12'],
                    Triumph: ['TF 450-X','TF 250-X','TF 250-C','TF 450-C','TF 250-E','TF 450-E'],
                  };
                  return MODELS[manufacturer] ? MODELS[manufacturer].map(mod => (
                    <option key={mod} value={mod}>{mod}</option>
                  )) : null;
                })()}
              </select>
              <p className="mt-2 text-xs text-slate-500">Hold Ctrl (Windows) or Cmd (Mac) to select multiple models.</p>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Description</span>
              <textarea
                rows="5"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
              />
            </label>

          </>
        )}
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Please upload 3-5 clear images of item</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => setFiles(event.target.files)}
            required
            className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
          />
          <p className="mt-2 text-sm text-slate-500">
            {category === 'Gear' || category === 'Accessories'
              ? 'Please upload between 3 and 5 images. Files are stored in Firebase Storage.'
              : 'Upload up to 5 images. Files are stored in Firebase Storage.'}
          </p>
        </label>
        <button disabled={isSubmitting} className="rounded-3xl bg-slate-900 px-6 py-3 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
          {isSubmitting ? 'Submitting…' : 'Submit for review'}
        </button>
      </form>
      {status ? <p className="mt-4 text-slate-600">{status}</p> : null}

      {showSuccessPopup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00C5CD]">Submission successful</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Submitted successfully</h2>
            <p className="mt-3 text-sm text-slate-600">Your product has been submitted for review and is now pending admin approval.</p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setShowSuccessPopup(false)}
                className="rounded-full bg-[#00CED1] px-5 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white hover:bg-[#00C5CD]"
              >
                Submit another
              </button>
              <Link href="/seller/submissions" className="rounded-full border border-slate-300 px-5 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-700 hover:border-[#00CED1] hover:text-[#00C5CD]">
                View submissions
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
