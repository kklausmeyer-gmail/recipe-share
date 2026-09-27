import { Camera, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'

interface Props {
  files: File[]
  onChange: (files: File[]) => void
  label?: string
}

/** Pick one or more photos (on iPhone this offers the camera or the photo library). */
export default function PhotoPicker({ files, onChange, label = 'Add photos' }: Props) {
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {previews.map((src, i) => (
          <div key={src} className="relative h-20 w-20 overflow-hidden rounded-lg ring-1 ring-line">
            <img src={src} alt="" className="h-full w-full object-cover" />
            <span className="absolute bottom-0.5 left-1 rounded bg-black/50 px-1 text-[10px] text-white">{i + 1}</span>
            <button
              type="button"
              onClick={() => onChange(files.filter((_, j) => j !== i))}
              className="absolute right-0.5 top-0.5 rounded-full bg-black/50 p-0.5 text-white"
              aria-label="Remove"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line text-xs text-muted hover:border-accent hover:text-accent">
          <Camera size={20} />
          {label}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              onChange([...files, ...Array.from(e.target.files ?? [])])
              e.target.value = ''
            }}
          />
        </label>
      </div>
    </div>
  )
}
