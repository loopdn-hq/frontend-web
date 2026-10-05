"use client";

import PhoneInput, { type Country } from "react-phone-number-input";
import { cn } from "@/lib/ui/cn";

type InternationalPhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  autoFocus?: boolean;
  autoComplete?: string;
  defaultCountry?: Country;
  /** Merged over the default look, e.g. to match the ui kit's Input height. */
  className?: string;
};

export function InternationalPhoneInput({
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  id,
  name,
  autoFocus,
  autoComplete,
  defaultCountry = "US",
  className,
}: InternationalPhoneInputProps) {
  return (
    <PhoneInput
      international
      defaultCountry={defaultCountry}
      countryCallingCodeEditable={false}
      smartCaret={false}
      value={value || undefined}
      onChange={(nextValue) => onChange(nextValue ?? "")}
      className={cn(
        "intl-phone h-[56px] w-full rounded-[12px] border border-[#D7D7D7] bg-white px-[23px] text-[16px] leading-[150%] text-[#05205A] transition focus-within:border-[#3CB3FD] focus-within:ring-4 focus-within:ring-sky-100",
        className,
      )}
      numberInputProps={{
        id,
        name,
        onBlur,
        placeholder,
        autoFocus,
        autoComplete,
        disabled,
      }}
      disabled={disabled}
    />
  );
}
