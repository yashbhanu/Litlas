"use client";

import { MapPinOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shown after adding a book with no known setting. Phase 4 adds the PlacePicker here so
 * readers can suggest one; for now the reader can only skip.
 */
export function SettingPrompt({
  title,
  lookupFailed,
  onSkip,
}: {
  title: string;
  lookupFailed: boolean;
  onSkip: () => void;
}) {
  return (
    <section aria-labelledby="setting-prompt-heading" className="space-y-4">
      <div className="flex items-start gap-3">
        <MapPinOffIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <h3 id="setting-prompt-heading" className="font-medium">
            Where is this book set?
          </h3>
          <p className="text-sm text-muted-foreground">
            {lookupFailed
              ? `We added “${title}” to your shelf, but couldn't reach Wikidata to find its setting. We'll try again next time.`
              : `We added “${title}” to your shelf, but couldn't find where it's set on Wikidata.`}{" "}
            Suggesting a location is coming soon.
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={onSkip} autoFocus>
          Skip for now
        </Button>
      </div>
    </section>
  );
}
