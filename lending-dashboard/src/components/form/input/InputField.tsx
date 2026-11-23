import type React from "react";
import type { FC } from "react";

interface InputProps {
  type?: "text" | "number" | "email" | "password" | "date" | "time" | string;
  id?: string;
  name?: string;
  placeholder?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  min?: string;
  max?: string;
  step?: number;
  disabled?: boolean;
  success?: boolean;
  error?: boolean;
  hint?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  required?: boolean;
}

const Input: FC<InputProps> = ({
  type = "text",
  id,
  name,
  placeholder,
  value,
  onChange,
  className = "",
  min,
  max,
  step,
  disabled = false,
  success = false,
  error = false,
  hint,
  autoComplete,
  inputMode,
  maxLength,
  required,
}) => {
  let inputClasses = `h-10 w-full rounded-xl border appearance-none px-3.5 py-2 text-sm placeholder:text-text-secondary/70 focus:outline-hidden focus:ring-2 ${className}`;

  if (disabled) {
    inputClasses += ` text-text-secondary border-border opacity-40 bg-surface cursor-not-allowed dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700`;
  } else if (error) {
    inputClasses += ` border-rose-500 focus:border-rose-400 focus:ring-rose-500/20 dark:border-rose-500`;
  } else if (success) {
    inputClasses += ` border-success-500 focus:border-success-300 focus:ring-success-500/20 dark:border-success-500`;
  } else {
    inputClasses += ` bg-white text-text-primary border-border focus:border-brand-400 focus:ring-brand-500/20 dark:bg-gray-900 dark:border-gray-700 dark:text-white/90`;
  }

  return (
    <div className="relative">
      <input
        type={type}
        id={id}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        required={required}
        className={inputClasses}
        aria-invalid={error || undefined}
      />

      {hint && (
        <p
          className={`mt-1.5 text-xs font-medium ${
            error
              ? "text-rose-500 dark:text-rose-400"
              : success
              ? "text-success-500"
              : "text-text-secondary"
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  );
};

export default Input;
