import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>;

export function Button({ children, className = "", type = "button", ...props }: ButtonProps) {
  return (
    <button
      className={`h-9 rounded-md border border-black bg-white px-6 text-sm font-medium text-neutral-800 ${className}`}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
