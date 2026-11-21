"use client";

import { useState } from "react";
import type { UpsertShelfResponse } from "@/lib/books/types";
import type { BookSearchResult } from "@/lib/validation/books";
import { AddBookForm } from "./add-book-form";
import { BookSearch } from "./book-search";
import { SettingPrompt } from "./setting-prompt";

type Step =
  | { name: "search" }
  | { name: "form"; book: BookSearchResult }
  | { name: "prompt"; result: UpsertShelfResponse };

/**
 * Search Open Library, pick a book, set status/rating/date, add it to the shelf. If the
 * book has no known setting, ask "Where is this book set?" before finishing.
 * `onAdded` runs as soon as the book is saved (refresh server data); `onDone` when the
 * flow is finished (close the dialog / navigate).
 */
export function AddBookFlow({ onAdded, onDone }: { onAdded: () => void; onDone: () => void }) {
  const [step, setStep] = useState<Step>({ name: "search" });

  if (step.name === "prompt") {
    return (
      <SettingPrompt
        title={step.result.entry.book.title}
        lookupFailed={step.result.settingLookupFailed}
        onSkip={onDone}
      />
    );
  }

  if (step.name === "form") {
    return (
      <AddBookForm
        book={step.book}
        onBack={() => setStep({ name: "search" })}
        onAdded={(result) => {
          onAdded();
          if (result.entry.places.length === 0) setStep({ name: "prompt", result });
          else onDone();
        }}
      />
    );
  }

  return <BookSearch onSelect={(book) => setStep({ name: "form", book })} />;
}
