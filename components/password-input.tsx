"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface Props {
  id?: string;
  name: string;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  disabled?: boolean;
  /** Extra CSS class for the <input>. Defaults to "form-input". */
  inputClassName?: string;
  /** Extra CSS class for the wrapper <div>. */
  wrapperClassName?: string;
  /** Controlled value — omit for uncontrolled. */
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function PasswordInput({
  id,
  name,
  placeholder = "••••••••",
  autoComplete,
  minLength,
  required,
  disabled,
  inputClassName = "form-input",
  wrapperClassName,
  value,
  onChange,
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`pw-field ${wrapperClassName ?? ""}`}>
      <input
        id={id}
        type={visible ? "text" : "password"}
        name={name}
        className={`${inputClassName} pw-field-input`}
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
        disabled={disabled}
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        className="pw-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
