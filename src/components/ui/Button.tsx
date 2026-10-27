import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-ink text-ink-foreground hover:opacity-90",
  accent: "bg-accent text-accent-foreground hover:opacity-90",
  secondary: "bg-subtle text-surface-foreground hover:bg-border/70",
  ghost: "text-muted hover:bg-subtle hover:text-surface-foreground",
  danger: "text-danger hover:bg-danger-soft",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "gap-1.5 px-3 py-1.5 text-xs",
  md: "gap-2 px-4 py-2 text-sm",
  lg: "gap-2 px-6 py-3 text-sm font-semibold",
  icon: "p-2",
};

/** Классы кнопки — для ссылок (<Link>/<a>), которые должны выглядеть как кнопка. */
export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = "") {
  const shape = size === "icon" ? "rounded-control" : "rounded-full";
  return `inline-flex shrink-0 items-center justify-center font-medium transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${shape} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, disabled, className = "", children, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={buttonClass(variant, size, className)}
      {...rest}
    >
      {loading && <Loader2 size={size === "sm" ? 12 : 16} className="animate-spin" />}
      {children}
    </button>
  );
});
