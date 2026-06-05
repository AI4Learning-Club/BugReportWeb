import { X } from 'lucide-react';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const TOAST_EXIT_MS = 180;
const TOAST_AUTO_DISMISS_MS = 5000;
const MAX_VISIBLE_TOASTS = 4;

type ToastKind = 'error' | 'success';

type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
  closing?: boolean;
};

let toastId = 0;
let pushToastImpl: ((kind: ToastKind, message: string) => void) | null = null;

export function notifyError(message: string) {
  if (!message) return;
  pushToastImpl?.('error', message);
}

export function notifySuccess(message: string) {
  if (!message) return;
  pushToastImpl?.('success', message);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<number, number>>(new Map());

  const dismissToast = useCallback((id: number) => {
    setToasts((current) =>
      current.map((toast) => (toast.id === id ? { ...toast, closing: true } : toast))
    );
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      const timer = timersRef.current.get(id);
      if (timer) {
        window.clearTimeout(timer);
        timersRef.current.delete(id);
      }
    }, TOAST_EXIT_MS);
  }, []);

  const pushToast = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++toastId;
      setToasts((current) => [{ id, kind, message }, ...current].slice(0, MAX_VISIBLE_TOASTS));
      const timer = window.setTimeout(() => dismissToast(id), TOAST_AUTO_DISMISS_MS);
      timersRef.current.set(id, timer);
    },
    [dismissToast]
  );

  useEffect(() => {
    pushToastImpl = pushToast;
    return () => {
      pushToastImpl = null;
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    };
  }, [pushToast]);

  return (
    <>
      {children}
      {createPortal(
        <div className="toast-stack" aria-live="assertive" aria-relevant="additions">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`toast toast-${toast.kind}${toast.closing ? ' closing' : ''}`}
              role="alert"
            >
              <p className="toast-message">{toast.message}</p>
              <button
                className="toast-close"
                type="button"
                aria-label="关闭通知"
                onClick={() => dismissToast(toast.id)}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
