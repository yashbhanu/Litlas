"use client";

import { PlusIcon } from "lucide-react";
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
import { AddBookFlow } from "./add-book-flow";

export function AddBookDialog({ triggerClassName }: { triggerClassName?: string } = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className={triggerClassName} />}>
        <PlusIcon aria-hidden />
        Add a book
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a book</DialogTitle>
          <DialogDescription>
            Find a book on Open Library and add it to your shelf.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <AddBookFlow onAdded={() => router.refresh()} onDone={() => setOpen(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
