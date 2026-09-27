import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Catalog from '../../pages/shop/catalog';
import { fetchCatalogConfig, fetchProducts } from '../../lib/api/catalog';

let routerQuery = {};

vi.mock('next/router', () => ({
  useRouter: () => ({ isReady: true, query: routerQuery, push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('../../lib/api/catalog', () => ({
  CATEGORY_LABELS: { gear: 'Gear', parts: 'Parts', accessories: 'Accessories' },
  fetchCatalogConfig: vi.fn(),
  fetchProducts: vi.fn(),
}));

const baseConfig = {
  categories: [
    { key: 'gear', label: 'Gear', subcategories: ['Boots', 'Gloves'] },
    { key: 'parts', label: 'Parts', subcategories: ['Brakes', 'Engine'] },
    { key: 'accessories', label: 'Accessories', subcategories: ['Garage Mats'] },
  ],
  conditions: [
    { key: 'new_in_packaging', label: 'New in packaging' },
    { key: 'used_good', label: 'Used - good condition' },
  ],
  brands: ['Fox Racing', 'Alpinestars'],
  bikeManufacturers: [{ name: 'Honda', models: ['CRF450R'] }],
  gearSizes: {},
};

function makeProduct(id, name) {
  return { id, name, price: 199, category: 'Gear', primaryImage: null };
}

beforeEach(() => {
  routerQuery = {};
  vi.mocked(fetchCatalogConfig).mockReset();
  vi.mocked(fetchProducts).mockReset();
  vi.mocked(fetchCatalogConfig).mockResolvedValue(baseConfig);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Shop catalog', () => {
  it('loads page 1 using the category from the URL', async () => {
    routerQuery = { category: 'Gear' };
    vi.mocked(fetchProducts).mockResolvedValue({ items: [makeProduct('1', 'Fox Boots')], nextCursor: null });

    render(<Catalog />);

    await screen.findByText('Fox Boots');

    expect(fetchProducts).toHaveBeenCalledTimes(1);
    expect(fetchProducts).toHaveBeenCalledWith(expect.objectContaining({ category: 'Gear', limit: 24 }));
  });

  it('refetches from page 1 when a filter changes', async () => {
    vi.mocked(fetchProducts).mockResolvedValue({ items: [makeProduct('1', 'Fox Boots')], nextCursor: null });

    render(<Catalog />);
    await screen.findByText('Fox Boots');
    expect(fetchProducts).toHaveBeenCalledTimes(1);

    const categorySelect = screen.getByLabelText('Category');
    await userEvent.selectOptions(categorySelect, 'Parts');

    await waitFor(() => expect(fetchProducts).toHaveBeenCalledTimes(2));
    expect(fetchProducts).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'Parts', limit: 24 }));
    const lastCallFilters = vi.mocked(fetchProducts).mock.calls[1][0];
    expect(lastCallFilters.cursor).toBeUndefined();
  });

  it('appends results from "Load more" and passes the previous page\'s cursor', async () => {
    vi.mocked(fetchProducts)
      .mockResolvedValueOnce({ items: [makeProduct('1', 'Product A')], nextCursor: 'cursor-1' })
      .mockResolvedValueOnce({ items: [makeProduct('2', 'Product B')], nextCursor: null });

    render(<Catalog />);
    await screen.findByText('Product A');

    const loadMoreButton = screen.getByRole('button', { name: 'Load more' });
    await userEvent.click(loadMoreButton);

    await screen.findByText('Product B');
    expect(screen.getByText('Product A')).toBeInTheDocument();
    expect(fetchProducts).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'cursor-1', limit: 24 }));
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('shows a friendly message when the product fetch fails', async () => {
    vi.mocked(fetchProducts).mockRejectedValue({ name: 'ApiProblemError', status: 500, code: '' });

    render(<Catalog />);

    expect(await screen.findByText('Something went wrong on our side. Please try again in a moment.')).toBeInTheDocument();
  });
});
