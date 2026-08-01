// bm-design-system: label primitive
import * as React from "react";
import { cn } from "@/lib/utils";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn("mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted", className)}
        {...props}
      />
    );
  }
);
Label.displayName = "Label";

export { Label };
