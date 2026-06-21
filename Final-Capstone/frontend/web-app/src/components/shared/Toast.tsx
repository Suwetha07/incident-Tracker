import React, { useEffect, useState } from 'react';
import type { ToastPayload, ToastType } from '../../utils/toast';

type ToastItem = ToastPayload & {
  id: number;
  type: ToastType;
};

const toastClasses = {
  success: 'border-green-500/40 bg-green-950/90 text-green-100',
  error: 'border-red-500/40 bg-red-950/90 text-red-100',
  info: 'border-blue-500/40 bg-blue-950/90 text-blue-100',
  warning: 'border-yellow-500/40 bg-yellow-950/90 text-yellow-100',
};

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastPayload>).detail;
      const id = Date.now() + Math.random();
      const toast: ToastItem = {
        id,
        title: detail.title,
        message: detail.message,
        type: detail.type || 'info',
        durationMs: detail.durationMs,
      };

      setToasts((current) => [...current, toast]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== id));
      }, detail.durationMs || 3500);
    };

    window.addEventListener('app-toast', handleToast);
    return () => window.removeEventListener('app-toast', handleToast);
  }, []);

  return (
    <div className="fixed right-5 top-5 z-[100] w-full max-w-sm space-y-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-lg border p-4 shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur ${toastClasses[toast.type]}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold">{toast.title}</p>
              {toast.message && <p className="mt-1 whitespace-pre-line text-sm opacity-85">{toast.message}</p>}
            </div>
            <button
              className="rounded px-2 text-sm font-bold opacity-75 hover:bg-white/10 hover:opacity-100"
              onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
              aria-label="Close notification"
            >
              x
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
