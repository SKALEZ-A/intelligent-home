import React from 'react';
import './Input.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  icon,
  fullWidth = false,
  className = '',
  ...props
}) => {
  const classes = [
    'input-wrapper',
    fullWidth && 'input-wrapper--full-width',
    error && 'input-wrapper--error',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {label && <label className="input__label">{label}</label>}
      <div className="input__container">
        {icon && <span className="input__icon">{icon}</span>}
        <input
          className={`input ${icon ? 'input--with-icon' : ''}`}
          {...props}
        />
      </div>
      {error && <span className="input__error">{error}</span>}
      {helperText && !error && <span className="input__helper">{helperText}</span>}
    </div>
  );
};
