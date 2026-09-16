type NotificationBadgeProps = {
  count: number;
  className?: string;
};

// Renders nothing at 0 - a badge showing "0" reads as a notification.
export function NotificationBadge({
  count,
  className = "",
}: NotificationBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      className={`rounded-full bg-[#168CFF] px-2 py-0.5 text-2xs font-bold text-white ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
