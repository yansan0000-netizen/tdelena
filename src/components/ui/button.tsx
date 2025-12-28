import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-220 ease-apple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: 
          "bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:shadow-primary/20 hover:bg-primary/90 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/20 before:to-transparent before:opacity-100",
        destructive: 
          "bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90 hover:shadow-lg hover:shadow-destructive/20",
        outline: 
          "border border-border/60 bg-background/60 backdrop-blur-md hover:bg-muted/60 hover:border-border",
        secondary: 
          "bg-secondary/80 backdrop-blur-md text-secondary-foreground hover:bg-secondary border border-border/30",
        ghost: 
          "hover:bg-muted/60 hover:backdrop-blur-sm",
        link: 
          "text-primary underline-offset-4 hover:underline",
        glass: 
          "glass-button text-foreground",
        "glass-primary":
          "bg-primary/90 backdrop-blur-md text-primary-foreground border border-primary/50 shadow-md hover:bg-primary hover:shadow-lg hover:shadow-primary/25 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/25 before:to-transparent",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-lg px-4 text-xs",
        lg: "h-12 rounded-2xl px-8 text-base",
        xl: "h-14 rounded-2xl px-10 text-base font-semibold",
        icon: "h-11 w-11 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
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
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };