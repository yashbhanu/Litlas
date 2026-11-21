"use client";

import { CheckCircle2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APPROVAL_THRESHOLD } from "@/lib/locations/constants";
import type { SuggestLocationResponse } from "@/lib/locations/types";

export function SuggestionThanks({
  result,
  onDone,
}: {
  result: SuggestLocationResponse;
  onDone: () => void;
}) {
  const votes = result.suggestion?.votes ?? 1;
  const needed = Math.max(0, APPROVAL_THRESHOLD - votes);
  return (
    <div className="space-y-4" role="status">
      <div className="flex items-start gap-3">
        <CheckCircle2Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="space-y-1 text-sm">
          <p className="font-medium">Thanks for your suggestion!</p>
          <p className="text-muted-foreground">
            {result.status === "approved"
              ? "This location is now on the map."
              : `It will appear on the map once ${needed} more ${needed === 1 ? "reader confirms" : "readers confirm"} it, or a moderator approves it.`}
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={onDone} autoFocus>
          Done
        </Button>
      </div>
    </div>
  );
}
