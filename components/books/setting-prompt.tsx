"use client";

import { MapPinOffIcon } from "lucide-react";
import { useState } from "react";
import { PlacePicker } from "@/components/locations/place-picker";
import { SuggestionThanks } from "@/components/locations/suggestion-thanks";
import type { SuggestLocationResponse } from "@/lib/locations/types";

/** Shown after adding a book with no known setting: suggest one, or skip. */
export function SettingPrompt({
  bookId,
  title,
  lookupFailed,
  onDone,
}: {
  bookId: string;
  title: string;
  lookupFailed: boolean;
  onDone: () => void;
}) {
  const [result, setResult] = useState<SuggestLocationResponse | null>(null);

  if (result) return <SuggestionThanks result={result} onDone={onDone} />;

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
              ? `We added “${title}” to your shelf, but couldn't reach Wikidata to find its setting. You can suggest one now.`
              : `We added “${title}” to your shelf, but couldn't find where it's set. Help other readers by suggesting a location.`}
          </p>
        </div>
      </div>
      <PlacePicker bookId={bookId} onSuggested={setResult} onSkip={onDone} />
    </section>
  );
}
