import React from 'react';
import { Link } from 'react-router';
import './Button.scss';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonAs = 'button' | 'a' | typeof Link;

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  active?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
  form?: string;
  onClick?: React.MouseEventHandler<HTMLElement>;
  onMouseDown?: React.MouseEventHandler<HTMLElement>;
  as?: ButtonAs;
  href?: string;
  to?: string;
  target?: string;
  rel?: string;
  title?: string;
  /** Dialogs use this for the action that should take focus when they open. */
  initialFocus?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-haspopup'?: React.AriaAttributes['aria-haspopup'];
  'aria-expanded'?: boolean | 'true' | 'false';
  'aria-current'?: React.AriaAttributes['aria-current'];
};

function buildClassName({
  variant,
  size,
  iconOnly,
  active,
  fullWidth,
  disabled,
  className,
}: {
  variant: ButtonVariant;
  size: ButtonSize;
  iconOnly?: boolean;
  active?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
}): string {
  return [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    iconOnly ? 'btn--icon-only' : '',
    active ? 'btn--active' : '',
    fullWidth ? 'btn--full-width' : '',
    disabled ? 'btn--disabled' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  iconOnly = false,
  active = false,
  fullWidth = false,
  disabled = false,
  className,
  children,
  type = 'button',
  form,
  onClick,
  onMouseDown,
  as = 'button',
  href,
  to,
  target,
  rel,
  title,
  initialFocus = false,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'aria-haspopup': ariaHasPopup,
  'aria-expanded': ariaExpanded,
  'aria-current': ariaCurrent,
}) => {
  const classes = buildClassName({
    variant,
    size,
    iconOnly,
    active,
    fullWidth,
    disabled,
    className,
  });

  const sharedAria = {
    title,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    'aria-haspopup': ariaHasPopup,
    'aria-expanded': ariaExpanded,
    'aria-current': ariaCurrent,
  };

  if (as === 'a') {
    if (disabled) {
      return (
        <span
          className={classes}
          aria-disabled="true"
          role="link"
          {...sharedAria}
        >
          {children}
        </span>
      );
    }

    return (
      <a
        className={classes}
        href={href}
        target={target}
        rel={rel}
        onClick={onClick}
        onMouseDown={onMouseDown}
        {...sharedAria}
      >
        {children}
      </a>
    );
  }

  if (as === Link) {
    if (disabled || to == null) {
      return (
        <span
          className={classes}
          aria-disabled="true"
          role="link"
          {...sharedAria}
        >
          {children}
        </span>
      );
    }

    return (
      <Link
        className={classes}
        to={to}
        target={target}
        rel={rel}
        onClick={onClick}
        onMouseDown={onMouseDown}
        {...sharedAria}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      form={form}
      className={classes}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={onMouseDown}
      data-initial-focus={initialFocus ? '' : undefined}
      {...sharedAria}
    >
      {children}
    </button>
  );
};

export default Button;
