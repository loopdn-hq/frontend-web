"use client";

import { useState } from "react";
import Image from "next/image";
import type { LinkPreview } from "@/lib/chat/conversations";

/**
 * The card under a message for the first link in it.
 *
 * Everything on it was fetched by the server when the message was sent, so
 * opening a chat does not make this browser visit the linked site. The picture
 * is the exception - its address is the site's - and it simply drops out if it
 * fails to load, rather than leaving a broken image in the thread.
 */
export function LinkPreviewCard({
  preview,
  mine,
}: {
  preview: LinkPreview;
  mine: boolean;
}) {
  const [pictureFailed, setPictureFailed] = useState(false);

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noreferrer noopener"
      className={`mt-2 block overflow-hidden rounded-xl border transition hover:opacity-90 ${
        mine
          ? "border-sky-200 bg-white/70 dark:border-sky-800 dark:bg-slate-900/40"
          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
      }`}
    >
      {preview.imageUrl && !pictureFailed && (
        <Image
          src={preview.imageUrl}
          alt=""
          width={400}
          height={210}
          unoptimized
          onError={() => setPictureFailed(true)}
          className="h-40 w-full object-cover"
        />
      )}
      <span className="block px-3 py-2">
        <span className="block truncate text-2xs tracking-wide text-slate-500 uppercase dark:text-slate-400">
          {preview.siteName || hostOf(preview.url)}
        </span>
        {preview.title && (
          <span className="mt-0.5 line-clamp-2 block text-sm font-semibold text-slate-900 dark:text-slate-100">
            {preview.title}
          </span>
        )}
        {preview.description && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-slate-600 dark:text-slate-300">
            {preview.description}
          </span>
        )}
      </span>
    </a>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
