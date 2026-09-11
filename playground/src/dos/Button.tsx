/**
 * Button — cyan by default, gray for the secondary action, red for the one
 * that destroys something.
 *
 * `type`, `disabled`, `onClick`, `aria-*` and the rest come from the native
 * button props; only `variant` is the kit's own.
 */
import type { ComponentProps } from "yract";

export type ButtonVariant = "primary" | "default" | "danger";

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: "dos-btn",
  default: "dos-btn dos-btn--default",
  danger: "dos-btn dos-btn--danger",
};

export function* Button({ variant = "primary", type = "button", children, ...rest }: ButtonProps) {
  return (
    <button {...rest} className={variantClass[variant]} type={type}>
      {children}
    </button>
  );
}
