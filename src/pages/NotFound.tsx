import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, MapPinOff } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * 404 inside the console.
 *
 * This renders inside `AdminShell`, so the sidebar stays put and a mistyped URL
 * costs one click rather than a reload. The path is echoed back because the usual
 * way to land here is a stale bookmark from a route that has since been renamed.
 */
export default function NotFound() {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-surface text-muted-foreground">
        <MapPinOff aria-hidden="true" className="size-6" />
      </span>

      <h1 className="mt-5 text-h2 text-foreground">This screen doesn't exist</h1>
      <p className="mt-2 max-w-md text-body-sm text-muted-foreground">
        Nothing is served at{" "}
        <span className="font-mono break-all text-foreground">{pathname}</span>. Pick a section from
        the menu, or head back to the dashboard.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link to="/">
            <ArrowLeft />
            Back to dashboard
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/landlords">Approval queue</Link>
        </Button>
      </div>
    </div>
  );
}
