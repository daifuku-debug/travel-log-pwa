import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonCommonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  className?: string;
}

type NativeButtonProps = ButtonCommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
    to?: undefined;
  };

type LinkButtonProps = ButtonCommonProps &
  Omit<LinkProps, 'className'> & {
    to: LinkProps['to'];
    disabled?: boolean;
  };

export type ButtonProps = NativeButtonProps | LinkButtonProps;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(props, ref) {
  const {
    children,
    variant = 'secondary',
    size = 'md',
    loading = false,
    icon,
    fullWidth = false,
    className,
  } = props;
  const classes = [
    'button',
    variantClassName(variant),
    `button--${size}`,
    fullWidth ? 'button--full' : '',
    loading ? 'button--loading' : '',
    className ?? '',
  ].filter(Boolean).join(' ');
  const content = (
    <>
      {loading && <span className="button__spinner" aria-hidden="true" />}
      {icon && <span className="button__icon" aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </>
  );

  if ('to' in props && props.to !== undefined) {
    const {
      children: _children,
      variant: _variant,
      size: _size,
      loading: _loading,
      icon: _icon,
      fullWidth: _fullWidth,
      className: _className,
      disabled,
      onClick,
      to,
      ...linkProps
    } = props;
    return (
      <Link
        {...linkProps}
        to={to}
        className={classes}
        aria-disabled={disabled || loading ? true : undefined}
        onClick={(event) => {
          if (disabled || loading) {
            event.preventDefault();
            return;
          }
          onClick?.(event);
        }}
      >
        {content}
      </Link>
    );
  }

  const {
    children: _children,
    variant: _variant,
    size: _size,
    loading: _loading,
    icon: _icon,
    fullWidth: _fullWidth,
    className: _className,
    disabled,
    type = 'button',
    ...buttonProps
  } = props;
  return (
    <button
      {...buttonProps}
      ref={ref}
      className={classes}
      disabled={disabled || loading}
      type={type}
      aria-busy={loading || undefined}
    >
      {content}
    </button>
  );
});

function variantClassName(variant: ButtonVariant): string {
  if (variant === 'primary') return 'button--primary';
  if (variant === 'danger') return 'button--danger';
  if (variant === 'ghost') return 'button--ghost';
  return 'button--secondary';
}
