"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/db/browser";
import { safeNextPath } from "@/lib/validation/auth";

const ERROR_MESSAGES: Record<string, string> = {
  link: "That sign-in link is invalid or has expired. Request a new one.",
  provider: "Sign-in was cancelled or failed. Please try again.",
};

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string };

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const linkError = ERROR_MESSAGES[searchParams.get("error") ?? ""];
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const callbackUrl = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendMagicLink(event: FormEvent) {
    event.preventDefault();
    setState({ kind: "sending" });
    const { error } = await createSupabaseBrowserClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    setState(error ? { kind: "error", message: error.message } : { kind: "sent", email });
  }

  async function signInWithGoogle() {
    const { error } = await createSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (error) setState({ kind: "error", message: error.message });
  }

  if (state.kind === "sent") {
    return (
      <div role="status" className="rounded-lg border p-4 text-sm">
        Check <strong>{state.email}</strong> for a sign-in link. You can close this tab.
      </div>
    );
  }

  const message = state.kind === "error" ? state.message : linkError;

  return (
    <div className="space-y-6">
      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}

      <form onSubmit={sendMagicLink} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <Button type="submit" className="w-full" disabled={state.kind === "sending"}>
          {state.kind === "sending" ? "Sending…" : "Email me a sign-in link"}
        </Button>
      </form>

      {googleEnabled ? (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button type="button" variant="outline" className="w-full" onClick={signInWithGoogle}>
            Continue with Google
          </Button>
        </>
      ) : null}
    </div>
  );
}
