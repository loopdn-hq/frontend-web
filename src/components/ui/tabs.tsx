import { cn } from "@/lib/ui/cn";

export type TabsItem<T extends string = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type TabsProps<T extends string = string> = {
  value: T;
  items: TabsItem<T>[];
  onChange: (value: T) => void;
  className?: string;
  triggerClassName?: string;
};

export function Tabs<T extends string = string>({
  value,
  items,
  onChange,
  className,
  triggerClassName,
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;

        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-disabled={item.disabled}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={cn(
              "min-w-[120px] flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition",
              active
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800",
              item.disabled && "cursor-not-allowed opacity-50",
              triggerClassName,
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
