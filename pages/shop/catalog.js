import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import ProductCard from '../../components/ProductCard';
import { GEAR_CONDITION_OPTIONS, DIRT_BIKE_CATEGORIES } from '../../lib/dirtBikeCategories';
import { fetchLiveProducts } from '../../lib/firestoreHelpers';
// Manufacturer and model options for filtering
const MANUFACTURERS = [
  'Honda', 'Yamaha', 'KTM', 'Kawasaki', 'Suzuki', 'Husqvarna', 'GasGas', 'Beta', 'Sherco', 'TM Racing',
  'Stark Future', 'Fantic', 'Sur-Ron', 'Kayo', 'Osset', 'Triumph', 'Universal', 'Other'
];
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





const CORE_CATEGORY_OPTIONS = ['Gear', 'Accessories', 'Parts'];

function normalizeCategoryValue(value) {
  const trimmedValue = (value || '').trim();
  const matchedCoreCategory = CORE_CATEGORY_OPTIONS.find((category) => category.toLowerCase() === trimmedValue.toLowerCase());
  return matchedCoreCategory || trimmedValue;
}

export default function Shop() {

  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSort, setSelectedSort] = useState('popular');
  const [selectedManufacturer, setSelectedManufacturer] = useState('');
  const [selectedModel, setSelectedModel] = useState('');

  // Manufacturer/model filtering logic will be placed after productsForSubcategories is defined

  const searchQuery = typeof router.query.q === 'string' ? router.query.q.trim() : '';
  const queryCategory = typeof router.query.category === 'string' ? normalizeCategoryValue(router.query.category) : '';
  const querySubcategory = typeof router.query.sub === 'string' ? router.query.sub.trim() : '';
  const normalizedSearchQuery = searchQuery.toLowerCase();
  const defaultSort = normalizedSearchQuery ? 'relevance' : 'popular';

  const SEARCH_TERM_ALIASES = {
    shirt: ['shirts', 'jersey', 'jerseys'],
    shirts: ['shirt', 'jersey', 'jerseys'],
    jersey: ['jerseys', 'shirt', 'shirts'],
    jerseys: ['jersey', 'shirt', 'shirts'],
    boot: ['boots'],
    boots: ['boot'],
  };

  const tokenizeSearchValue = (value) => {
    return (value || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter(Boolean);
  };

  const getTermVariants = (term) => {
    const normalizedTerm = (term || '').toLowerCase().trim();
    if (!normalizedTerm) {
      return [];
    }

    const variants = new Set([normalizedTerm]);

    if (normalizedTerm.endsWith('ies') && normalizedTerm.length > 3) {
      variants.add(`${normalizedTerm.slice(0, -3)}y`);
    }

    if (normalizedTerm.endsWith('s') && normalizedTerm.length > 2) {
      variants.add(normalizedTerm.slice(0, -1));
    } else {
      variants.add(`${normalizedTerm}s`);
    }

    const aliasTerms = SEARCH_TERM_ALIASES[normalizedTerm] || [];
    aliasTerms.forEach((alias) => variants.add(alias));

    return Array.from(variants);
  };

  const getSearchMatch = (product, queryTerms) => {
    if (queryTerms.length === 0) {
      return { matches: true, score: 0 };
    }

    const primaryText = [
      product.name,
      product.category,
      product.subcategory,
      ...(Array.isArray(product.specifications) ? product.specifications : []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const secondaryText = [
      product.description,
      product.sellerName,
      product.sellerEmail,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const primaryTokens = new Set(tokenizeSearchValue(primaryText));
    const secondaryTokens = new Set(tokenizeSearchValue(secondaryText));

    let score = 0;

    for (const term of queryTerms) {
      const variants = getTermVariants(term);
      const matchesPrimary = variants.some((variant) => primaryTokens.has(variant));
      const matchesSecondary = variants.some((variant) => secondaryTokens.has(variant));

      if (!matchesPrimary && !matchesSecondary) {
        return { matches: false, score: 0 };
      }

      score += matchesPrimary ? 3 : 1;
    }

    return { matches: true, score };
  };

  const queryTerms = tokenizeSearchValue(normalizedSearchQuery);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [brandFilterQuery, setBrandFilterQuery] = useState('');
  const [showBrandPicker, setShowBrandPicker] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [draggingPriceThumb, setDraggingPriceThumb] = useState('');
  const priceSliderTrackRef = useRef(null);
  const brandPickerRef = useRef(null);

  const normalizeSubcategoryValue = (value) => {
    const normalizedValue = (value || '').toLowerCase();
    return normalizedValue === 'knee braces' ? 'protection' : normalizedValue;
  };

  const normalizeConditionValue = (value) => {
    return (value || '').trim().toLowerCase();
  };

  const extractSpecificationValue = (product, label) => {
    const targetLabel = (label || '').toLowerCase().trim();
    if (!targetLabel || !Array.isArray(product?.specifications)) {
      return '';
    }

    const matchedLine = product.specifications.find((line) => {
      if (typeof line !== 'string') {
        return false;
      }
      return line.toLowerCase().startsWith(`${targetLabel}:`);
    });

    if (!matchedLine) {
      return '';
    }

    return matchedLine.split(':').slice(1).join(':').trim();
  };

  const getProductBrand = (product) => {
    return (
      product.gearBrand
      || product.accessoriesBrand
      || product.brand
      || extractSpecificationValue(product, 'Brand')
      || ''
    ).trim();
  };

  const getProductCondition = (product) => {
    const rawCondition = (
      product.gearCondition
      || product.accessoriesCondition
      || product.condition
      || extractSpecificationValue(product, 'Condition')
      || ''
    );
    return normalizeConditionValue(rawCondition);
  };

  useEffect(() => {
    setSelectedCategory(queryCategory);
    setSelectedSubcategory(querySubcategory);
    setSelectedBrands([]);
    setSelectedCondition('');
    setPriceMin('');
    setPriceMax('');
    setShowMobileFilters(false);
  }, [queryCategory, querySubcategory]);

  useEffect(() => {
    setSelectedSort((currentSort) => {
      // Keep explicit price sorting if the user already chose it.
      if (currentSort === 'price-asc' || currentSort === 'price-desc') {
        return currentSort;
      }

      return defaultSort;
    });
  }, [defaultSort]);

  useEffect(() => {
    fetchLiveProducts()
      .then((results) => setProducts(results))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const categoryOptions = Array.from(
    new Set([
      ...CORE_CATEGORY_OPTIONS,
      ...products.map((product) => normalizeCategoryValue(product.category)).filter(Boolean),
    ])
  ).sort((a, b) => a.localeCompare(b));


  const productsForSubcategories = selectedCategory
    ? products.filter((product) => (product.category || '').toLowerCase() === selectedCategory.toLowerCase())
    : products;

  // Manufacturer/model filtering logic (must come after productsForSubcategories)
  // Custom manufacturer/model filtering logic
  const productsForManufacturer = selectedManufacturer && selectedManufacturer !== 'Universal'
    ? productsForSubcategories.filter((product) => {
        // Always include Gear and Accessories
        const category = (product.category || '').toLowerCase();
        if (category === 'gear' || category === 'accessories') return true;
        // For Parts, include if manufacturer matches or is Universal
        const manufacturer = (product.manufacturer || '').toLowerCase();
        return manufacturer === selectedManufacturer.toLowerCase() || manufacturer === 'universal';
      })
    : productsForSubcategories;

  const productsForModel = selectedModel && selectedManufacturer && selectedManufacturer !== 'Universal' && MODELS[selectedManufacturer]
    ? productsForManufacturer.filter((product) => {
        // Always include Gear and Accessories
        const category = (product.category || '').toLowerCase();
        if (category === 'gear' || category === 'accessories') return true;
        // For Parts, include if model matches or manufacturer is Universal
        const manufacturer = (product.manufacturer || '').toLowerCase();
        if (manufacturer === 'universal') return true;

        const productModels = Array.isArray(product.model)
          ? product.model.map((modelValue) => String(modelValue || '').toLowerCase().trim()).filter(Boolean)
          : [String(product.model || '').toLowerCase().trim()].filter(Boolean);

        return productModels.includes(selectedModel.toLowerCase());
      })
    : productsForManufacturer;

  // Use static subcategories for Parts, Gear, Accessories
  let subcategoryOptions = [];
  if (selectedCategory === 'Parts') {
    subcategoryOptions = DIRT_BIKE_CATEGORIES.Parts;
  } else if (selectedCategory === 'Gear') {
    subcategoryOptions = DIRT_BIKE_CATEGORIES.Gear;
  } else if (selectedCategory === 'Accessories') {
    subcategoryOptions = DIRT_BIKE_CATEGORIES.Accessories;
  } else {
    subcategoryOptions = Array.from(
      new Set(
        productsForSubcategories
          .map((product) => (product.subcategory || '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }

  const brandOptions = Array.from(new Set(products.map((product) => getProductBrand(product)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const filteredBrandOptions = brandOptions.filter((brand) => brand.toLowerCase().includes(brandFilterQuery.toLowerCase().trim()));
  const conditionOptions = Array.from(
    new Set([
      ...GEAR_CONDITION_OPTIONS,
      ...products
        .map((product) => {
          const normalized = getProductCondition(product);
          if (!normalized) {
            return '';
          }
          return normalized
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        })
        .filter(Boolean),
    ])
  ).sort((a, b) => a.localeCompare(b));

  const productPrices = products
    .map((product) => Number(product.price))
    .filter((price) => Number.isFinite(price) && price >= 0);
  const maxProductPrice = productPrices.length > 0 ? Math.max(...productPrices) : 1000;
  const sliderMax = Math.max(100, Math.ceil(maxProductPrice / 50) * 50);

  const sliderMinValue = Math.max(0, Math.min(priceMin === '' ? 0 : Number(priceMin), sliderMax));
  const sliderMaxValue = Math.max(sliderMinValue, Math.min(priceMax === '' ? sliderMax : Number(priceMax), sliderMax));
  const sliderMinPercent = sliderMax > 0 ? (sliderMinValue / sliderMax) * 100 : 0;
  const sliderMaxPercent = sliderMax > 0 ? (sliderMaxValue / sliderMax) * 100 : 100;

  const normalizedSelectedCondition = normalizeConditionValue(selectedCondition);
  const numericMinPrice = priceMin === '' ? null : Number(priceMin);
  const numericMaxPrice = priceMax === '' ? null : Number(priceMax);

  const filteredEntries = productsForModel
      // In the filter UI (wherever your filters are rendered):
      /*
        Add this inside your filter sidebar or filter section:
        <label className="block mt-4">
          <span className="text-sm font-medium text-slate-700">Bike Manufacturer</span>
          <select
            value={selectedManufacturer}
            onChange={e => { setSelectedManufacturer(e.target.value); setSelectedModel(''); }}
            className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <option value="">All Manufacturers</option>
            {MANUFACTURERS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        {selectedManufacturer && selectedManufacturer !== 'Universal' && selectedManufacturer !== 'Other' && (
          <label className="block mt-4">
            <span className="text-sm font-medium text-slate-700">Bike Model</span>
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <option value="">All Models</option>
              {MODELS[selectedManufacturer]?.map(mod => (
                <option key={mod} value={mod}>{mod}</option>
              ))}
            </select>
          </label>
        )}
      */
    .map((product) => {
      const searchMatch = getSearchMatch(product, queryTerms);

      const productCategory = (product.category || '').toLowerCase();
      const matchesCategory = selectedCategory ? productCategory === selectedCategory.toLowerCase() : true;

      const matchesSubcategory = selectedSubcategory
        ? normalizeSubcategoryValue(product.subcategory) === normalizeSubcategoryValue(selectedSubcategory)
        : true;

      const productBrand = getProductBrand(product);
      const normalizedSelectedBrands = selectedBrands.map((brand) => brand.toLowerCase());
      const matchesBrand = normalizedSelectedBrands.length > 0
        ? normalizedSelectedBrands.includes(productBrand.toLowerCase())
        : true;

      const productCondition = getProductCondition(product);
      const matchesCondition = normalizedSelectedCondition ? productCondition === normalizedSelectedCondition : true;

      const productPrice = Number(product.price);
      const hasValidPrice = !Number.isNaN(productPrice);
      const matchesMinPrice = numericMinPrice === null || (!Number.isNaN(numericMinPrice) && hasValidPrice && productPrice >= numericMinPrice);
      const matchesMaxPrice = numericMaxPrice === null || (!Number.isNaN(numericMaxPrice) && hasValidPrice && productPrice <= numericMaxPrice);

      const matchesAllFilters = searchMatch.matches
        && matchesCategory
        && matchesSubcategory
        && matchesBrand
        && matchesCondition
        && matchesMinPrice
        && matchesMaxPrice;

      return {
        product,
        score: searchMatch.score,
        matchesAllFilters,
      };
    })
    .filter((entry) => entry.matchesAllFilters);

  const filteredProducts = [...filteredEntries]
    .sort((a, b) => {
      if (selectedSort === 'price-asc') {
        return Number(a.product.price || 0) - Number(b.product.price || 0);
      }

      if (selectedSort === 'price-desc') {
        return Number(b.product.price || 0) - Number(a.product.price || 0);
      }

      if (selectedSort === 'popular') {
        return Number(b.product.clickCount || 0) - Number(a.product.clickCount || 0);
      }

      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return (a.product.name || '').localeCompare(b.product.name || '');
    })
    .map((entry) => entry.product);

  const activeFilterSummary = [
    selectedCategory,
    selectedSubcategory,
    selectedBrands.length > 0 ? `Brands (${selectedBrands.length})` : '',
    selectedCondition,
    priceMin || priceMax ? `Price ${priceMin || '0'}-${priceMax || 'max'}` : '',
  ]
    .filter(Boolean)
    .join(' • ');

  const handleCategoryChange = (event) => {
    const nextCategory = event.target.value;
    setSelectedCategory(nextCategory);
    setSelectedSubcategory('');
  };

  const clearFilters = () => {
    setSelectedCategory('');
    setSelectedSubcategory('');
    setSelectedBrands([]);
    setBrandFilterQuery('');
    setShowBrandPicker(false);
    setShowMobileFilters(false);
    setSelectedCondition('');
    setPriceMin('');
    setPriceMax('');
  };

  const renderFiltersPanel = () => (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold uppercase tracking-[0.1em] text-slate-700">Filters</h2>
        <button type="button" onClick={clearFilters} className="text-sm font-semibold uppercase tracking-[0.08em] text-[#00C5CD] hover:text-[#00CED1]">
          Clear all
        </button>
      </div>
      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">Category</span>
          <select value={selectedCategory} onChange={handleCategoryChange} className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-700">
            <option value="">All categories</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">Subcategory</span>
          <select value={selectedSubcategory} onChange={(event) => setSelectedSubcategory(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-700">
            <option value="">All subcategories</option>
            {subcategoryOptions.map((subcategory) => (
              <option key={subcategory} value={subcategory}>{subcategory}</option>
            ))}
          </select>
        </label>


        {/* Manufacturer filter */}
        <label className="block mt-4">
          <span className="text-sm font-medium text-slate-700">Bike Manufacturer</span>
          <select
            value={selectedManufacturer}
            onChange={e => { setSelectedManufacturer(e.target.value); setSelectedModel(''); }}
            className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <option value="">All Manufacturers</option>
            {MANUFACTURERS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        {/* Model filter, only show if manufacturer is selected and not Universal/Other */}
        {selectedManufacturer && selectedManufacturer !== 'Universal' && selectedManufacturer !== 'Other' && (
          <label className="block mt-4">
            <span className="text-sm font-medium text-slate-700">Bike Model</span>
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <option value="">All Models</option>
              {MODELS[selectedManufacturer]?.map(mod => (
                <option key={mod} value={mod}>{mod}</option>
              ))}
            </select>
          </label>
        )}

        {renderBrandFilter()}

        <label className="block">
          <span className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">Condition</span>
          <select value={selectedCondition} onChange={(event) => setSelectedCondition(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-700">
            <option value="">All</option>
            {conditionOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <div>
          <span className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">Price range</span>
          <div className="mt-2 space-y-3">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
              <span>Min: R{sliderMinValue}</span>
              <span>Max: R{sliderMaxValue}</span>
            </div>
            <div ref={priceSliderTrackRef} onMouseDown={handlePriceTrackMouseDown} className="relative h-6 cursor-ew-resize">
              <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-200" />
              <div
                className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-900"
                style={{ left: `${sliderMinPercent}%`, width: `${Math.max(sliderMaxPercent - sliderMinPercent, 0)}%` }}
              />
              <div
                onMouseDown={handleMinThumbMouseDown}
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-slate-900 bg-white shadow"
                style={{ left: `${sliderMinPercent}%` }}
              />
              <div
                onMouseDown={handleMaxThumbMouseDown}
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-[#7a1f1f] bg-white shadow"
                style={{ left: `${sliderMaxPercent}%` }}
              />
              <input
                type="range"
                min="0"
                max={sliderMax}
                step="10"
                value={sliderMinValue}
                onChange={handleMinPriceSliderChange}
                className="pointer-events-none absolute left-0 top-1/2 h-6 w-full -translate-y-1/2 appearance-none bg-transparent opacity-0"
              />
              <input
                type="range"
                min="0"
                max={sliderMax}
                step="10"
                value={sliderMaxValue}
                onChange={handleMaxPriceSliderChange}
                className="pointer-events-none absolute left-0 top-1/2 h-6 w-full -translate-y-1/2 appearance-none bg-transparent opacity-0"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const toggleBrandSelection = (brand) => {
    setSelectedBrands((current) => {
      if (current.includes(brand)) {
        return current.filter((item) => item !== brand);
      }

      return [...current, brand];
    });
  };

  const selectedBrandSummary = selectedBrands.length === 0
    ? 'All brands'
    : selectedBrands.length <= 2
      ? selectedBrands.join(', ')
      : `${selectedBrands.length} brands selected`;

  const renderBrandFilter = () => (
    <label className="block">
      <span className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">Brand</span>

      <div className="mt-2" ref={brandPickerRef}>
        <button
          type="button"
          onClick={() => setShowBrandPicker((current) => !current)}
          className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-3 text-left text-sm text-slate-700"
        >
          <span className="truncate">{selectedBrandSummary}</span>
          <span className="text-xs uppercase tracking-[0.08em] text-slate-500">{showBrandPicker ? 'Close' : 'Choose'}</span>
        </button>

        {showBrandPicker ? (
          <div className="mt-2 rounded-xl border border-slate-300 bg-slate-50 p-3">
            <input
              type="text"
              value={brandFilterQuery}
              onChange={(event) => setBrandFilterQuery(event.target.value)}
              placeholder="Search brands"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            />

            <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg bg-white p-2">
              {filteredBrandOptions.length === 0 ? (
                <p className="px-2 py-1 text-sm text-slate-500">No matching brands.</p>
              ) : (
                filteredBrandOptions.map((brand) => {
                  const isSelected = selectedBrands.includes(brand);
                  return (
                    <label key={brand} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-100">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleBrandSelection(brand)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-700">{brand}</span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setSelectedBrands([])}
                className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 hover:text-slate-900"
              >
                Clear brands
              </button>
              <button
                type="button"
                onClick={() => setShowBrandPicker(false)}
                className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-white"
              >
                Done
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </label>
  );

  const clampPriceValue = (value) => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(value, sliderMax));
  };

  const getSliderValueFromClientX = (clientX) => {
    const sliderTrack = priceSliderTrackRef.current;
    if (!sliderTrack) {
      return null;
    }

    const rect = sliderTrack.getBoundingClientRect();
    if (rect.width <= 0) {
      return null;
    }

    const ratio = (clientX - rect.left) / rect.width;
    const rawValue = Math.round((Math.max(0, Math.min(1, ratio)) * sliderMax) / 10) * 10;
    return clampPriceValue(rawValue);
  };

  const updatePriceFromPointer = (clientX, thumb) => {
    const nextValue = getSliderValueFromClientX(clientX);
    if (nextValue === null) {
      return;
    }

    if (thumb === 'min') {
      const boundedMin = Math.min(nextValue, sliderMaxValue);
      setPriceMin(String(boundedMin));
      return;
    }

    if (thumb === 'max') {
      const boundedMax = Math.max(nextValue, sliderMinValue);
      setPriceMax(String(boundedMax));
    }
  };

  const handlePriceTrackMouseDown = (event) => {
    const nextValue = getSliderValueFromClientX(event.clientX);
    if (nextValue === null) {
      return;
    }

    const thumbToDrag = Math.abs(nextValue - sliderMinValue) <= Math.abs(nextValue - sliderMaxValue) ? 'min' : 'max';
    setDraggingPriceThumb(thumbToDrag);
    updatePriceFromPointer(event.clientX, thumbToDrag);
  };

  const handleMinThumbMouseDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDraggingPriceThumb('min');
  };

  const handleMaxThumbMouseDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDraggingPriceThumb('max');
  };

  const handleMinPriceSliderChange = (event) => {
    const nextMin = Math.min(Number(event.target.value), sliderMaxValue);
    setPriceMin(String(nextMin));
  };

  const handleMaxPriceSliderChange = (event) => {
    const nextMax = Math.max(Number(event.target.value), sliderMinValue);
    setPriceMax(String(nextMax));
  };

  useEffect(() => {
    if (!draggingPriceThumb) {
      return undefined;
    }

    const handleMouseMove = (event) => {
      updatePriceFromPointer(event.clientX, draggingPriceThumb);
    };

    const stopDragging = () => {
      setDraggingPriceThumb('');
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopDragging);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDragging);
    };
  }, [draggingPriceThumb, sliderMax, sliderMinValue, sliderMaxValue]);

  useEffect(() => {
    if (!showBrandPicker) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!brandPickerRef.current || brandPickerRef.current.contains(event.target)) {
        return;
      }

      setShowBrandPicker(false);
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [showBrandPicker]);

  return (
    <div className="space-y-8">
      {loading ? (
        <p>Loading products…</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : products.length === 0 ? (
        <p className="text-slate-600">No products are live yet. Admin approval is required.</p>
      ) : filteredProducts.length === 0 ? (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-6">
          <button
            type="button"
            onClick={() => setShowMobileFilters((currentValue) => !currentValue)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-slate-700 shadow-sm lg:hidden"
          >
            {showMobileFilters ? 'Hide filters' : 'Show filters'}
          </button>
          <aside className={`${showMobileFilters ? 'block' : 'hidden'} h-fit rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:block lg:p-6`}>
            {renderFiltersPanel()}
          </aside>
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-slate-900">
              No products matched {searchQuery ? `"${searchQuery}"` : 'the selected filters'}.
            </p>
            <p className="mt-2 text-slate-600">Try a broader name, category, subcategory, brand, price, or condition.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-6">
          <button
            type="button"
            onClick={() => setShowMobileFilters((currentValue) => !currentValue)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-slate-700 shadow-sm lg:hidden"
          >
            {showMobileFilters ? 'Hide filters' : 'Show filters'}
          </button>
          <aside className={`${showMobileFilters ? 'block' : 'hidden'} h-fit rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:block lg:p-6`}>
            {renderFiltersPanel()}
          </aside>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              {searchQuery || activeFilterSummary ? <p className="text-sm text-slate-500">{filteredProducts.length} result{filteredProducts.length === 1 ? '' : 's'} found.</p> : <span />}
              <label className="flex w-full items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 sm:w-auto sm:justify-start">
                Sort by
                <select
                  value={selectedSort}
                  onChange={(event) => setSelectedSort(event.target.value)}
                  className="w-[180px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-slate-700 sm:w-auto"
                >
                  <option value="relevance">Relevance</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="popular">Popularity</option>
                </select>
              </label>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
