import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatRange } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The range line and page buttons under every table.
 *
 * The number list is windowed rather than complete, because these tables get
 * genuinely long — `Showing 1 to 5 of 12,540` is 2,508 pages, and rendering 2,508
 * buttons is both unusable and a real amount of DOM. The window is first ± two
 * around the current page ± last, with ellipses where pages are skipped, which
 * keeps the control a fixed width no matter how deep the table goes.
 *
 * On a phone the numbers are dropped entirely: Prev/Next plus "Page 3 of 2,508" is
 * legible at 360px where a row of numbered buttons is not.
 */
export function Pagination({
  page,
  limit,
  total,
  totalPages,
  onPageChange,
  className,
}: {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (total === 0) return null;

  const pages = pageWindow(page, totalPages);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5",
        className,
      )}
    >
      <p className="text-caption text-muted-foreground">{formatRange(page, limit, total)}</p>

      <nav className="flex items-center gap-1" aria-label="Pagination">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft />
          <span className="hidden sm:inline">Prev</span>
        </Button>

        {/* Numbers on tablet and up; a plain position readout on a phone. */}
        <span className="px-2 text-caption text-muted-foreground sm:hidden">
          Page {page} of {totalPages}
        </span>

        <div className="hidden items-center gap-1 sm:flex">
          {pages.map((entry, index) =>
            entry === "gap" ? (
              <span
                key={`gap-${index}`}
                aria-hidden="true"
                className="px-1 text-caption text-muted-foreground"
              >
                …
              </span>
            ) : (
              <Button
                key={entry}
                variant={entry === page ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(entry)}
                aria-label={`Page ${entry}`}
                aria-current={entry === page ? "page" : undefined}
                className="min-w-9 tabular-nums"
              >
                {entry}
              </Button>
            ),
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight />
        </Button>
      </nav>
    </div>
  );
}

/** First, last, and a window around the current page, with gaps marked. */
function pageWindow(page: number, totalPages: number): (number | "gap")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const window = new Set<number>([1, totalPages, page]);
  for (const offset of [-2, -1, 1, 2]) {
    const candidate = page + offset;
    if (candidate > 1 && candidate < totalPages) window.add(candidate);
  }

  const sorted = [...window].sort((a, b) => a - b);
  const result: (number | "gap")[] = [];

  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) result.push("gap");
    result.push(value);
  });

  return result;
}
