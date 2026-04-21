import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function PartsShopRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const query = { category: 'Parts' };
    if (typeof router.query.sub === 'string' && router.query.sub.trim()) {
      query.sub = router.query.sub.trim();
    }

    router.replace({ pathname: '/shop/catalog', query });
  }, [router]);

  return <p className="text-sm text-slate-600">Redirecting to shop...</p>;
}
