import { ClipboardList, ExternalLink, Users } from "lucide-react";

/** What the card's button does. The same values as a creative's `cta_kind`. */
export type SponsoredCtaKind =
  "call" | "text" | "link" | "group_join" | "lead_form";

/**
 * A creative as a member would see it in a group's chat: a labelled card,
 * never a message. Shared, outside any one area: the commercial builder and
 * campaign page preview it, the admin site reviews it, and the chat app draws
 * the real one (components/home/SponsoredSlot.tsx) - so all three show
 * "Sponsored" the same way.
 *
 * `ctaHref` makes the button a real link, opened in a new tab with no
 * referrer; `onCta` makes it a button that does something in the app (a lead
 * form). Without either - a preview - the button is only drawn.
 */
export function SponsoredCard({
  companyName,
  headline,
  body,
  imageUrl,
  ctaLabel,
  ctaKind,
  ctaHref,
  onCta,
}: {
  companyName: string;
  headline: string;
  body: string;
  imageUrl: string | null;
  ctaLabel: string;
  ctaKind: SponsoredCtaKind;
  ctaHref?: string;
  onCta?: () => void;
}) {
  const Icon =
    ctaKind === "group_join"
      ? Users
      : ctaKind === "lead_form"
        ? ClipboardList
        : ExternalLink;
  const button = (
    <>
      <Icon className="h-4 w-4" aria-hidden />
      {ctaLabel || "Button"}
    </>
  );
  const buttonClass =
    "inline-flex items-center gap-1.5 text-sm font-semibold text-sky-600 dark:text-sky-400";

  return (
    <article className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <p className="px-3 pt-2.5 text-2xs font-medium text-slate-500 dark:text-slate-400">
        Sponsored · {companyName}
      </p>
      {imageUrl && (
        // A presigned URL or a local preview: nothing for next/image to optimise.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="mt-2 aspect-[1.91/1] w-full object-cover"
        />
      )}
      <div className="space-y-1 px-3 py-2.5">
        <p className="text-sm font-semibold break-words text-slate-900 dark:text-slate-100">
          {headline || "Your headline"}
        </p>
        <p className="text-sm break-words whitespace-pre-line text-slate-600 dark:text-slate-300">
          {body || "What your ad says."}
        </p>
      </div>
      <div className="border-t border-slate-100 px-3 py-2 dark:border-slate-800">
        {onCta ? (
          <button
            type="button"
            onClick={onCta}
            className={`${buttonClass} hover:underline`}
          >
            {button}
          </button>
        ) : ctaHref ? (
          <a
            href={ctaHref}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className={`${buttonClass} hover:underline`}
          >
            {button}
          </a>
        ) : (
          <span className={buttonClass}>{button}</span>
        )}
      </div>
    </article>
  );
}
