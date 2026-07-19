import { createContext, useContext } from 'react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';
export interface ToastInput { title: string; variant?: ToastVariant; duration?: number; }
export interface ToastContextValue { showToast: (toast: ToastInput) => void; }

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}
