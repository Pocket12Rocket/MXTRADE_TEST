import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * Why: Sends old Gear shop links to the catalog with the Gear filter applied.
 * @returns A short redirecting notice.
 * @example
 * // Rendered at /shop/gear
 * <GearShopRedirect />
 */
export default function GearShopRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const query: { category: string; sub?: string } = { category: 'Gear' };
    if (typeof router.query.sub === 'string' && router.query.sub.trim()) {
      query.sub = router.query.sub.trim();
    }

    router.replace({ pathname: '/shop/catalog', query });
  }, [router]);

  return <p className="text-sm text-slate-600">Redirecting to shop...</p>;
}
