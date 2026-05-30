import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-base font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-coral text-cream shadow-coral hover:bg-coral-600 hover:-translate-y-0.5 active:translate-y-0",
        secondary:
          "bg-ink text-cream hover:bg-inkSoft hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0",
        outline:
          "border border-ink/15 bg-transparent text-ink hover:bg-ink/[0.04] hover:border-ink/25",
        ghost: "text-ink hover:bg-ink/[0.04]",
        link: "text-coral underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-6",
        sm: "h-10 px-4 text-sm",
        lg: "h-14 px-8 text-lg",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
