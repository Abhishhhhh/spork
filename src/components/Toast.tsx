/**
 * Minimal toast system — no external library.
 * Usage:
 *   import { useToast } from '../components/Toast'
 *   const { toast } = useToast()
 *   toast('Saved!', 'success')
 *
 * Mount <Toaster /> once in App.tsx (or HomeShell).
 */
import { createContext, useCallback, useContext, useRef, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  type: ToastType
  leaving: boolean
}

interface ToastCtx {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastCtx>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++counter.current
    setToasts((prev) => [...prev, { id, message, type, leaving: false }])

    // Start leave animation after 2.4s, remove after 2.6s
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 200)
    }, 2400)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <Toaster toasts={toasts} />
    </ToastContext.Provider>
  )
}

const TOAST_ICONS: Record<ToastType, string> = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
}

function Toaster({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-24 inset-x-0 z-[100] flex flex-col items-center gap-2 px-6 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 rounded-full px-5 py-3 text-[13px] font-semibold pointer-events-auto shadow-[0_8px_30px_#00000020]
            ${t.type === 'error' ? 'bg-error text-white' : 'bg-inverse text-inverse-ink'}
            ${t.leaving ? 'animate-toast-out' : 'animate-toast-in'}`}
        >
          <span className="text-xs">{TOAST_ICONS[t.type]}</span>
          {t.message}
        </div>
      ))}
    </div>
  )
}