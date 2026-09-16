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
 * 1. Shows a blurred skeleton placeholder while loading (hides the left-to-right decode)
 * 2. Fades the image in smoothly on load
 * 3. Hides the placeholder once the image is visible
 *
 * The placeholder uses a solid bg-surface so there's never a half-loaded bar.
 */
export function FeedImage({ src, alt, className = '', style, onClick }: FeedImageProps) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="relative w-full overflow-hidden bg-surface" style={style}>
      {/* Shimmer placeholder — only visible while image is loading */}
      {!loaded && (
        <div
          className="skeleton absolute inset-0 z-10"
          aria-hidden="true"
        />
      )}
      <img
        src={src}
        alt={alt}
        decoding="async"
        loading="lazy"
        className={`w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
        style={style}
        onLoad={() => setLoaded(true)}
        onClick={onClick}
      />
    </div>
  )
}
