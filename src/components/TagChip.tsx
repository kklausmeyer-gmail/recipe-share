interface Props {
  name: string
  active?: boolean
  onClick?: () => void
  small?: boolean
}

export default function TagChip({ name, active, onClick, small }: Props) {
  const cls = `inline-flex shrink-0 items-center rounded-full border capitalize transition-colors ${
    small ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
  } ${active ? 'border-accent bg-accent text-white' : 'border-line bg-white text-ink/80 hover:border-accent/50'}`
  return onClick ? (
    <button type="button" className={cls} onClick={onClick}>
      {name}
    </button>
  ) : (
    <span className={cls}>{name}</span>
  )
}
