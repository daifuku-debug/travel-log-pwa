import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToastContext, type ToastInput, type ToastVariant } from './ToastContext';
interface ToastItem extends Required<ToastInput> { id: number; }
const VARIANT_LABELS: Record<ToastVariant, string> = {
  success: '成功', error: 'エラー', warning: '注意', info: 'お知らせ',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());
  const activeKeys = useRef(new Set<string>());
  const toastKeys = useRef(new Map<number, string>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    const key = toastKeys.current.get(id);
    if (key) activeKeys.current.delete(key);
    toastKeys.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((input: ToastInput) => {
    const variant = input.variant ?? 'info';
    const duration = input.duration ?? (variant === 'error' ? 6000 : 4000);
    const key = `${variant}:${input.title}`;
    if (activeKeys.current.has(key)) return;
    const id = nextId.current++;
    const item: ToastItem = { id, title: input.title, variant, duration };
    activeKeys.current.add(key);
    toastKeys.current.set(id, key);
    timers.current.set(id, window.setTimeout(() => dismiss(id), duration));
    setToasts((current) => [...current.slice(-2), item]);
  }, [dismiss]);

  const value = useMemo(() => ({ showToast }), [showToast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-host" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div className={`toast toast--${toast.variant}`} key={toast.id} role={toast.variant === 'error' ? 'alert' : 'status'}>
            <div><strong>{VARIANT_LABELS[toast.variant]}</strong><span>{toast.title}</span></div>
            <button type="button" aria-label={`${toast.title}を閉じる`} onClick={() => dismiss(toast.id)}>閉じる</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
