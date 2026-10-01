import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import ProductCard from './ProductCard';
import { CATEGORY_LABELS, fetchCatalogConfig, fetchProducts } from '@/lib/api/catalog';
import { toUserMessage } from '@/lib/userMessage';
import { useSingleFlight } from '@/lib/useSingleFlight';

// Why: Page size for both the initial fetch and "Load more", matching the backend's default.
const PAGE_SIZE = 24;

// Why: Debounces every filter-driven fetch by ~300ms, covering search typing, URL filters
// settling on mount and price slider drags.
const SEARCH_DEBOUNCE_MS = 300;

// Why: A fixed price slider maximum, since there is no full product list to derive one from.
const PRICE_CEILING_RANDS = 100000;

// Why: The sort <select> keeps its existing hyphenated option values (Codex-owned markup); the
// backend's `sort` filter uses underscored values instead.
const SORT_API_MAP = {
  relevance: 'relevance',
  popular: 'popular',
  'price-asc': 'price_asc',
  'price-desc': 'price_desc',
};

// Why: Reuses the one canonical category-label list (lib/api/catalog.js) instead of keeping a
// second copy here, per AGENTS.md's "no duplicate code" rule.
const CORE_CATEGORY_OPTIONS = Object.values(CATEGORY_LABELS);

/**
 * Why: Normalizes a `?category=` query value (any casing) to the canonical label so it matches
 * the category <select>'s option values.
 * @param {string} value - Raw `category` query param value.
 * @returns {string} The canonical label (e.g. `'Gear'`) if recognized, otherwise the trimmed input.
 * @example
 * normalizeCategoryValue('gear'); // 'Gear'
 */
function normalizeCategoryValue(value) {
  const trimmedValue = (value || '').trim();
  const matchedCoreCategory = CORE_CATEGORY_OPTIONS.find(
    (category) => category.toLowerCase() === trimmedValue.toLowerCase(),
  );
  return matchedCoreCategory || trimmedValue;
}

/**
 * Why: Main browse/search/filter catalog page. Filtering, search and sorting happen server-side
 * via `fetchProducts()`/`fetchCatalogConfig()`; errors show a friendly sentence via
 * `toUserMessage()`.
 * @returns {JSX.Element} The shop catalog with filters, sorting, pagination and product grid.
 */
export default function Shop() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const { run: runLoadMore, pending: loadingMore } = useSingleFlight();
  const [error, setError] = useState('');
  const [catalogConfig, setCatalogConfig] = useState(null);
  const [selectedSort, setSelectedSort] = useState('popular');
  const [selectedManufacturer, setSelectedManufacturer] = useState('');
  const [selectedModel, setSelectedModel] = useState('');

  // Why: Guards every fetch (page-1 and "Load more") so a response from a superseded request is
  // discarded instead of overwriting newer results.
  const requestIdRef = useRef(0);

  const searchQuery = typeof router.query.q === 'string' ? router.query.q.trim() : '';
  const queryCategory =
    typeof router.query.category === 'string' ? normalizeCategoryValue(router.query.category) : '';
  const querySubcategory = typeof router.query.sub === 'string' ? router.query.sub.trim() : '';
  const defaultSort = searchQuery ? 'relevance' : 'popular';

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

  // Why: Loads the filter panel's option lists once. Kept independent of the product fetch so a
  // config failure never blocks the page — it just renders without those filter options.
  useEffect(() => {
    let cancelled = false;
    fetchCatalogConfig()
      .then((result) => {
        if (!cancelled) {
          setCatalogConfig(result);
        }
      })
      .catch((err) => {
        console.error('[shop/catalog] catalog config', err?.code || err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Why: A stable primitive to depend on for the fetch effect below. The backend accepts a
  // comma-separated brand list (any match), so every checked brand is sent.
  const brandKey = selectedBrands.join(',');

  /**
   * Why: Builds the `fetchProducts()` filters object from the current filter state. Shared by
   * the page-1 fetch effect and the "Load more" handler so both stay in sync.
   * @returns {object} Filters for `fetchProducts()` — prices in rands, category/condition as
   *   labels/keys, `undefined` for anything not currently set.
   * @example
   * const filters = buildFilters(); // { category: 'Gear', sort: 'relevance', ... }
   */
  function buildFilters() {
    const manufacturerActive =
      Boolean(selectedManufacturer) && selectedManufacturer !== 'Universal';
    const modelActive =
      manufacturerActive && selectedManufacturer !== 'Other' && Boolean(selectedModel);

    return {
      q: searchQuery || undefined,
      category: selectedCategory || undefined,
      subcategory: selectedSubcategory || undefined,
      brand: brandKey || undefined,
      condition: selectedCondition || undefined,
      manufacturer: manufacturerActive ? selectedManufacturer : undefined,
      model: modelActive ? selectedModel : undefined,
      minPrice: priceMin === '' ? undefined : Number(priceMin),
      maxPrice: priceMax === '' ? undefined : Number(priceMax),
      sort: SORT_API_MAP[selectedSort] || defaultSort,
    };
  }

  // Why: Resets to page 1 and refetches when a filter changes (debounced); `buildFilters` and
  // `defaultSort` are left out of the deps because they derive from the listed state.
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError('');

      fetchProducts({ ...buildFilters(), limit: PAGE_SIZE })
        .then(({ items: newItems, nextCursor: newNextCursor }) => {
          if (requestIdRef.current !== requestId) {
            return;
          }
          setItems(newItems);
          setNextCursor(newNextCursor);
        })
        .catch((err) => {
          if (requestIdRef.current !== requestId) {
            return;
          }
          setError(toUserMessage(err, "We couldn't load the shop right now. Please try again."));
          setItems([]);
          setNextCursor(null);
        })
        .finally(() => {
          if (requestIdRef.current === requestId) {
            setLoading(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchQuery,
    selectedCategory,
    selectedSubcategory,
    selectedManufacturer,
    selectedModel,
    brandKey,
    selectedCondition,
    priceMin,
    priceMax,
    selectedSort,
  ]);

  /**
   * Why: "Load more" button handler — fetches the next page with the cursor the server returned
   * and appends it to the current results, ignoring a stale response the same way the page-1
   * effect does.
   * @returns {void}
   * @example
   * <button onClick={handleLoadMore}>Load more</button>
   */
  function handleLoadMore() {
    if (!nextCursor) {
      return undefined;
    }

    return runLoadMore(async () => {
      const requestId = ++requestIdRef.current;

      try {
        const { items: newItems, nextCursor: newNextCursor } = await fetchProducts({
          ...buildFilters(),
          cursor: nextCursor,
          limit: PAGE_SIZE,
        });
        if (requestIdRef.current !== requestId) {
          return;
        }
        setItems((current) => [...current, ...newItems]);
        setNextCursor(newNextCursor);
      } catch (err) {
        if (requestIdRef.current !== requestId) {
          return;
        }
        setError(toUserMessage(err, "We couldn't load more products right now. Please try again."));
      }
    });
  }

  const categoryOptions = (catalogConfig?.categories || []).map((category) => category.label);

  const selectedCategoryConfig = catalogConfig?.categories.find(
    (category) => category.label === selectedCategory,
  );
  const subcategoryOptions = !catalogConfig
    ? []
    : selectedCategoryConfig
      ? selectedCategoryConfig.subcategories || []
      : Array.from(
          new Set(catalogConfig.categories.flatMap((category) => category.subcategories || [])),
        ).sort((a, b) => a.localeCompare(b));

  const brandOptions = catalogConfig?.brands || [];
  const filteredBrandOptions = brandOptions.filter((brand) =>
    brand.toLowerCase().includes(brandFilterQuery.toLowerCase().trim()),
  );
  const conditionOptions = catalogConfig?.conditions || [];
  const manufacturerOptions = catalogConfig?.bikeManufacturers || [];
  const selectedManufacturerConfig = manufacturerOptions.find(
    (manufacturer) => manufacturer.name === selectedManufacturer,
  );
  const modelOptions = selectedManufacturerConfig?.models || [];

  const sliderMax = PRICE_CEILING_RANDS;
  const sliderMinValue = Math.max(0, Math.min(priceMin === '' ? 0 : Number(priceMin), sliderMax));
  const sliderMaxValue = Math.max(
    sliderMinValue,
    Math.min(priceMax === '' ? sliderMax : Number(priceMax), sliderMax),
  );
  const sliderMinPercent = sliderMax > 0 ? (sliderMinValue / sliderMax) * 100 : 0;
  const sliderMaxPercent = sliderMax > 0 ? (sliderMaxValue / sliderMax) * 100 : 100;

  // Why: With filtering server-side, an empty page can mean either "the whole catalog is empty"
  // or "these filters matched nothing" — there's no unfiltered count to tell them apart anymore.
  // Treat "no filters active" as the first case, matching the original page's intent closely.
  const hasActiveFilters = Boolean(
    searchQuery ||
    selectedCategory ||
    selectedSubcategory ||
    selectedBrands.length > 0 ||
    selectedCondition ||
    priceMin ||
    priceMax ||
    (selectedManufacturer && selectedManufacturer !== 'Universal') ||
    selectedModel,
  );

  const activeFilterSummary = [
    selectedCategory,
    selectedSubcategory,
    selectedBrands.length > 0 ? `Brands (${selectedBrands.length})` : '',
    selectedCondition,
    priceMin || priceMax ? `Price ${priceMin || '0'}-${priceMax || 'max'}` : '',
  ]
    .filter(Boolean)
    .join(' • ');

  /**
   * Why: Category <select> onChange — also clears the subcategory, since the previous
   * subcategory choice may not exist under the newly picked category.
   * @param {React.ChangeEvent<HTMLSelectElement>} event - The select change event.
   * @returns {void}
   * @example
   * <select onChange={handleCategoryChange}>...</select>
   */
  const handleCategoryChange = (event) => {
    const nextCategory = event.target.value;
    setSelectedCategory(nextCategory);
    setSelectedSubcategory('');
  };

  /**
   * Why: "Clear all" resets every filter control back to its default.
   * @returns {void}
   * @example
   * <button onClick={clearFilters}>Clear all</button>
   */
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

  /**
   * Why: Builds the filter controls shared by the desktop sidebar and the mobile drawer.
   * @returns {JSX.Element} The filters panel.
   */
  const renderFiltersPanel = () => (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold uppercase tracking-[0.1em] text-slate-700">
          Filters
        </h2>
        <button
          type="button"
          onClick={clearFilters}
          className="text-sm font-semibold uppercase tracking-[0.08em] text-[#00C5CD] hover:text-[#00CED1]"
        >
          Clear all
        </button>
      </div>
      <div className="mt-4 space-y-4">
        <label className="block">
          <span className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">
            Category
          </span>
          <select
            value={selectedCategory}
            onChange={handleCategoryChange}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-700"
          >
            <option value="">All categories</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">
            Subcategory
          </span>
          <select
            value={selectedSubcategory}
            onChange={(event) => setSelectedSubcategory(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-700"
          >
            <option value="">All subcategories</option>
            {subcategoryOptions.map((subcategory) => (
              <option key={subcategory} value={subcategory}>
                {subcategory}
              </option>
            ))}
          </select>
        </label>

        {/* Manufacturer filter */}
        <label className="block mt-4">
          <span className="text-sm font-medium text-slate-700">Bike Manufacturer</span>
          <select
            value={selectedManufacturer}
            onChange={(e) => {
              setSelectedManufacturer(e.target.value);
              setSelectedModel('');
            }}
            className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <option value="">All Manufacturers</option>
            {manufacturerOptions.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        {/* Model filter, only show if manufacturer is selected and not Universal/Other */}
        {selectedManufacturer &&
          selectedManufacturer !== 'Universal' &&
          selectedManufacturer !== 'Other' && (
            <label className="block mt-4">
              <span className="text-sm font-medium text-slate-700">Bike Model</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <option value="">All Models</option>
                {modelOptions.map((mod) => (
                  <option key={mod} value={mod}>
                    {mod}
                  </option>
                ))}
              </select>
            </label>
          )}

        {renderBrandFilter()}

        <label className="block">
          <span className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">
            Condition
          </span>
          <select
            value={selectedCondition}
            onChange={(event) => setSelectedCondition(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-700"
          >
            <option value="">All</option>
            {conditionOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">
            Price range
          </span>
          <div className="mt-2 space-y-3">
            <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
              <span>Min: R{sliderMinValue}</span>
              <span>Max: R{sliderMaxValue}</span>
            </div>
            <div
              ref={priceSliderTrackRef}
              onMouseDown={handlePriceTrackMouseDown}
              className="relative h-6 cursor-ew-resize"
            >
              <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-200" />
              <div
                className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-900"
                style={{
                  left: `${sliderMinPercent}%`,
                  width: `${Math.max(sliderMaxPercent - sliderMinPercent, 0)}%`,
                }}
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

  /**
   * Why: Toggles one brand in/out of the multi-select brand filter's local selection.
   * @param {string} brand - The brand name to toggle.
   * @returns {void}
   * @example
   * toggleBrandSelection('Fox Racing');
   */
  const toggleBrandSelection = (brand) => {
    setSelectedBrands((current) => {
      if (current.includes(brand)) {
        return current.filter((item) => item !== brand);
      }

      return [...current, brand];
    });
  };

  const selectedBrandSummary =
    selectedBrands.length === 0
      ? 'All brands'
      : selectedBrands.length <= 2
        ? selectedBrands.join(', ')
        : `${selectedBrands.length} brands selected`;

  /**
   * Why: Builds the brand filter list inside the filters panel.
   * @returns {JSX.Element} The brand filter.
   */
  const renderBrandFilter = () => (
    <label className="block">
      <span className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">
        Brand
      </span>

      <div className="mt-2" ref={brandPickerRef}>
        <button
          type="button"
          onClick={() => setShowBrandPicker((current) => !current)}
          className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-3 text-left text-sm text-slate-700"
        >
          <span className="truncate">{selectedBrandSummary}</span>
          <span className="text-xs uppercase tracking-[0.08em] text-slate-500">
            {showBrandPicker ? 'Close' : 'Choose'}
          </span>
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
                    <label
                      key={brand}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-100"
                    >
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

  /**
   * Why: Keeps a dragged price-slider thumb within `[0, sliderMax]`.
   * @param {number} value - A candidate slider value in rands.
   * @returns {number} The value clamped to `[0, sliderMax]` (0 when not finite).
   * @example
   * clampPriceValue(-10); // 0
   */
  const clampPriceValue = (value) => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(value, sliderMax));
  };

  /**
   * Why: Converts a mouse X position over the slider track into a rand value, snapped to the
   * nearest 10, for both click-to-jump and drag interactions.
   * @param {number} clientX - The mouse event's `clientX`.
   * @returns {number|null} The rand value, or `null` if the track isn't mounted/measurable.
   * @example
   * const value = getSliderValueFromClientX(event.clientX);
   */
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

  /**
   * Why: Shared by drag-move and click-to-jump handling to move one thumb without crossing the
   * other.
   * @param {number} clientX - The mouse event's `clientX`.
   * @param {'min'|'max'} thumb - Which thumb is being moved.
   * @returns {void}
   * @example
   * updatePriceFromPointer(event.clientX, 'min');
   */
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

  /**
   * Why: Clicking the track jumps the nearer thumb to that position and starts dragging it.
   * @param {React.MouseEvent} event - The track's mousedown event.
   * @returns {void}
   * @example
   * <div onMouseDown={handlePriceTrackMouseDown} />
   */
  const handlePriceTrackMouseDown = (event) => {
    const nextValue = getSliderValueFromClientX(event.clientX);
    if (nextValue === null) {
      return;
    }

    const thumbToDrag =
      Math.abs(nextValue - sliderMinValue) <= Math.abs(nextValue - sliderMaxValue) ? 'min' : 'max';
    setDraggingPriceThumb(thumbToDrag);
    updatePriceFromPointer(event.clientX, thumbToDrag);
  };

  /**
   * Why: Starts dragging the min-price thumb without also triggering the track's own
   * mousedown handler.
   * @param {React.MouseEvent} event - The thumb's mousedown event.
   * @returns {void}
   * @example
   * <div onMouseDown={handleMinThumbMouseDown} />
   */
  const handleMinThumbMouseDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDraggingPriceThumb('min');
  };

  /**
   * Why: Starts dragging the max-price thumb without also triggering the track's own
   * mousedown handler.
   * @param {React.MouseEvent} event - The thumb's mousedown event.
   * @returns {void}
   * @example
   * <div onMouseDown={handleMaxThumbMouseDown} />
   */
  const handleMaxThumbMouseDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDraggingPriceThumb('max');
  };

  /**
   * Why: Keyboard/native-range fallback for moving the min-price thumb (accessibility path
   * alongside the custom-styled drag thumbs).
   * @param {React.ChangeEvent<HTMLInputElement>} event - The hidden range input's change event.
   * @returns {void}
   * @example
   * <input type="range" onChange={handleMinPriceSliderChange} />
   */
  const handleMinPriceSliderChange = (event) => {
    const nextMin = Math.min(Number(event.target.value), sliderMaxValue);
    setPriceMin(String(nextMin));
  };

  /**
   * Why: Keyboard/native-range fallback for moving the max-price thumb.
   * @param {React.ChangeEvent<HTMLInputElement>} event - The hidden range input's change event.
   * @returns {void}
   * @example
   * <input type="range" onChange={handleMaxPriceSliderChange} />
   */
  const handleMaxPriceSliderChange = (event) => {
    const nextMax = Math.max(Number(event.target.value), sliderMinValue);
    setPriceMax(String(nextMax));
  };

  useEffect(() => {
    if (!draggingPriceThumb) {
      return undefined;
    }

    /**
     * Why: Moves the dragged price handle with the mouse.
     * @param {MouseEvent} event - The mouse move event.
     */
    const handleMouseMove = (event) => {
      updatePriceFromPointer(event.clientX, draggingPriceThumb);
    };

    /**
     * Why: Ends a price handle drag.
     */
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

    /**
     * Why: Starts dragging a price handle.
     * @param {PointerEvent} event - The pointer down event.
     */
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
      ) : items.length === 0 && !hasActiveFilters ? (
        <p className="text-slate-600">No products are live yet. Admin approval is required.</p>
      ) : items.length === 0 ? (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-6">
          <button
            type="button"
            onClick={() => setShowMobileFilters((currentValue) => !currentValue)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-slate-700 shadow-sm lg:hidden"
          >
            {showMobileFilters ? 'Hide filters' : 'Show filters'}
          </button>
          <aside
            className={`${showMobileFilters ? 'block' : 'hidden'} h-fit rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:block lg:p-6`}
          >
            {renderFiltersPanel()}
          </aside>
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-slate-900">
              No products matched {searchQuery ? `"${searchQuery}"` : 'the selected filters'}.
            </p>
            <p className="mt-2 text-slate-600">
              Try a broader name, category, subcategory, brand, price, or condition.
            </p>
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
          <aside
            className={`${showMobileFilters ? 'block' : 'hidden'} h-fit rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:block lg:p-6`}
          >
            {renderFiltersPanel()}
          </aside>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              {searchQuery || activeFilterSummary ? (
                <p className="text-sm text-slate-500">
                  {items.length} result{items.length === 1 ? '' : 's'} found.
                </p>
              ) : (
                <span />
              )}
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
              {items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            {nextCursor ? (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
