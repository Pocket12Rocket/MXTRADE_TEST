import { useState } from 'react';
import usePrivateImageUrl from './usePrivateImageUrl';

interface PrivateImageProps {
  url: string;
  token?: string;
  alt: string;
  className?: string;
}

/**
 * Why: Shows a private image (refund photos) for signed-in buyers and guests. It is a plain
 * `<img>`, never `next/image`, because the image optimiser can't send credentials.
 * @param props - Component props.
 * @param props.url - The private image URL.
 * @param props.token - Guest order token; omit or leave empty when signed in.
 * @param props.alt - Alt text.
 * @param props.className - Classes for the image and the placeholder.
 * @returns The image, a loading box, or a placeholder.
 * @example
 * <PrivateImage url={image.url} token={getOrderToken(order.id)} alt="Refund photo 1" className="h-32 w-full" />
 */
export default function PrivateImage({ url, token, alt, className }: PrivateImageProps) {
  const { src, failed } = usePrivateImageUrl(url, token);
  const [broken, setBroken] = useState(false);
  if (failed || broken) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center bg-slate-100 text-xs text-slate-500 ${className || ''}`}
      >
        Photo unavailable
      </div>
    );
  }
  if (!src) {
    return <div aria-hidden="true" className={`animate-pulse bg-slate-100 ${className || ''}`} />;
  }
  return <img src={src} alt={alt} className={className} onError={() => setBroken(true)} />;
}
