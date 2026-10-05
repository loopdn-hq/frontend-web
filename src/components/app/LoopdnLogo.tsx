import { Barlow } from "next/font/google";

// The wordmark's face in the design. Loaded here rather than in the root
// layout, so only pages that show the logo fetch it.
const barlow = Barlow({ weight: "700", subsets: ["latin"] });

/**
 * The Loopd'n mark and wordmark, as in the chat design's list header.
 *
 * Drawn in `currentColor`, so the caller's text colour - text-brand-ink - is
 * the logo's colour, and it follows the colour theme rather than a fixed blue.
 * The mark is public/favicon.svg's four petals, cropped to their bounds.
 */
export function LoopdnLogo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      role="img"
      aria-label="Loopd'n"
    >
      <svg
        aria-hidden
        viewBox="304 305 392 390"
        className="h-6 w-6 shrink-0"
        fill="currentColor"
      >
        <path d="M399.618 305.099C452.196 305.099 494.82 347.725 494.82 400.303C494.819 452.882 452.196 495.505 399.618 495.505C378.026 495.505 358.117 488.311 342.146 476.198L321.934 493.439C315.075 499.29 304.511 494.416 304.51 485.401V407.442C304.51 406.55 304.565 405.657 304.523 404.766C304.453 403.287 304.416 401.799 304.416 400.303C304.416 347.725 347.039 305.1 399.618 305.099Z" />
        <path d="M695.825 400.544C695.825 453.122 653.2 495.746 600.621 495.746C548.043 495.745 505.419 453.122 505.419 400.544C505.419 378.952 512.614 359.044 524.727 343.072L507.485 322.86C501.635 316.001 506.509 305.437 515.524 305.437L593.482 305.437C594.374 305.437 595.268 305.491 596.159 305.449C597.638 305.379 599.125 305.342 600.621 305.342C653.2 305.342 695.825 347.965 695.825 400.544Z" />
        <path d="M600.623 694.901C548.045 694.9 505.421 652.275 505.421 599.696C505.422 547.118 548.045 504.494 600.623 504.494C622.215 504.495 642.124 511.689 658.095 523.802L678.307 506.56C685.166 500.71 695.73 505.584 695.731 514.599L695.731 592.557C695.731 593.449 695.676 594.343 695.718 595.234C695.788 596.713 695.825 598.2 695.825 599.696C695.825 652.275 653.202 694.9 600.623 694.901Z" />
        <path d="M304.174 599.457C304.174 546.878 346.8 504.255 399.378 504.255C451.957 504.256 494.58 546.879 494.58 599.457C494.58 621.049 487.386 640.957 475.273 656.929L492.514 677.141C498.365 684 493.491 694.563 484.476 694.564L406.517 694.564C405.625 694.564 404.732 694.509 403.841 694.552C402.362 694.621 400.874 694.659 399.378 694.659C346.8 694.659 304.175 652.035 304.174 599.457Z" />
      </svg>
      {/* Pixels, not a text-* size: a logo keeps its size, and its proportion
          to the mark, when Settings → Appearance → Text size changes the
          words around it. */}
      <span
        aria-hidden
        className={`${barlow.className} text-[24px] leading-none font-bold tracking-[-0.05em]`}
      >
        Loopd&rsquo;n
      </span>
    </span>
  );
}
