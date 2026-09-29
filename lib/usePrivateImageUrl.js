import { useEffect, useState } from 'react';
import { fetchPrivateImageBlob } from './api/orders';

/**
 * Why: Refund photos are private. A signed-in buyer's session cookie is sent with a plain
 * `<img>` request, so the URL can be used as-is; a guest has only the order token, which must go
 * in the `X-Order-Token` header, so the bytes are fetched and shown through a blob object URL.
 * The object URL is revoked when the component unmounts or the URL/token changes, so no memory
 * is leaked.
 * @param {string} url - The private image URL.
 * @param {string} [token] - Guest order token; empty means use the plain URL.
 * @returns {{src: string, failed: boolean}} `src` to render ('' while loading), and `failed`
 *   when the fetch did not succeed.
 * @example
 * const { src, failed } = usePrivateImageUrl(image.url, getOrderToken(order.id));
 */
export default function usePrivateImageUrl(url, token) {
  const [state, setState] = useState({ key: '', src: '', failed: false });
  const key = `${token || ''}|${url}`;

  useEffect(() => {
    if (!token) return undefined;
    let objectUrl = '';
    let cancelled = false;
    fetchPrivateImageBlob(url, token)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ key, src: objectUrl, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ key, src: '', failed: true });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, token, key]);

  if (!token) return { src: url, failed: false };
  // Ignore state left over from a previous url/token while the new one loads.
  if (state.key !== key) return { src: '', failed: false };
  return { src: state.src, failed: state.failed };
}
