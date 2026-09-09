"use client";

import { type ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { Button } from "./button";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  maxWidthClassName?: string;
  bodyClassName?: string;
  footer?: ReactNode;
  closeLabel?: string;
  children: ReactNode;
};

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  maxWidthClassName,
  bodyClassName,
  footer,
  closeLabel = "Close modal",
  children,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "w-full rounded-3xl border border-sky-100 bg-white shadow-[0_20px_70px_rgba(14,88,148,0.25)] dark:border-slate-700 dark:bg-slate-900",
          maxWidthClassName ?? "max-w-md",
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={closeLabel}
            className="h-9 w-9 rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className={cn("px-6 py-5", bodyClassName)}>{children}</div>

        {footer && (
          <div className="border-t border-slate-100 px-6 py-4 dark:border-slate-700">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
