import Image from "next/image";
import { Users } from "lucide-react";

type ChatAvatarProps = {
  name: string;
  imageUrl?: string | null;
  isGroup?: boolean;
  size?: number;
  /**
   * A circle for a person in a thread; a rounded square where the design lists
   * conversations - the chat list and the chat header.
   */
  shape?: "circle" | "square";
  className?: string;
};

// Deterministic, so one person keeps the same colour everywhere rather than
// changing every render or every list position.
const TINTS = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
];

function tintFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 997;
  }
  return TINTS[hash % TINTS.length];
}

/**
 * A conversation or person, as a circle or a rounded square.
 *
 * Falls back twice: to a group glyph where there is no picture and it is a
 * group, and to a tinted initial otherwise. A blank grey circle tells the
 * reader nothing, and every row having one makes the list unscannable.
 */
export function ChatAvatar({
  name,
  imageUrl,
  isGroup = false,
  size = 40,
  shape = "circle",
  className = "",
}: ChatAvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  // The design's 10px corner on a 45px square, kept in proportion at any size.
  const rounding =
    shape === "square" ? { borderRadius: Math.round(size * 0.22) } : undefined;
  const circle = shape === "circle" ? "rounded-full" : "";

  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 object-cover ${circle} ${className}`}
        style={{ width: size, height: size, ...rounding }}
        unoptimized
      />
    );
  }

  return (
    <span
      aria-hidden
      // A group wears the palette's accent; a person keeps their own tint,
      // which is about telling people apart, not about the theme.
      className={`flex shrink-0 items-center justify-center font-bold ${circle} ${
        isGroup ? "bg-brand text-on-brand" : `${tintFor(name)} text-white`
      } ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4, ...rounding }}
    >
      {isGroup ? (
        <Users style={{ width: size * 0.5, height: size * 0.5 }} />
      ) : (
        initial
      )}
    </span>
  );
}
