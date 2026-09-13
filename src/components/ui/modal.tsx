"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { useReturnFocus } from "@/lib/hooks/useReturnFocus";
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
  const dialog = useRef<HTMLDivElement>(null);

  // Focus goes in when the dialog opens and comes back out when it closes -
  // the second half via useReturnFocus, whose own docstring asks for exactly
  // this rather than a second copy per dialog. Without the first half, a
  // dialog opened from a button leaves focus on that button BEHIND the
  // overlay, and Tab walks a page the reader cannot see.
  useReturnFocus(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const node = dialog.current;
    // Only if nothing inside has claimed it already: a form that autofocuses
    // its first field, or a caller that focuses a particular input, has made a
    // better choice than "the dialog itself" and must not be overridden.
    if (node && !node.contains(document.activeElement)) node.focus();
  }, [isOpen]);

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
        ref={dialog}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          "w-full rounded-3xl border border-sky-100 bg-white shadow-[0_20px_70px_rgba(14,88,148,0.25)] focus:outline-none dark:border-slate-700 dark:bg-slate-900",
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
