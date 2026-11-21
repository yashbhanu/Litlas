"use client";

import { CheckIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { BookSummary } from "@/lib/books/public-types";
import { AddBookForm } from "./add-book-form";

/** "Add to shelf" for a book we already know (explore, place and book pages). */
export function AddToShelfButton({
  book,
  size = "sm",
}: {
  book: BookSummary;
  /** "icon": a compact square "+" button for book lists. */
  size?: "sm" | "default" | "icon";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {size === "icon" ? (
        <DialogTrigger
          render={
            <Button
              size="icon-lg"
              variant="outline"
              className="rounded-xl text-primary hover:bg-secondary hover:text-secondary-foreground"
            />
          }
          aria-label={added ? `${book.title} is on your shelf` : `Add ${book.title} to shelf`}
        >
          {added ? <CheckIcon aria-hidden /> : <PlusIcon aria-hidden />}
        </DialogTrigger>
      ) : (
        <DialogTrigger
          render={
            <Button size={size === "default" ? "lg" : "sm"} variant={added ? "ghost" : "outline"} />
          }
          aria-label={`Add ${book.title} to shelf`}
        >
          {added ? <CheckIcon aria-hidden /> : <PlusIcon aria-hidden />}
          {added ? "On your shelf" : "Add to shelf"}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add to shelf</DialogTitle>
          <DialogDescription>
            Set a status, and optionally a rating and finish date.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <AddBookForm
            book={{ ...book, bookId: book.id }}
            onAdded={() => {
              setAdded(true);
              setOpen(false);
              router.refresh();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
