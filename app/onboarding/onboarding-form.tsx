"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";
import { createProfileSchema, type CreateProfileInput } from "@/lib/validation/profile";

export function OnboardingForm({
  suggestedUsername,
  next,
}: {
  suggestedUsername: string;
  next: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(suggestedUsername);
  const [displayName, setDisplayName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [clientError, setClientError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: CreateProfileInput) =>
      apiFetch("/api/me/profile", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      router.replace(next);
      router.refresh();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const input: CreateProfileInput = { username, displayName, isPublic };
    const parsed = createProfileSchema.safeParse(input);
    if (!parsed.success) {
      setClientError(parsed.error.issues[0]?.message ?? "Check the form and try again.");
      return;
    }
    setClientError(null);
    mutation.mutate(input);
  }

  const error = clientError ?? mutation.error?.message ?? null;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value.toLowerCase())}
          aria-describedby="username-hint"
          aria-invalid={error ? true : undefined}
        />
        <p id="username-hint" className="text-xs text-muted-foreground">
          3–20 characters: lowercase letters, numbers or underscores.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="displayName">Display name (optional)</Label>
        <Input
          id="displayName"
          name="displayName"
          autoComplete="name"
          maxLength={50}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-primary"
          checked={isPublic}
          onChange={(event) => setIsPublic(event.target.checked)}
        />
        <span>
          Public profile
          <span className="block text-xs text-muted-foreground">
            Anyone with the link can see your shelf and map. You can change this later.
          </span>
        </span>
      </label>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={mutation.isPending || mutation.isSuccess}>
        {mutation.isPending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
