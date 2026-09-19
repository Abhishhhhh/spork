import { useState } from 'react'

interface FeedImageProps {
  src: string
  alt: string
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
}

/**
 * FeedImage — a lazy-loaded image that:
 * 1. Shows a shimmer placeholder while loading
 * 2. Fades the image in smoothly on load
 *
 * Pass `className="photo"` (or `photo tall`) to get the rounded Spork photo shape.
 */
export function FeedImage({ src, alt, className = '', style, onClick }: FeedImageProps) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      {!loaded && <div className="skeleton absolute inset-0 z-10 !rounded-none" aria-hidden="true" />}
      <img
        src={src}
        alt={alt}
        decoding="async"
        loading="lazy"
        className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        onClick={onClick}
      />
    </div>
  )
}
