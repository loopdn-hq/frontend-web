import Image from "next/image";

/**
 * A company's logo, or its initial on a tint when it has none. Round, as in
 * the company dropdown's design.
 */
export function CompanyLogo({
  name,
  logoUrl,
  size = 32,
  className = "",
}: {
  name: string;
  logoUrl: string | null;
  size?: number;
  className?: string;
}) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 rounded-full bg-white object-cover ${className}`}
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-sky-500 font-bold text-white ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
