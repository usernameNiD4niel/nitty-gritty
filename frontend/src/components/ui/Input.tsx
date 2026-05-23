import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`h-11 w-full rounded-lg border border-black bg-white px-3 text-sm outline-none ${className}`}
      {...props}
    />
  );
}
