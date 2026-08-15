import { cn } from "@/lib/utils";

/**
 * The NyumbaLink mark: a house outline whose interior forms an "N", with a
 * location pin cut into the right shoulder and a ground swoosh beneath. Drawn as
 * SVG so it stays crisp at any size and inherits no raster weight.
 *
 * Shared with the tenant/landlord app. If the mark changes there, change it here.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-10", className)}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="32" cy="32" r="32" fill="var(--color-primary)" />

      {/* Roofline and walls of the house, drawn as a stroke. */}
      <path
        d="M15 30.5 32 17l17 13.5V47H15V30.5Z"
        stroke="var(--color-primary-foreground)"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />

      {/* Diagonal of the "N" — reads as a wall and as a letterform. */}
      <path
        d="M23.5 43V25.5L40.5 43V25.5"
        stroke="var(--color-primary-foreground)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Location pin overlapping the right shoulder. */}
      <path d="M44 15c4.7 0 8.5 3.8 8.5 8.5 0 5.6-8.5 13-8.5 13V15Z" fill="var(--color-accent)" />
      <circle cx="44.2" cy="23.4" r="3" fill="var(--color-primary)" />

      {/* Ground swoosh. */}
      <path
        d="M12 48.5c7.5-3.4 32.5-3.4 40 0"
        stroke="var(--color-accent)"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

/**
 * Wordmark plus mark.
 *
 * The strapline reads "Admin Console" rather than the public "Find. Connect.
 * Home." — an operator needs to know at a glance which of the two apps this tab
 * is, especially with both open side by side against the same backend.
 *
 * `onDark` inverts the type for the green sidebar. The wordmark stays on the serif
 * face here as it does on the public site, but nothing else in this app uses it:
 * the brand font is loaded for one string, and headings stay on Inter.
 */
export function Logo({
  className,
  markOnly = false,
  onDark = false,
}: {
  className?: string;
  markOnly?: boolean;
  onDark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!markOnly ? (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "text-xl font-semibold tracking-tight",
              onDark ? "text-sidebar-foreground" : "text-primary",
            )}
          >
            Nyumba<span className="text-accent">Link</span>
          </span>
          <span
            className={cn(
              "mt-1 text-[0.6rem] font-medium tracking-wide uppercase",
              onDark ? "text-sidebar-muted" : "text-muted-foreground",
            )}
          >
            Admin Console
          </span>
        </span>
      ) : null}
    </span>
  );
}
