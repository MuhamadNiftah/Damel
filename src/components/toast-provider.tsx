"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

type ToastVariant = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  push: (toast: Omit<Toast, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<
  ToastVariant,
  { border: string; icon: ReactNode; color: string }
> = {
  success: {
    border: "#bfe9d4",
    color: "#0b7a52",
    icon: <CheckCircle2 size={18} />,
  },
  error: {
    border: "#f6cfca",
    color: "#b42318",
    icon: <XCircle size={18} />,
  },
  warning: {
    border: "#f2dfa9",
    color: "#946b06",
    icon: <AlertTriangle size={18} />,
  },
  info: {
    border: "#cfe4f9",
    color: "#1d5f9f",
    icon: <Info size={18} />,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current.slice(-3), { ...toast, id }]);
      window.setTimeout(() => remove(id), 5200);
    },
    [remove],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (title, description) =>
        push({ title, description, variant: "success" }),
      error: (title, description) =>
        push({ title, description, variant: "error" }),
      info: (title, description) =>
        push({ title, description, variant: "info" }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[120] flex w-[min(92vw,380px)] flex-col gap-2.5">
        {toasts.map((toast) => {
          const style = VARIANT_STYLES[toast.variant];
          return (
            <div
              key={toast.id}
              className="animate-fade-up card pointer-events-auto flex items-start gap-3 p-3.5"
              style={{ borderColor: style.border }}
            >
              <span style={{ color: style.color }} className="mt-0.5">
                {style.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.8rem] font-bold text-ink-900">
                  {toast.title}
                </p>
                {toast.description ? (
                  <p className="mt-0.5 text-[0.72rem] leading-relaxed text-slate-500">
                    {toast.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => remove(toast.id)}
                className="icon-btn h-7 w-7"
                aria-label="Tutup notifikasi"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast harus dipakai di dalam ToastProvider.");
  }
  return context;
}
