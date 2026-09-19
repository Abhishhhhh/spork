interface AvatarProps {
  name: string
  photoUrl?: string | null
  size?: 'sm' | 'md' | 'big'
  className?: string
}

/** Squircle avatar — photo if available, otherwise Fredoka initial on soft grey. */
export function Avatar({ name, photoUrl, size = 'md', className = '' }: AvatarProps) {
  const sizeClass = size === 'big' ? 'bigavatar' : size === 'sm' ? 'sm' : ''
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className={`avatar ${sizeClass} ${className}`} />
  }
  return (
    <span className={`avatar ${sizeClass} ${className}`} aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  )
}
