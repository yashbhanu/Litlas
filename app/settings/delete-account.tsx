"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiErrorMessage } from "@/components/api-error-message";
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
import { apiFetch } from "@/lib/api-client";

export function DeleteAccount({ username }: { username: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const remove = useMutation({
    mutationFn: () =>
      apiFetch<void>("/api/me", {
        method: "DELETE",
        body: JSON.stringify({ confirmUsername: confirm }),
      }),
    onSuccess: () => {
      router.replace("/?account=deleted");
      router.refresh();
    },
  });
  const matches = confirm.trim().toLowerCase() === username;

  return (
    <section
      aria-labelledby="danger-heading"
      className="space-y-3 rounded-2xl border border-destructive/30 p-5 sm:p-6"
    >
      <h2 id="danger-heading" className="text-lg font-semibold">
        Delete account
      </h2>
      <p className="text-sm text-muted-foreground">
        Permanently deletes your profile, shelf and votes. Places you suggested stay on the map
        without your name. This can&apos;t be undone.
      </p>
      <Dialog>
        <DialogTrigger
          render={<Button variant="destructive" size="lg" className="h-10 rounded-xl px-4" />}
        >
          Delete my account
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              Your profile, shelf and votes will be deleted permanently.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (matches) remove.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="confirm-username">
                Type <span className="font-mono font-semibold">{username}</span> to confirm
              </Label>
              <Input
                id="confirm-username"
                autoComplete="off"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </div>
            {remove.error ? <ApiErrorMessage error={remove.error} /> : null}
            <Button
              type="submit"
              variant="destructive"
              className="h-10 w-full rounded-xl"
              disabled={!matches || remove.isPending}
            >
              {remove.isPending ? "Deleting…" : "Delete my account forever"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
