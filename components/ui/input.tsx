import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-11 w-full rounded-full border border-divider bg-shell-light px-4 text-sm text-tar shadow-none transition placeholder:text-stone-600 hover:border-stone-500",
      className
    )}
    {...props}
  />
));

Input.displayName = "Input";
