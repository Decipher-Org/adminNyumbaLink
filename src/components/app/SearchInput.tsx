import { Search, X } from "lucide-react";
import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The search box above every table.
 *
 * Controlled by the caller, which then debounces the value before it reaches the
 * API — typing "kilimani" is one request, not eight. The clear button is a real
 * button rather than relying on the browser's own: `type="search"` gets a clear
 * affordance in WebKit and nothing in Firefox, and an operator clearing a filter
 * should not depend on which browser they opened.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
  ariaLabel = "Search",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn("pl-9", value ? "pr-9" : undefined)}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-0 flex size-9 -translate-y-1/2 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * The filter row: search grows, controls sit beside it on a tablet and stack on a
 * phone. Every table in this console uses it so the controls land in the same place
 * on each screen.
 */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:flex-wrap sm:items-center sm:p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
