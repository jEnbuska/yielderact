/**
 * Button — cyan by default, gray for the secondary action, red for the one
 * that destroys something.
 */
import type { PropsWithChildren } from "yract-beta";
import type { SEvent } from "yract-beta";

export type ButtonVariant = "primary" | "default" | "danger";

export interface ButtonProps extends PropsWithChildren {
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Submits the form it sits in. Defaults to a plain button. */
  type?: "button" | "submit" | "reset";
  onClick?: (event: SEvent<"click">) => void;
  "aria-label"?: string;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: "dos-btn",
  default: "dos-btn dos-btn--default",
  danger: "dos-btn dos-btn--danger",
};

export function* Button({
  variant = "primary",
  disabled,
  type = "button",
  onClick,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={variantClass[variant]}
      type={type}
      disabled={disabled}
      aria-label={rest["aria-label"]}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
