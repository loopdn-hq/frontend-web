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
        mine ? "border-on-bubble-out/30 bg-canvas" : "border-line bg-canvas"
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
        <span className="block truncate text-2xs tracking-wide text-ink-muted uppercase">
          {preview.siteName || hostOf(preview.url)}
        </span>
        {preview.title && (
          <span className="mt-0.5 line-clamp-2 block text-sm font-semibold text-ink">
            {preview.title}
          </span>
        )}
        {preview.description && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-ink-muted">
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
