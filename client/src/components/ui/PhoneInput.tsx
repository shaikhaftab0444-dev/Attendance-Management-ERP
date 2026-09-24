import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';

export const extractPhoneDigits = (val?: string | null): string => {
  if (!val) return '';
  const str = String(val).trim();
  if (str.startsWith('+91')) {
    return str.slice(3).replace(/\D/g, '').slice(0, 10);
  }
  let digits = str.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }
  return digits.slice(0, 10);
};

export const isPhoneValid = (val?: string | null): boolean => {
  if (!val || String(val).trim() === '') return true; // optional field
  const digits = extractPhoneDigits(val);
  return digits.length === 10 && /^[6-9]/.test(digits);
};

export interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  id?: string;
  name?: string;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  label = 'Phone Number',
  required = false,
  placeholder = '9876543210',
  disabled = false,
  error: externalError,
  helperText,
  id,
  name,
}) => {
  const [touched, setTouched] = useState<boolean>(false);

  // Always derived strictly from the raw digits of value (never contains +91)
  const rawDigits = extractPhoneDigits(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextDigits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setTouched(true);
    onChange(nextDigits);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow navigation, deletion, shortcuts
    if (
      ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Home', 'End'].includes(e.key) ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey
    ) {
      return;
    }

    // Ignore non-digits
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
      return;
    }

    // Block 11th digit keystroke if already at 10 digits and nothing is highlighted/selected
    const target = e.currentTarget;
    const hasSelection = (target.selectionEnd ?? 0) - (target.selectionStart ?? 0) > 0;
    if (rawDigits.length >= 10 && !hasSelection) {
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const pastedDigits = extractPhoneDigits(pastedText);
    setTouched(true);
    onChange(pastedDigits);
  };

  const handleBlur = () => {
    setTouched(true);
  };

  // Immediate validation (surfaces invalid legacy numbers on render)
  const hasInvalidStart = rawDigits.length > 0 && !/^[6-9]/.test(rawDigits);
  const hasIncompleteDigits = (touched || (value && value.trim().length > 0)) && rawDigits.length > 0 && rawDigits.length < 10;
  const isRequiredMissing = touched && required && rawDigits.length === 0;

  let validationError = externalError;
  if (!validationError) {
    if (hasInvalidStart) {
      validationError = `Invalid mobile number (+91 ${rawDigits} does not start with 6, 7, 8, or 9). Please correct it.`;
    } else if (hasIncompleteDigits) {
      validationError = `Phone number must be exactly 10 digits (${rawDigits.length}/10 entered).`;
    } else if (isRequiredMissing) {
      validationError = 'Phone number is required.';
    }
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div
        className={`flex items-center rounded-xl bg-slate-50 border transition-all overflow-hidden ${
          validationError
            ? 'border-rose-300 ring-2 ring-rose-500/10 bg-rose-50/20'
            : 'border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
      >
        {/* Fixed Non-Editable +91 Prefix Badge */}
        <div className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 border-r border-slate-200 select-none text-slate-700 font-mono text-xs font-bold shrink-0">
          <span className="text-xs">🇮🇳</span>
          <span>+91</span>
        </div>

        {/* 10 Digits Input */}
        <input
          id={id}
          name={name}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={10}
          value={rawDigits}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete="tel-national"
          className="w-full px-3 py-2.5 bg-transparent text-sm text-slate-900 placeholder-slate-400 font-mono tracking-wider focus:outline-none disabled:cursor-not-allowed"
        />

        {rawDigits.length > 0 && (
          <div className="pr-3 text-[11px] font-mono text-slate-400 font-medium shrink-0">
            {rawDigits.length}/10
          </div>
        )}
      </div>

      {validationError ? (
        <p className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{validationError}</span>
        </p>
      ) : helperText ? (
        <p className="text-[11px] text-slate-500 mt-1">{helperText}</p>
      ) : null}
    </div>
  );
};
