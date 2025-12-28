import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all duration-180 ease-apple focus:outline-none focus:ring-2 focus:ring-ring/40 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: 
          "border-transparent bg-primary/90 text-primary-foreground shadow-sm backdrop-blur-sm hover:bg-primary",
        secondary: 
          "border-border/50 bg-secondary/80 text-secondary-foreground backdrop-blur-sm hover:bg-secondary",
        destructive: 
          "border-transparent bg-destructive/90 text-destructive-foreground shadow-sm backdrop-blur-sm hover:bg-destructive",
        outline: 
          "border-border/60 text-foreground bg-background/60 backdrop-blur-sm",
        success: 
          "border-transparent bg-success/90 text-success-foreground shadow-sm backdrop-blur-sm hover:bg-success",
        warning: 
          "border-transparent bg-warning/90 text-warning-foreground shadow-sm backdrop-blur-sm hover:bg-warning",
        glass: 
          "border-border/40 bg-background/60 text-foreground backdrop-blur-md shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };