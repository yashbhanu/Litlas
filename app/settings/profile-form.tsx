"use client";

import { useMutation } from "@tanstack/react-query";
import { CheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiErrorMessage } from "@/components/api-error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";
import type { Profile } from "@/lib/auth";
import { updateProfileSchema, type UpdateProfileInput } from "@/lib/validation/profile";

export function ProfileForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [isPublic, setIsPublic] = useState(profile.isPublic);
  const [clientError, setClientError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      apiFetch("/api/me/profile", { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: () => router.refresh(),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const input: UpdateProfileInput = { username, displayName, isPublic };
    const parsed = updateProfileSchema.safeParse(input);
    if (!parsed.success) {
      setClientError(parsed.error.issues[0]?.message ?? "Check the form and try again.");
      return;
    }
    setClientError(null);
    save.mutate(input);
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="username">Username</Label>
        <div className="flex items-center rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <span className="pl-2.5 text-sm text-muted-foreground">@</span>
          <Input
            id="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            className="border-0 pl-1 focus-visible:ring-0"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Your public map lives at /u/{username || "username"}. Changing it breaks old links.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="displayName">Display name (optional)</Label>
        <Input
          id="displayName"
          value={displayName}
          maxLength={50}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </div>
      <label className="flex items-start gap-3 rounded-xl border p-3 text-sm has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(event) => setIsPublic(event.target.checked)}
          className="mt-0.5 size-4 accent-primary"
        />
        <span>
          <span className="font-medium">Public profile</span>
          <span className="block text-muted-foreground">
            Anyone with the link can see your map and shelf. Turn off to keep them private.
          </span>
        </span>
      </label>

      {clientError ? (
        <p role="alert" className="text-sm text-destructive">
          {clientError}
        </p>
      ) : save.error ? (
        <ApiErrorMessage error={save.error} />
      ) : save.isSuccess ? (
        <p role="status" className="flex items-center gap-1.5 text-sm text-primary">
          <CheckIcon aria-hidden className="size-4" /> Saved
        </p>
      ) : null}

      <Button type="submit" size="lg" className="h-10 rounded-xl px-4" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
