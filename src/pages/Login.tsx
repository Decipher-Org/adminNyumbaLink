import { useState, type FormEvent } from "react";
import { ArrowRight, Lock, ShieldCheck } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { FormError } from "@/components/app/FormError";
import { PasswordField } from "@/components/app/PasswordField";
import { Spinner } from "@/components/app/States";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as authApi from "@/lib/api/auth";
import { useAuth } from "@/lib/auth/AuthProvider";
import { safeNextPath } from "@/lib/search-params";

/**
 * The only unauthenticated screen in the console.
 *
 * There is no "create account" link, on purpose: `POST /sign-up/email` silently
 * demotes a self-assigned `ADMIN` to `TENANT`, so an admin can only be created
 * server-side (`scripts/create-admin.mjs`) or promoted by another admin. A sign-up
 * form here would hand out tenant accounts that then bounce off this very screen.
 */
export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await signIn(email.trim(), password);
      navigate(safeNextPath(searchParams.get("next")) ?? "/", { replace: true });
    } catch (caught) {
      setError(caught);
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel. Hidden on a phone rather than shrunk — on a 360px screen the
          form is the only thing worth the viewport height. */}
      <aside className="hidden bg-sidebar lg:flex lg:w-[26rem] lg:flex-col lg:justify-between lg:p-10">
        <Logo onDark />

        <div>
          <h2 className="text-h1 text-sidebar-foreground">Platform operations</h2>
          <p className="mt-3 text-body text-sidebar-muted">
            Approve landlords, manage accounts and watch the platform's numbers — all from one
            console.
          </p>

          <ul className="mt-8 space-y-4">
            {[
              { icon: ShieldCheck, text: "Administrator accounts only" },
              { icon: Lock, text: "Sessions expire on the server, not just in this tab" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-body-sm text-sidebar-muted">
                <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-caption text-sidebar-muted">
          NyumbaLink Admin · internal use only. Activity on this console is attributable to your
          account.
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <Logo />
          </div>

          <h1 className="mt-8 text-h1 text-foreground lg:mt-0">Sign in</h1>
          <p className="mt-1.5 text-body-sm text-muted-foreground">
            Use your NyumbaLink administrator account.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error ? <FormError error={error} /> : null}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                // Autofocus is safe here: this screen has one job, and the field is
                // the first thing in reading order either way.
                autoFocus
                required
                disabled={submitting}
                placeholder="admin@nyumbalink.co.ke"
              />
            </div>

            <PasswordField
              label="Password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              disabled={submitting}
            />

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Spinner />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight />
                </>
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <ResetPasswordDialog defaultEmail={email} />
          </div>

          <p className="mt-8 rounded-lg border border-border bg-surface px-3 py-2.5 text-caption text-muted-foreground">
            Accounts aren't self-service here. A new administrator is created by an existing one, or
            provisioned on the server.
          </p>
        </div>
      </main>
    </div>
  );
}

/**
 * Password reset, in two steps against Better Auth's email-OTP plugin.
 *
 * The delivery caveat is stated in the dialog rather than hidden: this backend's
 * sender only writes the code to the server log, so someone with server access has
 * to read it out. Saying "check your email" would leave a locked-out admin waiting
 * for a message that is never going to arrive.
 */
function ResetPasswordDialog({ defaultEmail }: { defaultEmail: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState(defaultEmail);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);

  function reset() {
    setStep("request");
    setOtp("");
    setPassword("");
    setError(null);
    setSubmitting(false);
    setDone(false);
  }

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await authApi.sendVerificationOtp({ email: email.trim(), type: "forget-password" });
      setStep("reset");
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReset(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await authApi.resetPassword({ email: email.trim(), otp: otp.trim(), password });
      setDone(true);
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="link" className="text-body-sm">
          Forgot your password?
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset your password</DialogTitle>
          <DialogDescription>
            A one-time code is generated for your account. In this environment it is written to the
            backend's console rather than emailed — ask whoever runs the server to read it to you.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-4">
            <p className="rounded-lg border border-success/25 bg-success-soft px-3 py-2.5 text-body-sm text-success-strong">
              Password changed. Close this and sign in with the new one.
            </p>
            <Button className="w-full" onClick={() => setOpen(false)}>
              Back to sign in
            </Button>
          </div>
        ) : step === "request" ? (
          <form onSubmit={requestCode} className="space-y-4">
            {error ? <FormError error={error} /> : null}
            <div className="space-y-1.5">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
                disabled={submitting}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Spinner /> : null}
              Send code
            </Button>
          </form>
        ) : (
          <form onSubmit={submitReset} className="space-y-4">
            {error ? <FormError error={error} /> : null}
            <div className="space-y-1.5">
              <Label htmlFor="reset-otp">One-time code</Label>
              <Input
                id="reset-otp"
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                disabled={submitting}
                className="tracking-[0.3em]"
              />
            </div>
            <PasswordField
              label="New password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              minLength={8}
              hint="At least 8 characters."
              disabled={submitting}
            />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Spinner /> : null}
              Change password
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setStep("request")}
              disabled={submitting}
            >
              Use a different email
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
