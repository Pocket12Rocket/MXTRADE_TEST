import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  fetchAboutContent,
  fetchCatalogConfig,
  fetchFaqs,
  fetchNewProducts,
  fetchPopularProducts,
  fetchProductById,
  fetchProducts,
} from '@/lib/api/catalog';
import { cursorPaging } from '@/lib/queries/pagination';
import { queryKeys, type ProductListFilters } from '@/lib/queryKeys';

/**
 * Why: Catalog and shop pages load products page by page with a "Load more" cursor.
 * @param filters - Server-side filters and sort; a change starts a new list.
 * @returns The infinite query; pages hold `{items, nextCursor}`.
 * @example
 * const { data, fetchNextPage, hasNextPage } = useProducts({ category: 'Gear', sort: 'newest' });
 */
export function useProducts(filters: ProductListFilters = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.products.list(filters),
    queryFn: ({ pageParam }) => fetchProducts({ ...filters, cursor: pageParam ?? undefined }),
    ...cursorPaging,
  });
}

/**
 * Why: The product page shows one listing; a missing product resolves to `null` instead of an error.
 * @param id - Product UUID; nothing is fetched while empty.
 * @returns The query, with `data` the product or `null` when it doesn't exist.
 * @example
 * const { data: product, isPending } = useProduct(router.query.id as string);
 */
export function useProduct(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.products.detail(id ?? ''),
    queryFn: () => fetchProductById(id),
    enabled: Boolean(id),
  });
}

/**
 * Why: The home page's "popular" carousel.
 * @param category - Optional category label or key.
 * @param limit - Optional item count.
 * @returns The query of popular products.
 * @example
 * const { data } = usePopularProducts('Gear', 12);
 */
export function usePopularProducts(category?: string | null, limit?: number) {
  return useQuery({
    queryKey: [...queryKeys.products.popular(category), limit ?? null],
    queryFn: () => fetchPopularProducts({ category, limit }),
  });
}

/**
 * Why: The home page's "new arrivals" carousel.
 * @param category - Optional category label or key.
 * @param limit - Optional item count.
 * @returns The query of newly listed products.
 * @example
 * const { data } = useNewProducts('Parts');
 */
export function useNewProducts(category?: string | null, limit?: number) {
  return useQuery({
    queryKey: [...queryKeys.products.new(category), limit ?? null],
    queryFn: () => fetchNewProducts({ category, limit }),
  });
}

/**
 * Why: Filters and listing forms read categories, brands and conditions from the backend config,
 * which rarely changes, so it stays fresh for an hour.
 * @returns The catalog config query.
 * @example
 * const { data: config } = useCatalogConfig();
 */
export function useCatalogConfig() {
  return useQuery({
    queryKey: queryKeys.catalogConfig,
    queryFn: fetchCatalogConfig,
    staleTime: 60 * 60_000,
  });
}

/**
 * Why: The FAQ page shows the backend's FAQ list in display order.
 * @returns The FAQ query.
 * @example
 * const { data: faqs } = useFaqs();
 */
export function useFaqs() {
  return useQuery({ queryKey: queryKeys.faqs, queryFn: fetchFaqs, staleTime: 5 * 60_000 });
}

/**
 * Why: The About page shows content the admins edit.
 * @returns The About content query.
 * @example
 * const { data: about } = useAbout();
 */
export function useAbout() {
  return useQuery({
    queryKey: queryKeys.about,
    queryFn: fetchAboutContent,
    staleTime: 5 * 60_000,
  });
}
