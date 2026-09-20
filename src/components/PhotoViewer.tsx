import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface PhotoViewerProps {
  src: string
  alt?: string
  onClose: () => void
  /** Optional extra actions shown at the bottom (e.g. "Change photo"). */
  actions?: { label: string; onClick: () => void }[]
}

/** Instagram-style full-screen photo — full image, no cropping, tap anywhere to close. */
export function PhotoViewer({ src, alt = '', onClose, actions }: PhotoViewerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  return createPortal(
    <div className="viewer animate-fade-in" role="dialog" aria-modal="true" onClick={onClose}>
      <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
      <button type="button" className="circle" aria-label="Close" onClick={onClose}>✕</button>
      {actions && actions.length > 0 && (
        <div className="viewer-actions" onClick={(e) => e.stopPropagation()}>
          {actions.map((a) => (
            <button key={a.label} type="button" className="pill" onClick={a.onClick}>{a.label}</button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  )
}
