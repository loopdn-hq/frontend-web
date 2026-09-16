import { RadioGroup } from "@/components/ui";
import { formatCents, type PricedOption } from "@/lib/enterprise/catalog";

type PricedOptionGroupProps<T extends string> = {
  legendId: string;
  options: PricedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  orientation?: "vertical" | "horizontal";
};

/** A RadioGroup whose option descriptions show the monthly price impact of each choice. */
export function PricedOptionGroup<T extends string>({
  legendId,
  options,
  value,
  onChange,
  orientation = "horizontal",
}: PricedOptionGroupProps<T>) {
  return (
    <RadioGroup
      name={legendId}
      value={value}
      onChange={onChange}
      orientation={orientation}
      aria-labelledby={legendId}
      options={options.map((option) => ({
        value: option.value,
        label: option.label,
        description:
          option.priceCents === 0
            ? "Included"
            : `+${formatCents(option.priceCents)}/mo`,
      }))}
    />
  );
}
