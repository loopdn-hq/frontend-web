"use client";

import { useState } from "react";
import { CreateLoopForm } from "./CreateLoopForm";

type CreateLoopModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (loopData: {
    name: string;
    description: string;
    joining_method: string;
    communication_mode: string;
    broadcast_reply_mode?: string;
  }) => void;
};

export function CreateLoopModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateLoopModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-2xl rounded-3xl border border-white/60 bg-white dark:bg-slate-900 shadow-[0_20px_80px_rgba(0,102,179,0.25)] backdrop-blur-sm">
        {/* Header */}
        <div className="border-b border-sky-100 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Create a Loop
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Set up a new group for your community
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[calc(100vh-200px)] overflow-y-auto px-6 py-6">
          <CreateLoopForm onClose={onClose} onSuccess={onSuccess} />
        </div>
      </div>
    </div>
  );
}
