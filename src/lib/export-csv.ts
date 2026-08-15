/**
 * CSV export of whatever rows a screen currently has loaded.
 *
 * There is no server-side export endpoint, so this cannot cover every page of a
 * 12,540-row table — the button that calls it says so, and the file's first line is
 * a comment recording the scope it actually covered. An export that silently
 * contains 10 of 12,540 rows is worse than no export.
 *
 * Written as a Blob download rather than a `data:` URI because a large table
 * overflows the URL length limit in some browsers.
 */

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  // A leading =, +, - or @ is executed as a formula by Excel and Sheets. Prefixing
  // a tab neutralises it without changing what a human reads.
  const guarded = /^[=+\-@]/.test(text) ? `\t${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function downloadCsv({
  filename,
  columns,
  rows,
  scopeNote,
}: {
  filename: string;
  columns: string[];
  rows: (string | number | null | undefined)[][];
  /** e.g. "Rows 1–10 of 4,852 (page 1 only)". Written into the file. */
  scopeNote?: string;
}) {
  const lines: string[] = [];
  if (scopeNote) lines.push(escapeCell(`# ${scopeNote}`));
  lines.push(columns.map(escapeCell).join(","));
  for (const row of rows) lines.push(row.map(escapeCell).join(","));

  // The BOM makes Excel read the file as UTF-8 — without it, "Kilimani" is fine but
  // any non-ASCII name is mangled.
  const blob = new Blob([`﻿${lines.join("\r\n")}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
