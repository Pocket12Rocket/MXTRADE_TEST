import { useState } from 'react';
import usePrivateImageUrl from '../lib/usePrivateImageUrl';

/**
 * Why: Shows a private image (refund photos) for signed-in buyers and guests. It is a plain
 * `<img>`, never `next/image`, because the image optimiser can't send credentials.
 * @param {object} props - Component props.
 * @param {string} props.url - The private image URL.
 * @param {string} [props.token] - Guest order token; omit or leave empty when signed in.
 * @param {string} props.alt - Alt text.
 * @param {string} [props.className] - Classes for the image and the placeholder.
 * @returns {JSX.Element} The image, a loading box, or a placeholder.
 * @example
 * <PrivateImage url={image.url} token={getOrderToken(order.id)} alt="Refund photo 1" className="h-32 w-full" />
 */
export default function PrivateImage({ url, token, alt, className }) {
  const { src, failed } = usePrivateImageUrl(url, token);
  const [broken, setBroken] = useState(false);
  if (failed || broken) {
    return (
      <div role="img" aria-label={alt} className={`flex items-center justify-center bg-slate-100 text-xs text-slate-500 ${className || ''}`}>
        Photo unavailable
      </div>
    );
  }
  if (!src) {
    return <div aria-hidden="true" className={`animate-pulse bg-slate-100 ${className || ''}`} />;
  }
  return <img src={src} alt={alt} className={className} onError={() => setBroken(true)} />;
}
