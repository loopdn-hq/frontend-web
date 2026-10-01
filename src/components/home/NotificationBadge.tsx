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
      className={`rounded-md bg-brand px-1.5 py-0.5 text-3xs leading-none font-semibold text-on-brand ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
