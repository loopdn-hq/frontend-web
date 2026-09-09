import Image from "next/image";
import { Users } from "lucide-react";

type ChatAvatarProps = {
  name: string;
  imageUrl?: string | null;
  isGroup?: boolean;
  size?: number;
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
 * A conversation or person, as a circle.
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
  className = "",
}: ChatAvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${
        isGroup ? "bg-sky-500" : tintFor(name)
      } ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {isGroup ? (
        <Users style={{ width: size * 0.5, height: size * 0.5 }} />
      ) : (
        initial
      )}
    </span>
  );
}
