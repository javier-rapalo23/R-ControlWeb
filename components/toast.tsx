'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

type ToastKind = 'error' | 'success';

type ToastItem = {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
};

type ToastApi = {
  error: (message: string, title?: string) => void;
  success: (message: string, title?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

// Los errores se quedan más tiempo en pantalla: suelen requerir que el usuario lea y corrija algo.
const DURATION: Record<ToastKind, number> = { error: 7000, success: 3500 };
const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, message: string, title?: string) => {
    const id = nextId.current++;
    const item: ToastItem = {
      id,
      kind,
      title: title ?? (kind === 'error' ? 'No se pudo completar' : 'Listo'),
      message,
    };
    setToasts((current) => {
      // Evita apilar el mismo mensaje varias veces seguidas.
      const withoutDuplicate = current.filter((toast) => !(toast.kind === kind && toast.message === message));
      return [...withoutDuplicate, item].slice(-MAX_VISIBLE);
    });
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      error: (message, title) => push('error', message, title),
      success: (message, title) => push('success', message, title),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), DURATION[toast.kind]);
    return () => window.clearTimeout(timer);
  }, [paused, toast.id, toast.kind, onDismiss]);

  const Icon = toast.kind === 'error' ? AlertCircle : CheckCircle2;

  return (
    <div
      className={`toast toast--${toast.kind}`}
      role={toast.kind === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Icon size={20} className="toast__icon" aria-hidden="true" />
      <div className="toast__body">
        <strong className="toast__title">{toast.title}</strong>
        {toast.message ? <p className="toast__message">{toast.message}</p> : null}
      </div>
      <button type="button" className="toast__close" aria-label="Cerrar aviso" onClick={() => onDismiss(toast.id)}>
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe usarse dentro de ToastProvider');
  }
  return context;
}
