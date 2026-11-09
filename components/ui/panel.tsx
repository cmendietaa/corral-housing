import * as React from "react";
import { cn } from "@/lib/utils";

export function Panel({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "rounded-lg border border-line bg-surface p-4 shadow-soft sm:p-5",
        className
      )}
      {...props}
    />
  );
}
