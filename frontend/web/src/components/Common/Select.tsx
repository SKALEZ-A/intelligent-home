import React from 'react';
import './Select.css';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  fullWidth?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  helperText,
  options,
  fullWidth = false,
  className = '',
  ...props
}) => {
  const classes = [
    'select-wrapper',
    fullWidth && 'select-wrapper--full-width',
    error && 'select-wrapper--error',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {label && <label className="select__label">{label}</label>}
      <select className="select" {...props}>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span className="select__error">{error}</span>}
      {helperText && !error && <span className="select__helper">{helperText}</span>}
    </div>
  );
};
