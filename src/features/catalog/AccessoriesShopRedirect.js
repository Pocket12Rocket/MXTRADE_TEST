import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * Why: Sends old Accessories shop links to the catalog with the Accessories filter applied.
 * @returns {JSX.Element} A short redirecting notice.
 * @example
 * // Rendered at /shop/accessories
 * <AccessoriesShopRedirect />
 */
export default function AccessoriesShopRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const query = { category: 'Accessories' };
    if (typeof router.query.sub === 'string' && router.query.sub.trim()) {
      query.sub = router.query.sub.trim();
    }

    router.replace({ pathname: '/shop/catalog', query });
  }, [router]);

  return <p className="text-sm text-slate-600">Redirecting to shop...</p>;
}
