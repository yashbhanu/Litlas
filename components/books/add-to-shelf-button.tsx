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
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button size={size} variant={added ? "ghost" : "outline"} />}
        aria-label={`Add ${book.title} to shelf`}
      >
        {added ? <CheckIcon aria-hidden /> : <PlusIcon aria-hidden />}
        {added ? "On your shelf" : "Add to shelf"}
      </DialogTrigger>
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
