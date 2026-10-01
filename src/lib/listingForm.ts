import { getFieldErrors, isApiProblem } from './apiClient';
import { toUserMessage } from './userMessage';
import type { SellerListing } from '@/lib/api/submissions';
import type { CatalogConfig, Category } from '@/lib/api/types';

/** The seller listing form's state: flat, every value a string except `category` and `models`. */
export interface ListingFormState {
  category: Category;
  name: string;
  /** Rands, as typed. */
  price: string;
  quantity: string;
  description: string;
  /** A condition key from the catalog config, or '' before one is chosen. */
  condition: string;
  subcategory: string;
  customSubcategory: string;
  brand: string;
  customBrand: string;
  size: string;
  comboShirt: string;
  comboPants: string;
  manufacturer: string;
  otherManufacturer: string;
  models: string[];
  customModels: string;
}

/** The form fields that can show an error. */
export type ListingFormField =
  | 'category'
  | 'subcategory'
  | 'name'
  | 'description'
  | 'condition'
  | 'brand'
  | 'manufacturer'
  | 'models'
  | 'size'
  | 'quantity'
  | 'price'
  | 'images';

/** Messages by form field. */
export type ListingFormErrors = Partial<Record<ListingFormField, string>>;

/** Which size input a gear item needs (`text` is a free-text size). */
export type SizeKind = CatalogConfig['gearSizes']['byGearItem'][string] | 'text';

/** What `describeSubmissionError` tells a page to show. */
export interface SubmissionErrorDescription {
  message: string;
  fieldErrors: ListingFormErrors;
  showProfileLink: boolean;
}

/**
 * Why: The seller "submit" and "my submissions" pages edit the same listing form. This module holds
 * the form state shape, defaults, validation, prefill and 422 error mapping once, driven by
 * `GET /catalog/config` (`fetchCatalogConfig()`). These checks only save a round trip to the backend.
 */

// Why: sentinel <option> values for the "Other" choices, which reveal a free-text input. The
// backend adds new brands and subcategories to the catalog when an admin approves the listing.
export const OTHER_BRAND_VALUE = '__other__';
export const OTHER_SUBCATEGORY_VALUE = '__other_subcategory__';

// Why: bike manufacturer choices that are not in the catalog config: fits every bike, or a make
// the catalog does not know yet (typed in by the seller).
export const UNIVERSAL_MANUFACTURER = 'Universal';
export const OTHER_MANUFACTURER = 'Other';

// Why: Listing limits: 3-5 photos per listing and descriptions of at most 500 characters.
export const MIN_LISTING_IMAGES = 3;
export const MAX_LISTING_IMAGES = 5;
export const MAX_DESCRIPTION_LENGTH = 500;
const MAX_QUANTITY = 100;

/**
 * Why: Model text inputs accept several models at once; this splits them into a clean unique list.
 * @param value - Text such as `'450 SX-F, 250 SX-F'` (commas, semicolons or new lines).
 * @returns Trimmed, de-duplicated, non-empty model names.
 * @example
 * parseModelInput('450 SX-F, 250 SX-F; 450 SX-F'); // ['450 SX-F', '250 SX-F']
 */
export function parseModelInput(value: string | null | undefined): string[] {
  return Array.from(
    new Set(
      String(value || '')
        .split(/[\n,;]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

/**
 * Why: Cropped photos are added one at a time; the same file must not be added twice.
 * @param existingFiles - Files already chosen.
 * @param incomingFiles - Files to add.
 * @returns Existing files followed by the incoming files that are not duplicates.
 * @example
 * const merged = mergeUniqueFiles(files, [croppedFile]);
 */
export function mergeUniqueFiles(
  existingFiles: File[] | null | undefined,
  incomingFiles: File[] | null | undefined,
): File[] {
  /**
   * Why: Builds a key that tells two picked files apart, so the same file is not added twice.
   * @param file - The picked file.
   * @returns The key.
   */
  const keyOf = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;
  const seen = new Set((existingFiles || []).map(keyOf));
  const merged = [...(existingFiles || [])];

  (incomingFiles || []).forEach((file) => {
    if (!seen.has(keyOf(file))) {
      seen.add(keyOf(file));
      merged.push(file);
    }
  });

  return merged;
}

/**
 * Why: A select with an "Other" option stores a sentinel; the value that is submitted is the typed
 * text in that case.
 * @param value - The select value (may be the sentinel).
 * @param custom - The free-text value.
 * @param otherValue - The sentinel that means "use the custom text".
 * @returns The trimmed value to submit ('' when nothing was chosen).
 * @example
 * resolveOther('__other__', ' Kayo ', OTHER_BRAND_VALUE); // 'Kayo'
 */
export function resolveOther(
  value: string | null | undefined,
  custom: string | null | undefined,
  otherValue: string,
): string {
  return String(value === otherValue ? custom : value || '').trim();
}

/**
 * Why: Case-insensitive lookup so an approved listing's stored value maps back to the catalog's
 * spelling (and only unknown values fall back to "Other").
 * @param options - Catalog values.
 * @param value - Stored value.
 * @returns The matching catalog value, if any.
 * @example
 * findOption(['Fox Racing'], 'fox racing'); // 'Fox Racing'
 */
function findOption(
  options: string[] | null | undefined,
  value: string | null | undefined,
): string | undefined {
  const wanted = String(value || '')
    .trim()
    .toLowerCase();
  return wanted ? (options || []).find((option) => option.toLowerCase() === wanted) : undefined;
}

/**
 * Why: Subcategory choices for a category (the gear items for gear) from the catalog config.
 * @param config - `CatalogConfig`.
 * @param categoryKey - `gear`, `parts` or `accessories`.
 * @returns Subcategory names ([] until the config has loaded).
 * @example
 * getSubcategoryOptions(config, 'gear'); // ['Boots', 'Gear Combo', ...]
 */
export function getSubcategoryOptions(
  config: CatalogConfig | null | undefined,
  categoryKey: string,
): string[] {
  return config?.categories?.find((category) => category.key === categoryKey)?.subcategories || [];
}

/**
 * Why: Which size input a gear item needs: `alpha`, `pants`, `boots`, `gloves`, `none`
 * (sizeless), `combo` (shirt and pants) or `text` (a free-text size), per `gearSizes.byGearItem`.
 * @param config - `CatalogConfig`.
 * @param gearItem - Gear item name.
 * @returns The size kind.
 * @example
 * getSizeKind(config, 'Goggles'); // 'none'
 */
export function getSizeKind(config: CatalogConfig | null | undefined, gearItem: string): SizeKind {
  return config?.gearSizes?.byGearItem?.[gearItem] || 'text';
}

/**
 * Why: The size choices for a size kind.
 * @param config - `CatalogConfig`.
 * @param kind - `alpha`, `pants`, `boots` or `gloves`.
 * @returns Size options ([] for other kinds).
 * @example
 * getSizeOptions(config, 'boots'); // ['UK1', ...]
 */
export function getSizeOptions(config: CatalogConfig | null | undefined, kind: SizeKind): string[] {
  const lists: Record<string, string[] | undefined> = config?.gearSizes?.lists ?? {};
  return lists[kind] || [];
}

/**
 * Why: When the seller changes the gear item, the previous size no longer applies; this returns
 * the default size fields for the new item.
 * @param config - `CatalogConfig`.
 * @param gearItem - The newly selected gear item.
 * @returns Default size fields.
 * @example
 * defaultGearSizes(config, 'Gear Combo'); // { size: '', comboShirt: 'XS', comboPants: '4' }
 */
export function defaultGearSizes(
  config: CatalogConfig | null | undefined,
  gearItem: string,
): Pick<ListingFormState, 'size' | 'comboShirt' | 'comboPants'> {
  const kind = getSizeKind(config, gearItem);
  if (kind === 'combo') {
    return {
      size: '',
      comboShirt: getSizeOptions(config, 'alpha')[0] || '',
      comboPants: getSizeOptions(config, 'pants')[0] || '',
    };
  }
  return { size: getSizeOptions(config, kind)[0] || '', comboShirt: '', comboPants: '' };
}

/**
 * Why: Blank form for a freshly chosen category, with the same first-option defaults the old
 * form used for selects that have no empty choice.
 * @param categoryKey - `gear`, `parts` or `accessories`.
 * @param config - `CatalogConfig`.
 * @returns A form state (see the module comment).
 * @example
 * const form = emptyListingForm('gear', config);
 */
export function emptyListingForm(
  categoryKey: Category,
  config: CatalogConfig | null | undefined,
): ListingFormState {
  const firstSubcategory = getSubcategoryOptions(config, categoryKey)[0] || '';
  const firstCondition = config?.conditions?.[0]?.key || '';
  const base: ListingFormState = {
    category: categoryKey,
    name: '',
    price: '',
    quantity: '1',
    description: '',
    condition: '',
    subcategory: firstSubcategory,
    customSubcategory: '',
    brand: '',
    customBrand: '',
    size: '',
    comboShirt: '',
    comboPants: '',
    manufacturer: '',
    otherManufacturer: '',
    models: [],
    customModels: '',
  };

  if (categoryKey === 'gear') {
    return {
      ...base,
      condition: firstCondition,
      brand: config?.brands?.[0] || '',
      ...defaultGearSizes(config, firstSubcategory),
    };
  }
  if (categoryKey === 'accessories') {
    return { ...base, condition: firstCondition };
  }
  return base;
}

/**
 * Why: Prefills the edit form from a listing (a submission being edited or resubmitted, or a live
 * product being edited) so the seller only changes what they want to.
 * @param listing - A listing from `toSellerListing()`.
 * @param config - `CatalogConfig`.
 * @returns A form state (see the module comment).
 * @example
 * const form = formFromListing(toSellerListing(submission), config);
 */
export function formFromListing(
  listing: SellerListing,
  config: CatalogConfig | null | undefined,
): ListingFormState {
  const categoryKey = listing.categoryKey;
  const subcategoryMatch = findOption(
    getSubcategoryOptions(config, categoryKey),
    listing.subcategory,
  );
  const brandMatch = findOption(config?.brands, listing.brand);
  const manufacturerMatch = findOption(
    (config?.bikeManufacturers || []).map((item) => item.name),
    listing.manufacturer,
  );
  const presetModels =
    config?.bikeManufacturers?.find((item) => item.name === manufacturerMatch)?.models || [];
  const listingModels = listing.models || [];

  let manufacturer = '';
  if (listing.universalFit) manufacturer = UNIVERSAL_MANUFACTURER;
  else if (manufacturerMatch) manufacturer = manufacturerMatch;
  else if (listing.manufacturer) manufacturer = OTHER_MANUFACTURER;

  const isOtherSubcategory = categoryKey !== 'gear' && listing.subcategory && !subcategoryMatch;

  return {
    ...emptyListingForm(categoryKey, config),
    name: listing.name || '',
    price: listing.sellerPrice ? String(listing.sellerPrice) : '',
    quantity: String(listing.quantity || 1),
    description: listing.description || '',
    condition: listing.condition || '',
    subcategory: isOtherSubcategory
      ? OTHER_SUBCATEGORY_VALUE
      : subcategoryMatch || listing.subcategory || '',
    customSubcategory: isOtherSubcategory ? listing.subcategory : '',
    brand: listing.brand ? brandMatch || OTHER_BRAND_VALUE : '',
    customBrand: listing.brand && !brandMatch ? listing.brand : '',
    size: listing.size || '',
    comboShirt: listing.comboSizes?.shirt || '',
    comboPants: listing.comboSizes?.pants || '',
    manufacturer,
    otherManufacturer: manufacturer === OTHER_MANUFACTURER ? listing.manufacturer : '',
    models: listingModels.filter((model) => presetModels.includes(model)),
    customModels: listingModels.filter((model) => !presetModels.includes(model)).join(', '),
  };
}

/**
 * Why: Client-side checks that mirror the backend's rules, so an obviously incomplete form is
 * caught before uploading up to five images. Keys match the form fields so the same map drives
 * the inline errors for both these checks and the backend's 422 `errors[]`.
 * @param form - The form state.
 * @param config - `CatalogConfig` (decides which size input applies).
 * @param imageCount - Kept plus new images.
 * @returns `{ formField: message }`; empty when the form is valid.
 * @example
 * const errors = validateListingForm(form, config, images.total);
 * if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
 */
export function validateListingForm(
  form: ListingFormState,
  config: CatalogConfig | null | undefined,
  imageCount: number,
): ListingFormErrors {
  const errors: ListingFormErrors = {};
  const description = form.description.trim();
  const quantity = Number(form.quantity);
  const subcategory = resolveOther(
    form.subcategory,
    form.customSubcategory,
    OTHER_SUBCATEGORY_VALUE,
  );

  if (!(Number(form.price) > 0)) errors.price = 'Please enter a valid price greater than 0.';
  if (!description) errors.description = 'Please add a description.';
  else if (description.length > MAX_DESCRIPTION_LENGTH)
    errors.description = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY)
    errors.quantity = `Quantity must be a whole number from 1 to ${MAX_QUANTITY}.`;
  if (!form.condition) errors.condition = 'Please choose a condition.';
  if (!subcategory) errors.subcategory = 'Please choose or enter a category.';

  if (form.category === 'gear') {
    const kind = getSizeKind(config, form.subcategory);
    if (!resolveOther(form.brand, form.customBrand, OTHER_BRAND_VALUE))
      errors.brand = 'Please choose or enter a brand.';
    if (kind === 'combo' && (!form.comboShirt || !form.comboPants))
      errors.size = 'Please choose both the shirt and pants size.';
    else if (kind !== 'combo' && kind !== 'none' && !form.size.trim())
      errors.size = 'Please provide the size.';
  }

  if (form.category === 'parts') {
    const isUniversal = form.manufacturer === UNIVERSAL_MANUFACTURER;
    if (!form.name.trim()) errors.name = 'Product name is required.';
    if (!form.manufacturer) errors.manufacturer = 'Please select a bike manufacturer.';
    else if (form.manufacturer === OTHER_MANUFACTURER && !form.otherManufacturer.trim())
      errors.manufacturer = 'Please enter the manufacturer name.';
    if (
      form.manufacturer &&
      !isUniversal &&
      form.models.length + parseModelInput(form.customModels).length === 0
    ) {
      errors.models = 'Please select or enter at least one bike model.';
    }
  }

  if (imageCount < MIN_LISTING_IMAGES || imageCount > MAX_LISTING_IMAGES) {
    errors.images = `Please add between ${MIN_LISTING_IMAGES} and ${MAX_LISTING_IMAGES} images.`;
  }

  return errors;
}

// Why: first segment of a backend error path (`data.<field>`) to the form field that shows it.
const ERROR_PATH_TO_FIELD: Record<string, ListingFormField> = {
  category: 'category',
  subcategory: 'subcategory',
  name: 'name',
  description: 'description',
  condition: 'condition',
  brand: 'brand',
  manufacturer: 'manufacturer',
  universalFit: 'manufacturer',
  models: 'models',
  size: 'size',
  comboSizes: 'size',
  quantity: 'quantity',
  sellerPriceCents: 'price',
  keepImageIds: 'images',
  images: 'images',
};

/**
 * Why: The backend's 422 `errors[]` uses paths like `data.brand`, `data.models.0` or `images.2`;
 * the form shows errors by field name. Paths it does not recognise are returned as general
 * messages so nothing the backend says is lost.
 * @param err - A caught error (non-problem errors give empty results).
 * @returns Messages by form field, plus
 *   messages that belong to no single field.
 * @example
 * const { fields, general } = mapSubmissionErrors(err); // fields.brand === 'Brand is required'
 */
export function mapSubmissionErrors(err: unknown): {
  fields: ListingFormErrors;
  general: string[];
} {
  const fields: ListingFormErrors = {};
  const general: string[] = [];

  Object.entries(getFieldErrors(err)).forEach(([path, message]) => {
    const segment = path.replace(/^data\.?/, '').split(/[.[]/)[0] ?? '';
    const field = ERROR_PATH_TO_FIELD[segment];
    if (!field) {
      general.push(message);
    } else if (!fields[field]) {
      fields[field] = message;
    }
  });

  return { fields, general };
}

/**
 * Why: A 409 `TERMS_VERSION_OUTDATED` needs a link to /profile next to its message.
 * @param err - A caught error.
 * @returns True when the seller must accept newer terms.
 * @example
 * if (isTermsOutdatedError(err)) { setShowProfileLink(true); }
 */
export function isTermsOutdatedError(err: unknown): boolean {
  return isApiProblem(err) && err.code === 'TERMS_VERSION_OUTDATED';
}

/**
 * Why: Both seller pages turn a failed create, edit, resubmit or delete into the same three
 * things: a message (always through `toUserMessage`), inline field errors from a 422, and whether
 * to offer the /profile link. One function keeps them consistent.
 * @param err - The caught error.
 * @param fallback - Action-specific sentence for unrecognised errors.
 * @returns What to show.
 * @example
 * const { message, fieldErrors, showProfileLink } = describeSubmissionError(err, "We couldn't submit your listing right now.");
 */
export function describeSubmissionError(
  err: unknown,
  fallback: string,
): SubmissionErrorDescription {
  const friendly = toUserMessage(err, fallback);
  const { fields, general } = mapSubmissionErrors(err);
  const hasFields = Object.keys(fields).length > 0;

  return {
    message:
      hasFields || general.length > 0
        ? ['Please fix the highlighted fields.', ...general].join(' ')
        : friendly,
    fieldErrors: fields,
    showProfileLink: isTermsOutdatedError(err),
  };
}
