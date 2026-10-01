/**
 * Why: Every cursor-paginated list shares the same infinite-query paging rules, so they're set
 * once here instead of per hook.
 */

/** Options that make `useInfiniteQuery` follow the backend's `{items, nextCursor}` pages. */
export const cursorPaging = {
  initialPageParam: null as string | null,
  getNextPageParam: (lastPage: { nextCursor: string | null }): string | null =>
    lastPage.nextCursor ?? null,
};

/**
 * Why: Pages read one flat list, not the nested page structure the query returns.
 * @param data - The infinite query's `data`.
 * @returns Every item across the loaded pages, in order.
 * @example
 * const orders = flattenPages(query.data);
 */
export function flattenPages<T>(data: { pages: Array<{ items: T[] }> } | undefined): T[] {
  return data ? data.pages.flatMap((page) => page.items) : [];
}
