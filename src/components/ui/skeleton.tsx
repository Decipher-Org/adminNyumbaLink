import { cn } from "@/lib/utils";

/**
 * `bg-muted`, not shadcn's stock `bg-accent`. Upstream, `--accent` is a near-grey
 * used for subtle fills; here it is Coral, so the stock class made every loading
 * placeholder a block of solid brand orange.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
