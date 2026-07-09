import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (message: string, type?: ToastType, duration?: number) => void;
  dismiss: (id: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev.slice(-4), { id, type, message, duration }]);
    if (duration > 0) setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ─── Icons & Styles per type ──────────────────────────────────────────────────
const typeConfig: Record<ToastType, { icon: ReactNode; className: string }> = {
  success: {
    icon: <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />,
    className: 'bg-gray-900 dark:bg-slate-800 border-emerald-500/40',
  },
  error: {
    icon: <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />,
    className: 'bg-gray-900 dark:bg-slate-800 border-red-500/40',
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />,
    className: 'bg-gray-900 dark:bg-slate-800 border-amber-500/40',
  },
  info: {
    icon: <Info className="w-5 h-5 shrink-0 text-indigo-400" />,
    className: 'bg-gray-900 dark:bg-slate-800 border-indigo-500/40',
  },
};

// ─── Container + individual toast ────────────────────────────────────────────
function ToastContainer({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none"
      style={{ direction: 'rtl' }}
    >
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} dismiss={dismiss} />
      ))}
    </div>
  );
}

const ToastItem: React.FC<{ toast: Toast; dismiss: (id: string) => void }> = ({ toast, dismiss }) => {
  const [visible, setVisible] = useState(false);
  const config = typeConfig[toast.type];

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => dismiss(toast.id), 300);
  };

  return (
    <div
      role="alert"
      className={`
        pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl
        transition-all duration-300 ease-out
        ${config.className}
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
      `}
    >
      {config.icon}
      <p className="flex-1 text-sm font-medium text-gray-100 leading-5">{toast.message}</p>
      <button
        onClick={handleDismiss}
        className="shrink-0 text-gray-400 hover:text-gray-200 transition-colors"
        aria-label="إغلاق"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
