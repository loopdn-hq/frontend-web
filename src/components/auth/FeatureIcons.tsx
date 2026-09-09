/**
 * The three glyphs on the sign-in panel's feature cards.
 *
 * Inline SVG rather than files: they render at 18px inside a 36px chip, where
 * a raster is soft on a non-retina screen, and drawn this way they take their
 * colour from the chip instead of baking it in.
 *
 * `cut` is the colour of the shapes knocked out of a filled glyph - the lines
 * inside the speech bubble. It defaults to the chip's own background so the
 * holes read as holes; pass the real background if the chip ever changes.
 */

type FeatureIconProps = {
  className?: string;
  cut?: string;
};

const CHIP_BACKGROUND = "#9CDAF8";

export function SmsWebIcon({
  className,
  cut = CHIP_BACKGROUND,
}: FeatureIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        d="M5 3.5h14A2.5 2.5 0 0 1 21.5 6v9a2.5 2.5 0 0 1-2.5 2.5h-7.1l-4.2 3.3A.9.9 0 0 1 6.3 20v-2.5H5A2.5 2.5 0 0 1 2.5 15V6A2.5 2.5 0 0 1 5 3.5Z"
        fill="currentColor"
      />
      <rect x="6" y="7.6" width="12" height="1.9" rx=".95" fill={cut} />
      <rect x="6" y="11.4" width="8" height="1.9" rx=".95" fill={cut} />
    </svg>
  );
}

export function VoiceIcon({ className }: FeatureIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <rect
        x="8.75"
        y="1.75"
        width="6.5"
        height="12"
        rx="3.25"
        fill="currentColor"
      />
      <path
        d="M5 10.25a7 7 0 0 0 14 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M12 17.5v4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AccessIcon({ className }: FeatureIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <circle cx="9.5" cy="7" r="4.25" fill="currentColor" />
      <path
        d="M1.75 20.5c0-4.28 3.47-7.75 7.75-7.75s7.75 3.47 7.75 7.75a.75.75 0 0 1-.75.75H2.5a.75.75 0 0 1-.75-.75Z"
        fill="currentColor"
      />
      <path
        d="M19.5 11.5v5.5M16.75 14.25h5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
