import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-display transition disabled:pointer-events-none disabled:opacity-55",
  {
    variants: {
      variant: {
        // Sunset = action. Tar text keeps 5.5:1 on sunset-500; hover lightens rather than darkens so text stays readable.
        primary: "bg-sunset-500 text-tar shadow-sm hover:bg-sunset-400 active:bg-sunset-300",
        secondary: "border border-divider bg-shell-light text-tar hover:bg-shell-mid",
        sea: "bg-sea-700 text-shell hover:bg-sea-800",
        ghost: "font-sans font-semibold text-stone-700 hover:bg-shell-mid hover:text-tar",
        danger: "font-sans font-semibold bg-danger text-white hover:bg-tar"
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-[15px]",
        lg: "h-14 px-6 text-lg",
        icon: "h-11 w-11 p-0"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { buttonVariants };
