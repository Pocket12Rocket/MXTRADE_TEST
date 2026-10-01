import SellingPriceInfo from './SellingPriceInfo';
import {
  MAX_DESCRIPTION_LENGTH,
  OTHER_BRAND_VALUE,
  OTHER_MANUFACTURER,
  OTHER_SUBCATEGORY_VALUE,
  UNIVERSAL_MANUFACTURER,
  defaultGearSizes,
  getSizeKind,
  getSizeOptions,
  getSubcategoryOptions,
} from '@/lib/listingForm';

const CONTROL_CLASS = 'mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3';

/**
 * Why: One place that renders a form field's error under its control, so client-side checks and
 * the backend's 422 `errors[]` (both mapped to form field names) look the same everywhere.
 * @param {object} props - Component props.
 * @param {string} [props.message] - The error text; nothing renders when empty.
 * @returns {JSX.Element|null} The error line.
 * @example
 * <FieldError message={errors.brand} />
 */
function FieldError({ message }) {
  return message ? <p className="mt-1 text-xs text-red-600">{message}</p> : null;
}

/**
 * Why: The listing form has a dozen labelled selects with identical markup; this renders any of
 * them from a list of options.
 * @param {object} props - Component props.
 * @param {string} props.label - Field label.
 * @param {React.ReactNode} [props.hint] - Extra text after the label, such as "(optional)".
 * @param {string} props.value - Selected value.
 * @param {(value: string) => void} props.onChange - Called with the new value.
 * @param {Array<{value: string, label: string}>} props.options - Choices.
 * @param {string} [props.emptyLabel] - Label of a leading empty choice; omit for none.
 * @param {boolean} [props.required] - Whether a choice is required.
 * @param {string} [props.error] - Error message to show under the select.
 * @returns {JSX.Element} The labelled select.
 * @example
 * <SelectField label="Condition" value={form.condition} onChange={(value) => onChange({ condition: value })} options={conditionOptions} required />
 */
function SelectField({ label, hint, value, onChange, options, emptyLabel, required, error }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">
        {label}
        {hint}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className={CONTROL_CLASS}
      >
        {emptyLabel !== undefined ? <option value="">{emptyLabel}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError message={error} />
    </label>
  );
}

/**
 * Why: The "Other" brand, category and manufacturer choices reveal the same free-text input.
 * @param {object} props - Component props.
 * @param {string} props.label - Field label.
 * @param {string} props.value - Current text.
 * @param {(value: string) => void} props.onChange - Called with the new text.
 * @param {string} props.placeholder - Placeholder text.
 * @param {boolean} [props.required] - Whether the input is required.
 * @returns {JSX.Element} The labelled input.
 * @example
 * <CustomTextField label="Enter brand name" value={form.customBrand} onChange={(value) => onChange({ customBrand: value })} placeholder="Type the brand name" />
 */
function CustomTextField({ label, value, onChange, placeholder, required }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        maxLength={60}
        placeholder={placeholder}
        className={CONTROL_CLASS}
      />
    </label>
  );
}

/**
 * Why: Description, price and quantity appear in every category; this renders them once.
 * @param {object} props - Component props.
 * @param {object} props.form - Form state.
 * @param {(patch: object) => void} props.onChange - Merges a patch into the form state.
 * @param {Object<string, string>} props.errors - Field errors by form field name.
 * @param {boolean} [props.serviceFeeWaived] - True on a fee-free listing (buyers pay the seller price).
 * @param {boolean} [props.showPrice] - Render price (default true).
 * @param {boolean} [props.showQuantity] - Render quantity.
 * @param {boolean} [props.showDescription] - Render description (default true).
 * @returns {JSX.Element} The fields.
 * @example
 * <CommonFields form={form} onChange={onChange} errors={errors} serviceFeeWaived={serviceFeeWaived} showQuantity />
 */
function CommonFields({
  form,
  onChange,
  errors,
  serviceFeeWaived = false,
  showPrice = true,
  showQuantity = false,
  showDescription = true,
}) {
  return (
    <>
      {showDescription ? (
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Description</span>
          <textarea
            rows="5"
            value={form.description}
            onChange={(event) => onChange({ description: event.target.value })}
            maxLength={MAX_DESCRIPTION_LENGTH}
            required
            className={CONTROL_CLASS}
          />
          <FieldError message={errors.description} />
        </label>
      ) : null}

      {showPrice ? (
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Price</span>
          <input
            type="number"
            value={form.price}
            onChange={(event) => onChange({ price: event.target.value })}
            required
            className={CONTROL_CLASS}
          />
          <FieldError message={errors.price} />
          <SellingPriceInfo price={form.price} serviceFeeWaived={serviceFeeWaived} />
        </label>
      ) : null}

      {showQuantity ? (
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Quantity available</span>
          <input
            type="number"
            min="1"
            max="100"
            value={form.quantity}
            onChange={(event) => onChange({ quantity: event.target.value })}
            required
            className={CONTROL_CLASS}
            placeholder="How many items do you have available?"
          />
          <FieldError message={errors.quantity} />
        </label>
      ) : null}
    </>
  );
}

/**
 * Why: The category-specific listing fields (gear, accessories, parts) shared by the seller
 * "submit" page and the edit dialog on "my submissions", so a field change is made once.
 * @param {object} props - Component props.
 * @param {object} props.form - Form state from `lib/listingForm.js`.
 * @param {(patch: object) => void} props.onChange - Merges a patch of form fields into the state.
 * @param {object} props.config - The backend `CatalogConfig`.
 * @param {Object<string, string>} [props.errors] - Field errors by form field name.
 * @param {boolean} [props.serviceFeeWaived] - True when editing a fee-free listing.
 * @returns {JSX.Element} The fields for `form.category`.
 * @example
 * <ListingFormFields form={form} onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))} config={config} errors={fieldErrors} />
 */
export default function ListingFormFields({
  form,
  onChange,
  config,
  errors = {},
  serviceFeeWaived = false,
}) {
  const conditionOptions = config.conditions.map((item) => ({
    value: item.key,
    label: item.label,
  }));
  const brandOptions = [
    ...config.brands.map((item) => ({ value: item, label: item })),
    { value: OTHER_BRAND_VALUE, label: 'Other (Add New Brand)' },
  ];
  const subcategoryOptions = getSubcategoryOptions(config, form.category).map((item) => ({
    value: item,
    label: item,
  }));
  const subcategoryWithOther = [
    ...subcategoryOptions,
    { value: OTHER_SUBCATEGORY_VALUE, label: 'Other' },
  ];
  /**
   * Why: Turns a list of strings into select options.
   * @param {string[]} list - The values.
   * @returns {Array<{value: string, label: string}>} The options.
   */
  const toOptions = (list) => list.map((item) => ({ value: item, label: item }));

  /**
   * Why: Changes the subcategory and clears any size that no longer applies.
   * @param {string} value - The chosen subcategory.
   */
  const handleSubcategoryChange = (value) =>
    onChange({
      subcategory: value,
      customSubcategory: value === OTHER_SUBCATEGORY_VALUE ? form.customSubcategory : '',
    });

  if (form.category === 'gear') {
    const sizeKind = getSizeKind(config, form.subcategory);
    const sizeLabels = {
      boots: 'Please provide the size of the boots',
      gloves: 'Please provide the size of the gloves',
    };

    return (
      <>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="What gear item do you wish to sell?"
            value={form.subcategory}
            onChange={(value) =>
              onChange({ subcategory: value, ...defaultGearSizes(config, value) })
            }
            options={subcategoryOptions}
            required
            error={errors.subcategory}
          />
          <SelectField
            label="Please describe the condition of the gear"
            value={form.condition}
            onChange={(value) => onChange({ condition: value })}
            options={conditionOptions}
            required
            error={errors.condition}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="What brand is the gear item?"
            value={form.brand}
            onChange={(value) =>
              onChange({
                brand: value,
                customBrand: value === OTHER_BRAND_VALUE ? form.customBrand : '',
              })
            }
            options={brandOptions}
            required
            error={errors.brand}
          />

          {form.brand === OTHER_BRAND_VALUE ? (
            <CustomTextField
              label="Enter brand name"
              value={form.customBrand}
              onChange={(value) => onChange({ customBrand: value })}
              placeholder="Type the brand name"
              required
            />
          ) : null}

          {['alpha', 'pants', 'boots', 'gloves'].includes(sizeKind) ? (
            <SelectField
              label={sizeLabels[sizeKind] || 'Please provide the size of the gear'}
              value={form.size}
              onChange={(value) => onChange({ size: value })}
              options={toOptions(getSizeOptions(config, sizeKind))}
              required
              error={errors.size}
            />
          ) : null}

          {sizeKind === 'combo' ? (
            <div className="grid gap-4 sm:grid-cols-2 sm:col-span-2">
              <SelectField
                label="Shirt size"
                value={form.comboShirt}
                onChange={(value) => onChange({ comboShirt: value })}
                options={toOptions(getSizeOptions(config, 'alpha'))}
                required
                error={errors.size}
              />
              <SelectField
                label="Pants size"
                value={form.comboPants}
                onChange={(value) => onChange({ comboPants: value })}
                options={toOptions(getSizeOptions(config, 'pants'))}
                required
              />
            </div>
          ) : null}

          {sizeKind === 'text' ? (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Please provide the size of the gear
              </span>
              <input
                value={form.size}
                onChange={(event) => onChange({ size: event.target.value })}
                required
                className={CONTROL_CLASS}
              />
              <FieldError message={errors.size} />
            </label>
          ) : null}
        </div>

        <CommonFields
          form={form}
          onChange={onChange}
          errors={errors}
          serviceFeeWaived={serviceFeeWaived}
          showQuantity
        />
      </>
    );
  }

  if (form.category === 'accessories') {
    return (
      <>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="What type of accessory is this?"
            value={form.subcategory}
            onChange={handleSubcategoryChange}
            options={subcategoryWithOther}
            required
            error={errors.subcategory}
          />

          {form.subcategory === OTHER_SUBCATEGORY_VALUE ? (
            <CustomTextField
              label="Enter accessory type"
              value={form.customSubcategory}
              onChange={(value) => onChange({ customSubcategory: value })}
              placeholder="Type the accessory type"
              required
            />
          ) : null}

          <SelectField
            label="Please describe the condition of the item"
            value={form.condition}
            onChange={(value) => onChange({ condition: value })}
            options={conditionOptions}
            required
            error={errors.condition}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Brand "
            hint={<span className="text-xs text-slate-500">(optional)</span>}
            value={form.brand}
            onChange={(value) =>
              onChange({
                brand: value,
                customBrand: value === OTHER_BRAND_VALUE ? form.customBrand : '',
              })
            }
            options={brandOptions}
            emptyLabel="-- Select or leave blank --"
            error={errors.brand}
          />

          {form.brand === OTHER_BRAND_VALUE ? (
            <CustomTextField
              label="Enter brand name"
              value={form.customBrand}
              onChange={(value) => onChange({ customBrand: value })}
              placeholder="Type the brand name"
            />
          ) : null}
        </div>

        <CommonFields
          form={form}
          onChange={onChange}
          errors={errors}
          serviceFeeWaived={serviceFeeWaived}
        />
      </>
    );
  }

  const manufacturerOptions = toOptions([
    ...config.bikeManufacturers
      .map((item) => item.name)
      .filter((name) => name !== UNIVERSAL_MANUFACTURER && name !== OTHER_MANUFACTURER),
    UNIVERSAL_MANUFACTURER,
    OTHER_MANUFACTURER,
  ]);
  const presetModels =
    config.bikeManufacturers.find((item) => item.name === form.manufacturer)?.models || [];
  const requiresModels = form.manufacturer && form.manufacturer !== UNIVERSAL_MANUFACTURER;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Product name</span>
          <input
            value={form.name}
            onChange={(event) => onChange({ name: event.target.value })}
            required
            className={CONTROL_CLASS}
          />
          <FieldError message={errors.name} />
        </label>
        <CommonFields
          form={form}
          onChange={onChange}
          errors={errors}
          serviceFeeWaived={serviceFeeWaived}
          showDescription={false}
          showQuantity
        />
        <SelectField
          label="Condition"
          value={form.condition}
          onChange={(value) => onChange({ condition: value })}
          options={conditionOptions}
          emptyLabel="Select condition"
          required
          error={errors.condition}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Part Brand "
          hint={<span className="text-xs text-slate-500">(optional)</span>}
          value={form.brand}
          onChange={(value) =>
            onChange({
              brand: value,
              customBrand: value === OTHER_BRAND_VALUE ? form.customBrand : '',
            })
          }
          options={brandOptions}
          emptyLabel="-- Select or leave blank --"
          error={errors.brand}
        />
        {form.brand === OTHER_BRAND_VALUE ? (
          <CustomTextField
            label="Enter brand name"
            value={form.customBrand}
            onChange={(value) => onChange({ customBrand: value })}
            placeholder="Type the brand name"
          />
        ) : null}
      </div>
      <SelectField
        label="Dirt Bike Category"
        value={form.subcategory}
        onChange={handleSubcategoryChange}
        options={subcategoryWithOther}
        emptyLabel="Select a category"
        required
        error={errors.subcategory}
      />

      {form.subcategory === OTHER_SUBCATEGORY_VALUE ? (
        <CustomTextField
          label="Enter parts category"
          value={form.customSubcategory}
          onChange={(value) => onChange({ customSubcategory: value })}
          placeholder="Type the parts category"
          required
        />
      ) : null}
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Fits Bike Manufacturer</span>
        <select
          value={form.manufacturer}
          onChange={(event) =>
            onChange({
              manufacturer: event.target.value,
              models: [],
              customModels: '',
              otherManufacturer: '',
            })
          }
          required
          className={CONTROL_CLASS}
        >
          <option value="">Select manufacturer</option>
          {manufacturerOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {form.manufacturer === OTHER_MANUFACTURER && (
          <input
            className={CONTROL_CLASS}
            placeholder="Enter manufacturer name"
            value={form.otherManufacturer}
            onChange={(event) => onChange({ otherManufacturer: event.target.value })}
            required
          />
        )}
        <FieldError message={errors.manufacturer} />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Fits Bike Model(s)</span>
        {requiresModels && presetModels.length > 0 ? (
          <div className="mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {presetModels.map((model) => (
                <label
                  key={model}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={form.models.includes(model)}
                    onChange={(event) =>
                      onChange({
                        models: event.target.checked
                          ? Array.from(new Set([...form.models, model]))
                          : form.models.filter((item) => item !== model),
                      })
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>{model}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {requiresModels ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-slate-500">Can't find your model here? Add it below!</p>
            <input
              value={form.customModels}
              onChange={(event) => onChange({ customModels: event.target.value })}
              placeholder="Type additional model names (comma separated)"
              className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
            />
          </div>
        ) : null}
        <FieldError message={errors.models} />
      </label>
      <CommonFields
        form={form}
        onChange={onChange}
        errors={errors}
        serviceFeeWaived={serviceFeeWaived}
        showPrice={false}
      />
    </>
  );
}
