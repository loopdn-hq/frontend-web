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
      className={`rounded-full bg-emerald-400 px-2 py-0.5 text-[11px] font-bold text-slate-900 ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
