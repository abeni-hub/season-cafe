import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const buttonStyles = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border px-4 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9a7037] disabled:pointer-events-none disabled:opacity-55",
  {
    variants: {
      variant: {
        default: "border-[#38251f] bg-[#38251f] text-[#fffdfa] hover:bg-[#53392d]",
        outline: "border-[#d9cdbd] bg-transparent text-[#38251f] hover:bg-[#f0e9df]",
        ghost: "border-transparent bg-transparent text-[#685b52] hover:bg-[#f0e9df]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>;

export function Button({ className, variant, ...props }: ButtonProps) {
  return <button className={cn(buttonStyles({ variant }), className)} {...props} />;
}
