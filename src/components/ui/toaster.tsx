"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { cn } from "@/lib/ui/cn";

export type ToastTone = "success" | "error" | "info";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
};

type Toast = ToastInput & { id: number };

const VISIBLE_FOR_MS = 5000;
// A stack that grows without limit covers the page it is reporting on.
const MAX_STACKED = 3;

const TONES: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: {
    icon: CheckCircle2,
    className:
      "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  },
  error: {
    icon: CircleAlert,
    className: "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
  },
  info: {
    icon: Info,
    className: "bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400",
  },
};

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

/**
 * Short confirmations in the top-right corner: "Company created".
 *
 * General purpose, unlike ActivityToasts, which is wired to the chat socket's
 * notification frames. Each toast leaves on its own after a few seconds, or
 * with its ×. Announced politely to screen readers.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (toast: ToastInput) => {
      nextId.current += 1;
      const id = nextId.current;
      setToasts((current) =>
        [...current, { ...toast, id }].slice(-MAX_STACKED),
      );
      window.setTimeout(() => dismiss(id), VISIBLE_FOR_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed top-4 right-4 z-[70] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => {
          const tone = TONES[toast.tone ?? "success"];
          const Icon = tone.icon;
          return (
            <div
              key={toast.id}
              role="status"
              className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.15)] motion-safe:animate-toast-in dark:border-slate-700 dark:bg-slate-900"
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  tone.className,
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 pt-0.5">
                <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {toast.title}
                </span>
                {toast.description && (
                  <span className="mt-0.5 block text-sm text-slate-600 dark:text-slate-400">
                    {toast.description}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss"
                className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/** Show a toast. Must be under a ToastProvider. */
export function useToast(): (toast: ToastInput) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast() must be used under ToastProvider.");
  return show;
}
