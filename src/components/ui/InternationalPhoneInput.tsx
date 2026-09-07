"use client";

import PhoneInput, { type Country } from "react-phone-number-input";

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
}: InternationalPhoneInputProps) {
  return (
    <PhoneInput
      international
      defaultCountry={defaultCountry}
      countryCallingCodeEditable={false}
      smartCaret={false}
      value={value || undefined}
      onChange={(nextValue) => onChange(nextValue ?? "")}
      className="intl-phone w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 transition focus-within:border-sky-500 focus-within:ring-4 focus-within:ring-sky-100"
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
