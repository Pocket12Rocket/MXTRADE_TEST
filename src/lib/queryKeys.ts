import type { ProductFilters } from '@/lib/api/catalog';
import type { SubmissionStatus } from '@/lib/api/types';

/** Filters that identify a product list; the cursor is the infinite query's page param. */
export type ProductListFilters = Omit<ProductFilters, 'cursor'>;

/** One cart line as the quote key sees it. */
interface QuoteKeyLine {
  id: string;
  quantity: number;
}

/**
 * Why: Every query key lives here so a mutation can invalidate exactly the screens it affects and
 * two hooks can never spell the same key differently. Keys nest (`all` before `list`/`detail`) so
 * invalidating a parent covers its children.
 * Order and checkout tokens are not part of the keys: the same id returns the same data.
 */
export const queryKeys = {
  me: ['me'] as const,
  catalogConfig: ['catalog', 'config'] as const,
  products: {
    all: ['products'] as const,
    list: (filters: ProductListFilters) => ['products', 'list', filters] as const,
    popular: (category?: string | null) => ['products', 'popular', category ?? null] as const,
    new: (category?: string | null) => ['products', 'new', category ?? null] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
  },
  faqs: ['faqs'] as const,
  about: ['about'] as const,
  orders: {
    all: ['orders'] as const,
    list: ['orders', 'list'] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
  },
  checkouts: {
    all: ['checkouts'] as const,
    quote: (items: QuoteKeyLine[]) =>
      ['checkouts', 'quote', items.map(({ id, quantity }) => ({ id, quantity }))] as const,
    detail: (id: string) => ['checkouts', 'detail', id] as const,
  },
  submissions: {
    all: ['submissions'] as const,
    list: (status?: SubmissionStatus) => ['submissions', 'list', status ?? null] as const,
    detail: (id: string) => ['submissions', 'detail', id] as const,
  },
  myProducts: {
    all: ['my-products'] as const,
    list: ['my-products', 'list'] as const,
    detail: (id: string) => ['my-products', 'detail', id] as const,
  },
  sellerProfile: ['seller-profile'] as const,
  serviceFeeQuote: (sellerPriceCents: number) => ['service-fee-quote', sellerPriceCents] as const,
};
