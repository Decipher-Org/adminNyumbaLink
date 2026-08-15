import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Password input with a reveal toggle.
 *
 * The toggle is a `type="button"` — inside a form, a bare `<button>` submits, so
 * revealing the password would post a half-filled form. It is also excluded from
 * the tab order: keyboard users shouldn't have to pass through it on the way to
 * the submit button, and the field is reachable by click or by the label.
 */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  hint,
  disabled,
  required = true,
  minLength,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  minLength?: number;
  className?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          required={required}
          minLength={minLength}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="pr-11"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="size-4" />
          ) : (
            <Eye aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-caption text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
