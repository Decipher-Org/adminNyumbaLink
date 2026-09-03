import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { KeyRound, LogOut, Save, ShieldCheck } from "lucide-react";

import { PageHeader, Panel } from "@/components/app/PageHeader";
import { Spinner } from "@/components/app/States";
import { Pill, RoleBadge, UserStatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { API_BASE_URL, ApiError } from "@/lib/api/client";
import { changeMyPassword, updateMyProfile } from "@/lib/api/me";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDate } from "@/lib/format";

/**
 * Settings.
 *
 * The editable panels are the only writable
 * self-service endpoints in the whole console: `PATCH /users/me` (name, phone) and
 * `PATCH /users/me/password`. Both act on `req.user.id`, so an admin can only ever
 * edit themselves from this screen.
 *
 * Nothing sensitive is readable here either. This bundle only knows the API base
 * URL — every secret (the database URL, `BETTER_AUTH_SECRET`, the Resend key) stays
 * in the backend's own `.env`, because anything a Vite build can read ships to the
 * browser in plain text.
 */

export default function Settings() {
  const { user, signOut, refreshUser } = useAuth();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your account and this console's API connection."
        actions={
          <Button variant="outline" onClick={() => void signOut()}>
            <LogOut />
            Sign out
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ProfilePanel onSaved={refreshUser} />
        <PasswordPanel />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Your account"
          description="Read-only — a role can only be changed by another admin"
        >
          {user ? (
            <dl className="space-y-3 text-body-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="truncate text-right text-foreground">{user.email}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Role</dt>
                <dd>
                  <RoleBadge role={user.role} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <UserStatusBadge status={user.status} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Email verified</dt>
                <dd>
                  <Pill tone={user.emailVerified ? "success" : "warning"}>
                    {user.emailVerified ? "Verified" : "Not verified"}
                  </Pill>
                </dd>
              </div>
              {user.createdAt ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Admin since</dt>
                  <dd className="text-foreground">{formatDate(user.createdAt)}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <Spinner />
          )}

          <p className="mt-4 text-caption text-muted-foreground">
            You cannot demote yourself — the backend answers{" "}
            <span className="font-medium text-foreground">CANNOT_DEMOTE_SELF</span> — so the console
            can never be left without an administrator by accident.
          </p>
        </Panel>

        <Panel title="Connection" description="Where this console is pointed">
          <dl className="space-y-3 text-body-sm">
            <div className="flex items-start justify-between gap-3">
              <dt className="shrink-0 text-muted-foreground">API</dt>
              <dd className="min-w-0 truncate text-right font-mono text-caption text-foreground">
                {API_BASE_URL}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Build</dt>
              <dd className="text-foreground">{import.meta.env.MODE}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Session</dt>
              <dd className="text-right text-foreground">
                Bearer token
                <span className="block text-caption text-muted-foreground">
                  rolling, server-side in Redis
                </span>
              </dd>
            </div>
          </dl>

          <Separator className="my-4" />

          <div className="flex gap-3">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
            <p className="text-caption text-muted-foreground">
              The API URL above is the only configuration this app is given. Database credentials,
              the auth secret and the mail provider key stay in the backend's environment — a value
              a browser bundle can read is a value anyone can read.
            </p>
          </div>
        </Panel>
      </div>

    </>
  );
}

// ------------------------------------------------------------------ profile

function ProfilePanel({ onSaved }: { onSaved: () => Promise<void> }) {
  const { user } = useAuth();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phoneNumber ?? "");
  const [saving, setSaving] = useState(false);

  // The provider resolves the session after first paint, so seed once it lands.
  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setPhone(user.phoneNumber ?? "");
  }, [user]);

  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();
  const dirty =
    Boolean(user) && (trimmedName !== user?.name || trimmedPhone !== (user?.phoneNumber ?? ""));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || saving || !dirty) return;

    if (!trimmedName) {
      toast.error("A name is required.");
      return;
    }

    setSaving(true);
    try {
      await updateMyProfile({
        ...(trimmedName !== user.name ? { name: trimmedName } : {}),
        // An emptied field means "remove it", which the endpoint accepts as null.
        ...(trimmedPhone !== (user.phoneNumber ?? "")
          ? { phone: trimmedPhone === "" ? null : trimmedPhone }
          : {}),
      });
      await onSaved();
      toast.success("Profile updated.");
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.code === "PHONE_ALREADY_IN_USE"
            ? "That phone number is already on another account."
            : error.message
          : "Could not save your profile.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel
      title="Your profile"
      description="Saved to the server"
      action={<Pill tone="success">Live</Pill>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="settings-name">Name</Label>
          <Input
            id="settings-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            disabled={!user || saving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-phone">Phone</Label>
          <Input
            id="settings-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+2547…"
            inputMode="tel"
            autoComplete="tel"
            disabled={!user || saving}
          />
          <p className="text-caption text-muted-foreground">
            Changing this marks the number unverified again. Leave it empty to remove it.
          </p>
        </div>

        <Button type="submit" disabled={!dirty || saving}>
          {saving ? <Spinner className="size-4" /> : <Save />}
          Save changes
        </Button>
      </form>
    </Panel>
  );
}

// ----------------------------------------------------------------- password

const MIN_PASSWORD_LENGTH = 8;

function PasswordPanel() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const tooShort = next.length > 0 && next.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit =
    current.length > 0 && next.length >= MIN_PASSWORD_LENGTH && next === confirm && !saving;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    try {
      await changeMyPassword({ currentPassword: current, newPassword: next });
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password changed. Every other device has been signed out.");
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.code === "CURRENT_PASSWORD_INCORRECT"
            ? "That current password is not right."
            : error.message
          : "Could not change your password.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel
      title="Password"
      description="Saved to the server"
      action={<Pill tone="success">Live</Pill>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="settings-current">Current password</Label>
          <Input
            id="settings-current"
            type="password"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            autoComplete="current-password"
            disabled={saving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-new">New password</Label>
          <Input
            id="settings-new"
            type="password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            autoComplete="new-password"
            aria-invalid={tooShort || undefined}
            disabled={saving}
          />
          <p className="text-caption text-muted-foreground">
            {tooShort ? (
              <span className="text-destructive-strong">
                At least {MIN_PASSWORD_LENGTH} characters.
              </span>
            ) : (
              `At least ${MIN_PASSWORD_LENGTH} characters.`
            )}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-confirm">Confirm new password</Label>
          <Input
            id="settings-confirm"
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            aria-invalid={mismatch || undefined}
            disabled={saving}
          />
          {mismatch ? (
            <p className="text-caption text-destructive-strong">Those two do not match.</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!canSubmit}>
            {saving ? <Spinner className="size-4" /> : <KeyRound />}
            Change password
          </Button>
          <p className="text-caption text-muted-foreground">
            Other sessions are revoked. This one stays signed in.
          </p>
        </div>
      </form>
    </Panel>
  );
}
