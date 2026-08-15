import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The heading block every screen opens with. Uses the design sheet's H1 (28/700)
 * rather than Tailwind's display sizes, and stacks its actions below the title on
 * narrow screens so a long title never squeezes the buttons.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-h1 text-foreground">{title}</h1>
        {description ? (
          <p className="mt-1 text-body-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * A titled panel — the unit the dashboard is built from. Header and body are one
 * component rather than a `<Card>` per screen so the two dozen panels in this app
 * can't drift apart on padding.
 */
export function Panel({
  title,
  description,
  action,
  children,
  footer,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  /** Top-right slot: a range selector, a "View all" link, a demo badge. */
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-card", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-h3 text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-caption text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
      {footer ? (
        <div className="border-t border-border px-4 py-3 text-caption text-muted-foreground sm:px-5">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
